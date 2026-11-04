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
import { COMPILE_INSTRUCTION, COMPILE_LABEL } from "./prompt.js";

// The most events a transcript holds, live or read back from a saved session.
export const TRANSCRIPT_LIMIT = 500;
const RESTORE_FAILED =
  "Couldn't load your last conversation with Claude, so this is a new one.";
const resumeFailed = (cause: string) =>
  `Couldn't load your last conversation with Claude (${cause}), so this is a new one.`;
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
  // A send that will never run (Stop, run ended), by the user event id send returned.
  onNotSent?(sendId: string): void;
  // How a restored transcript shows a saved prompt sent with a label, when not as itself.
  shownPrompt?(prompt: string): string | undefined;
};

type Send = { id: string; text: string };

// resumed: started with a saved session id. initialized: the CLI's init message arrived.
// interrupted: interrupt() was called during the turn in flight, so its result ends the turn.
// busy: a turn was handed to the SDK and its result has not arrived. held: sends waiting
// for that result; the SDK writes whatever the prompt yields to the CLI at once, so only
// sends kept here can still be dropped by a Stop.
type Run = {
  input: InputQueue;
  query: Query;
  resumed: boolean;
  initialized: boolean;
  interrupted: boolean;
  busy: boolean;
  held: Send[];
};

// The streaming prompt: yields pushed messages in order and stays open until ended.
// It holds at most the turn in flight, which the SDK takes as soon as the CLI is ready.
class InputQueue {
  #items: { id: string; msg: SDKUserMessage }[] = [];
  #ended = false;
  #wake: (() => void) | undefined;

  push(id: string, msg: SDKUserMessage): void {
    this.#items.push({ id, msg });
    this.#wake?.();
  }

  end(): void {
    this.#ended = true;
    this.#wake?.();
  }

  // Drops the messages the SDK has not taken yet and returns their send ids.
  drain(): string[] {
    const ids = this.#items.map((i) => i.id);
    this.#items = [];
    return ids;
  }

  async *messages(): AsyncGenerator<SDKUserMessage> {
    while (!this.#ended) {
      const next = this.#items.shift();
      if (next) {
        yield next.msg;
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

// A saved compile shows its label, as it did live. Matched on the instruction's first line,
// since the doc headings after it vary and decision notes may come before it.
const COMPILE_LINE = COMPILE_INSTRUCTION.split("\n")[0];
const shownPrompt = (prompt: string) =>
  prompt.split("\n").includes(COMPILE_LINE) ? COMPILE_LABEL : prompt;

// When a transcript line was written. The SDK's type leaves the field out, but saved lines
// carry it; a line without one reads as now.
function savedAt(msg: SessionMessage): string {
  const { timestamp } = msg as { timestamp?: unknown };
  return typeof timestamp === "string" ? timestamp : now();
}

// A saved session's transcript, as the panel showed it live, each event at the time its
// line was written. Keyed by event id, so a text block split across lines keeps one entry.
export function transcriptFrom(
  messages: SessionMessage[],
  cwd?: string,
  shown?: (prompt: string) => string | undefined,
): PanelEvent[] {
  const events = new Map<string, PanelEvent>();
  const add = (e: PanelEvent) => events.set(e.id, e);
  const mapper = new SdkEventMapper(cwd);
  for (const msg of messages) {
    const at = savedAt(msg);
    const prompt = savedPrompt(msg);
    if (prompt?.startsWith(INTERRUPT_MARKER)) {
      add({
        kind: "result",
        id: msg.uuid,
        subtype: "interrupted",
        costUsd: null,
        durationMs: 0,
        at,
      });
    } else if (prompt !== undefined) {
      const text = shown?.(prompt) ?? shownPrompt(prompt);
      add({ kind: "user", id: msg.uuid, text, at });
    } else {
      for (const e of mapper.map(msg as unknown as SDKMessage, msg.uuid))
        add({ ...e, at });
    }
  }
  return [...events.values()];
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
        const { cwd, shownPrompt } = this.#deps;
        for (const e of transcriptFrom(saved, cwd, shownPrompt))
          this.#remember(e);
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

  // `text` goes to Claude; the user event shows `shown`, what the user typed.
  send(text: string, shown: string = text): string {
    const id = randomUUID();
    this.#emit({ kind: "user", id, text: shown, at: now() });
    const run =
      !this.#run || this.#status === "error" ? this.#start() : this.#run;
    if (run.busy) {
      run.held.push({ id, text });
    } else {
      if (this.#status === "idle") this.#setStatus("working");
      this.#hand(run, { id, text });
    }
    return id;
  }

  // Stop also drops the sends held behind the turn, so none runs after it.
  async interrupt(): Promise<void> {
    const run = this.#run;
    if (!run) return;
    if (!run.initialized) {
      // A CLI still starting cannot answer an interrupt, so end the run instead.
      this.#notSent(this.#stopRun(), NOT_SENT_STOPPED);
      this.#setStatus("stopped");
      return;
    }
    this.#notSent(
      run.held.splice(0).map((h) => h.id),
      NOT_SENT_STOPPED,
    );
    if (this.#status !== "idle") run.interrupted = true;
    await run.query.interrupt();
  }

  async close(): Promise<void> {
    this.#stopRun();
    this.#setStatus("stopped");
  }

  #start(): Run {
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
      busy: false,
      held: [],
    };
    this.#run = run;
    this.#setStatus("starting");
    void this.#consume(run).catch((err) =>
      console.error("session loop failed", err),
    );
    return run;
  }

  // Ends the run; returns the ids of the sends it never handed over or the SDK never
  // took, oldest first.
  #stopRun(): string[] {
    const run = this.#run;
    this.#run = undefined;
    if (!run) return [];
    const dropped = [
      ...run.input.drain(),
      ...run.held.splice(0).map((h) => h.id),
    ];
    run.input.end();
    run.query.close();
    return dropped;
  }

  // Assumes the CLI answers every handed message with exactly one result. If it ever
  // batched two messages into one turn, or dropped a result, busy would never clear and
  // every held send would wait forever (until a Stop or the run ends).
  #hand(run: Run, send: Send): void {
    run.busy = true;
    run.input.push(send.id, {
      type: "user",
      message: { role: "user", content: send.text },
      parent_tool_use_id: null,
    });
  }

  // A result ended the turn: hand over the next held send, if any. Returns whether it did.
  #turnEnded(run: Run): boolean {
    run.busy = false;
    const next = run.held.shift();
    if (next === undefined) return false;
    this.#hand(run, next);
    return true;
  }

  async #consume(run: Run): Promise<void> {
    const mapper = new SdkEventMapper(this.#deps.cwd);
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
          this.#setStatus(this.#turnEnded(run) ? "working" : "idle");
          continue;
        }
        for (const e of mapper.map(msg)) this.#emit(e);
        if (msg.type === "result") {
          // A held send runs next on this run, even after an error result, as a queued
          // send did before sends were held; its error stays in the transcript.
          const error = resultError(msg);
          if (this.#turnEnded(run)) this.#setStatus("working");
          else if (error === undefined) this.#setStatus("idle");
          else this.#setStatus("error", error);
        }
      }
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      // The CLI refused the saved session: drop it so the next send starts fresh.
      if (run.resumed && !run.initialized && this.#run === run) {
        console.warn(`could not resume session ${this.#sessionId}: ${message}`);
        this.#sessionId = undefined;
        message = resumeFailed(message);
      }
    }
    // Thrown or ended on its own, this run is done: reap it so the next send resumes afresh.
    if (this.#run !== run) return;
    const dropped = this.#stopRun();
    this.#emit({ kind: "error", id: randomUUID(), message, at: now() });
    this.#notSent(dropped, NOT_SENT_ENDED);
    this.#setStatus("error", message);
  }

  #notSent(ids: string[], message: string): void {
    for (const id of ids) {
      this.#emit({ kind: "error", id: randomUUID(), message, at: now() });
      this.#deps.onNotSent?.(id);
    }
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
