import { randomUUID } from "node:crypto";
import type {
  getSessionMessages,
  Options,
  Query,
  query,
  SDKMessage,
  SDKUserMessage,
  SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { AgentStatus } from "../../shared/messages.js";
import type { PanelEvent } from "../../shared/panel.js";
import { resultError, SdkEventMapper } from "./events.js";

const TRANSCRIPT_LIMIT = 500;
const RESTORE_FAILED = "previous session could not be loaded; starting fresh";
const NOT_SENT_ENDED = "Message not sent: Claude session ended before it ran";
const NOT_SENT_STOPPED = "Message not sent: stopped";
// The CLI saves a Stop as a user message with this text (or "... for tool use]").
const INTERRUPT_MARKER = "[Request interrupted by user";

export type SessionDeps = {
  query: typeof query;
  getSessionMessages: typeof getSessionMessages;
  cwd: string;
  options: Partial<Options>;
  onEvent(e: PanelEvent): void;
  onStatus(s: AgentStatus, message?: string): void;
  onSessionId(id: string): void;
};

// resumed: started with a saved session id. initialized: the CLI's init message arrived.
// interrupted: interrupt() was called during the turn in flight, so its result ends the turn.
type Run = {
  input: InputQueue;
  query: Query;
  resumed: boolean;
  initialized: boolean;
  interrupted: boolean;
};

// The streaming prompt: yields pushed messages in order and stays open until ended.
class InputQueue {
  #items: SDKUserMessage[] = [];
  #ended = false;
  #wake: (() => void) | undefined;

  push(msg: SDKUserMessage): void {
    this.#items.push(msg);
    this.#wake?.();
  }

  end(): void {
    this.#ended = true;
    this.#wake?.();
  }

  // Drops the messages the SDK has not taken yet and returns how many there were.
  drain(): number {
    const count = this.#items.length;
    this.#items = [];
    return count;
  }

  async *messages(): AsyncGenerator<SDKUserMessage> {
    while (!this.#ended) {
      const next = this.#items.shift();
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        this.#wake = resolve;
      });
      this.#wake = undefined;
    }
  }
}

const now = () => new Date().toISOString();

// A saved transcript's typed prompts, which the live mapper never sees as events.
function savedPrompt(msg: SessionMessage): string | undefined {
  if (msg.type !== "user") return undefined;
  const content = (msg.message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.some((b) => b.type !== "text"))
    return undefined;
  return content.map((b: { text: string }) => b.text).join("\n");
}

export class PlanSession {
  #deps: SessionDeps;
  #sessionId: string | undefined;
  #status: AgentStatus = "idle";
  #statusMessage: string | undefined;
  #run: Run | undefined;
  // Keyed by event id so a streamed text block keeps one entry; Map order is arrival order.
  #transcript = new Map<string, PanelEvent>();

  constructor(deps: SessionDeps, resumeId?: string) {
    this.#deps = deps;
    this.#sessionId = resumeId;
  }

  get status(): AgentStatus {
    return this.#status;
  }

  get sessionId(): string | undefined {
    return this.#sessionId;
  }

  transcript(): PanelEvent[] {
    return [...this.#transcript.values()];
  }

  async restore(): Promise<void> {
    const id = this.#sessionId;
    if (id) {
      try {
        const saved = await this.#deps.getSessionMessages(id, {
          dir: this.#deps.cwd,
        });
        if (saved.length === 0) throw new Error(`session ${id} is empty`);
        const mapper = new SdkEventMapper();
        for (const msg of saved) {
          const prompt = savedPrompt(msg);
          if (prompt?.startsWith(INTERRUPT_MARKER)) {
            this.#remember({
              kind: "result",
              id: msg.uuid,
              subtype: "interrupted",
              costUsd: null,
              durationMs: 0,
              at: now(),
            });
          } else if (prompt !== undefined) {
            this.#remember({
              kind: "user",
              id: msg.uuid,
              text: prompt,
              at: now(),
            });
          } else {
            for (const e of mapper.map(msg as unknown as SDKMessage, msg.uuid))
              this.#remember(e);
          }
        }
      } catch {
        this.#sessionId = undefined;
        this.#emit({
          kind: "error",
          id: randomUUID(),
          message: RESTORE_FAILED,
          at: now(),
        });
      }
    }
    this.#setStatus("idle");
  }

  send(text: string): string {
    const id = randomUUID();
    this.#emit({ kind: "user", id, text, at: now() });
    if (!this.#run || this.#status === "error") this.#start();
    else if (this.#status === "idle") this.#setStatus("working");
    this.#run?.input.push({
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    });
    return id;
  }

  // Stop also drops the messages queued behind the turn, so none runs after it.
  async interrupt(): Promise<void> {
    const run = this.#run;
    if (!run) return;
    if (!run.initialized) {
      // A CLI still starting cannot answer an interrupt, so end the run instead.
      this.#notSent(this.#stopRun(), NOT_SENT_STOPPED);
      this.#setStatus("stopped");
      return;
    }
    this.#notSent(run.input.drain(), NOT_SENT_STOPPED);
    if (this.#status !== "idle") run.interrupted = true;
    await run.query.interrupt();
  }

  async close(): Promise<void> {
    this.#stopRun();
    this.#setStatus("stopped");
  }

  #start(): void {
    this.#stopRun();
    const input = new InputQueue();
    const run: Run = {
      input,
      query: this.#deps.query({
        prompt: input.messages(),
        options: {
          ...this.#deps.options,
          cwd: this.#deps.cwd,
          includePartialMessages: true,
          ...(this.#sessionId ? { resume: this.#sessionId } : {}),
        },
      }),
      resumed: this.#sessionId !== undefined,
      initialized: false,
      interrupted: false,
    };
    this.#run = run;
    this.#setStatus("starting");
    void this.#consume(run).catch((err) =>
      console.error("session loop failed", err),
    );
  }

  // Ends the run; returns how many queued messages it never sent.
  #stopRun(): number {
    const run = this.#run;
    this.#run = undefined;
    const dropped = run?.input.drain() ?? 0;
    run?.input.end();
    run?.query.close();
    return dropped;
  }

  async #consume(run: Run): Promise<void> {
    const mapper = new SdkEventMapper();
    let message = "Claude session ended";
    try {
      for await (const msg of run.query) {
        if (this.#run !== run) return;
        if (msg.type === "system" && msg.subtype === "init") {
          run.initialized = true;
          if (msg.session_id !== this.#sessionId) {
            this.#sessionId = msg.session_id;
            this.#deps.onSessionId(msg.session_id);
          }
          // The query only starts on a send, so a turn is already in flight.
          if (this.#status === "starting") this.#setStatus("working");
        }
        const stopped = msg.type === "result" && run.interrupted;
        if (stopped) run.interrupted = false;
        if (stopped && msg.subtype !== "success") {
          // The SDK answers an interrupt with an error result; the reader asked for the stop.
          this.#emit({
            kind: "result",
            id: msg.uuid,
            subtype: "interrupted",
            costUsd: msg.total_cost_usd,
            durationMs: msg.duration_ms,
            at: now(),
          });
          this.#setStatus("idle");
          continue;
        }
        for (const e of mapper.map(msg)) this.#emit(e);
        if (msg.type === "result") {
          const error = resultError(msg);
          if (error === undefined) this.#setStatus("idle");
          else this.#setStatus("error", error);
        } else if (
          this.#status === "idle" &&
          (msg.type === "stream_event" || msg.type === "assistant")
        ) {
          // ponytail: a turn queued behind another reads idle between the first result and its
          // first streamed message; counting sends against results breaks if the CLI batches them.
          this.#setStatus("working");
        }
      }
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      // The CLI refused the saved session: drop it so the next send starts fresh.
      if (run.resumed && !run.initialized && this.#run === run) {
        console.warn(`could not resume session ${this.#sessionId}: ${message}`);
        this.#sessionId = undefined;
        message = RESTORE_FAILED;
      }
    }
    // Thrown or ended on its own, this run is done: reap it so the next send resumes afresh.
    if (this.#run !== run) return;
    const dropped = this.#stopRun();
    this.#emit({ kind: "error", id: randomUUID(), message, at: now() });
    this.#notSent(dropped, NOT_SENT_ENDED);
    this.#setStatus("error", message);
  }

  #notSent(count: number, message: string): void {
    for (let i = 0; i < count; i++)
      this.#emit({ kind: "error", id: randomUUID(), message, at: now() });
  }

  #emit(e: PanelEvent): void {
    this.#remember(e);
    this.#deps.onEvent(e);
  }

  #remember(e: PanelEvent): void {
    this.#transcript.set(e.id, e);
    if (this.#transcript.size > TRANSCRIPT_LIMIT) {
      const oldest = this.#transcript.keys().next().value;
      if (oldest !== undefined) this.#transcript.delete(oldest);
    }
  }

  #setStatus(status: AgentStatus, message?: string): void {
    if (status === this.#status && message === this.#statusMessage) return;
    this.#status = status;
    this.#statusMessage = message;
    this.#deps.onStatus(status, message);
  }
}
