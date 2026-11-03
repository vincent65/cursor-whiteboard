import { relative, resolve } from "node:path";
import type * as claudeSdk from "@anthropic-ai/claude-agent-sdk";
import type { AgentStatus } from "../../shared/messages.js";
import type { PanelEvent, PermissionDecision } from "../../shared/panel.js";
import type { LaunchOptions, RunView } from "../../shared/runs.js";
import type { RunRecord, RunStatus } from "../../shared/types.js";
import { PermissionBroker } from "../agent/broker.js";
import { denyBoardWrites } from "../agent/hooks.js";
import { PlanSession } from "../agent/session.js";
import { ExistsError, type FileStore, NotFoundError } from "../files.js";
import type { WsHub } from "../ws.js";
import { createWorktree } from "./git.js";
import { prUrlIn, runPrompt } from "./prompt.js";
import type { RunStore } from "./store.js";

const CONTINUE = "Continue the task where you left off.";
const INTERRUPTED_REASON = "interrupted";
const BOARD_READ_ONLY =
  "Blueprint board files are read-only in a run. Leave the board to the user.";

type Derived = { status: RunStatus; message?: string; prUrl?: string };

// A run with a session in this process. `record` is ahead of the store, whose writes land
// one at a time; `base` is what the session alone says, before a permission ask overrides it.
type Live = {
  record: RunRecord;
  session: PlanSession;
  broker: PermissionBroker;
  base: Derived;
  // The last assistant text of the turn in flight, and of the turn the last result ended.
  turnText: string | null;
  endedText: string | null;
  lastText: string | null;
  // What the run had spent when the current CLI process started; its totals add to this.
  costBase: number;
};

const now = () => new Date().toISOString();

type RunManagerDeps = {
  store: FileStore;
  runs: RunStore;
  hub: WsHub;
  root: string;
  sdk: Pick<typeof claudeSdk, "query" | "getSessionMessages">;
  git?: { createWorktree: typeof createWorktree };
};

export class RunManager {
  #deps: RunManagerDeps;
  #git: { createWorktree: typeof createWorktree };
  #live = new Map<string, Live>();
  #closing = false;
  // Task-file failures already logged, so a broken file warns once, not on every list.
  #warned = new Set<string>();

  constructor(deps: RunManagerDeps) {
    this.#deps = deps;
    this.#git = deps.git ?? { createWorktree };
  }

  // No session survives a restart, so a run that was mid-turn reads interrupted. Every run
  // gets its session back, not started, with the saved transcript loaded.
  async start(): Promise<void> {
    const { runs, hub } = this.#deps;
    const stale = runs
      .runs()
      .filter((r) => r.status === "working" || r.status === "needs_you");
    await Promise.all(
      stale.map((r) =>
        runs.patchRun(r.id, { status: "interrupted", endedAt: null }),
      ),
    );
    if (stale.length > 0) hub.broadcast({ type: "runs.changed" });
    await Promise.all(
      runs
        .runs()
        .filter((r) => !this.#live.has(r.id))
        // A new session already reads idle, so restoring derives no status.
        .map(async (r) => {
          const live = this.#open(r);
          await live.session.restore();
          const said = live.session
            .transcript()
            .flatMap((e) =>
              e.kind === "assistant_text" && !e.partial ? [e.text] : [],
            );
          live.lastText = said.at(-1) ?? null;
        }),
    );
  }

  async launch(opts: LaunchOptions): Promise<RunRecord> {
    const { runs, hub, root } = this.#deps;
    const input = await this.#promptInput(opts.taskSlug);
    const { worktree, branch } = await this.#git.createWorktree(
      root,
      opts.taskSlug,
    );
    const record: RunRecord = {
      id: runs.newRunId(),
      taskSlug: opts.taskSlug,
      sessionId: "",
      // sessions.json is committed, so the path is relative to the root.
      worktree: relative(root, worktree),
      branch,
      status: "working",
      permissionMode: opts.permissionMode,
      prUrl: null,
      markedDone: false,
      failure: null,
      costUsd: 0,
      startedAt: now(),
      endedAt: null,
    };
    await runs.upsertRun(record);
    hub.broadcast({ type: "runs.changed" });
    this.#open(record).session.send(runPrompt({ ...input, branch }));
    return { ...record };
  }

  // A run that ended (done, failed, interrupted) resumes its saved session; with none to
  // resume, the text follows the run prompt so a fresh Claude knows its task.
  async message(runId: string, text: string): Promise<string> {
    const live = this.#liveFor(this.#record(runId));
    const prompt = await this.#freshPrompt(live);
    // Checked again: another send may have started the session during the await.
    const fresh = prompt !== null && this.#fresh(live);
    return live.session.send(fresh ? `${prompt}\n\n${text}` : text, text);
  }

  async stop(runId: string): Promise<void> {
    this.#record(runId);
    const live = this.#live.get(runId);
    if (!live) return;
    live.broker.cancelAll(INTERRUPTED_REASON);
    await live.session.interrupt();
  }

  // With no session to resume (none was saved, or it could not be loaded), the run starts
  // over from its full prompt so it still knows its task.
  async resume(runId: string): Promise<void> {
    const record = this.#interrupted(runId);
    const live = this.#liveFor(record);
    const prompt = await this.#freshPrompt(live);
    // Checked again: another resume may have started the run during the await.
    this.#interrupted(runId);
    live.session.send(prompt ?? CONTINUE);
  }

  // For a run the user finished by hand, say by merging without the PR URL Claude would
  // print. Only an idle run, so no turn in flight can undo it (ExistsError otherwise).
  async markDone(runId: string): Promise<void> {
    const record = this.#record(runId);
    if (record.status !== "idle")
      throw new ExistsError(`run ${runId} is ${record.status}, not idle`);
    const live = this.#liveFor(record);
    this.#patch(live, { markedDone: true });
    live.base = { status: "done" };
    this.#derive(live);
  }

  answerPermission(runId: string, id: string, d: PermissionDecision): boolean {
    return this.#live.get(runId)?.broker.answer(id, d) ?? false;
  }

  // Each run's record as this process holds it, ahead of the store's writes.
  records(): RunRecord[] {
    return this.#deps.runs
      .runs()
      .map((r) => ({ ...(this.#live.get(r.id)?.record ?? r) }));
  }

  // A task file that cannot be read leaves every title as its slug, not the list broken.
  async list(): Promise<RunView[]> {
    const tasks = await this.#deps.store.listTasks().catch((err) => {
      const message = String(err);
      if (!this.#warned.has(message)) {
        this.#warned.add(message);
        console.warn("could not read the task files for run titles", err);
      }
      return [];
    });
    const titles = new Map(tasks.map(({ task }) => [task.slug, task.title]));
    return this.records().map((r) => {
      const live = this.#live.get(r.id);
      return {
        ...r,
        worktree: this.#worktree(r),
        title: titles.get(r.taskSlug) ?? r.taskSlug,
        pending: live?.broker.pending() ?? [],
        lastText: live?.lastText ?? null,
      };
    });
  }

  transcript(runId: string): PanelEvent[] {
    this.#record(runId);
    return this.#live.get(runId)?.session.transcript() ?? [];
  }

  // Records keep their last status, so start() reads the active ones as interrupted.
  async close(): Promise<void> {
    this.#closing = true;
    await Promise.all(
      [...this.#live.values()].map((live) => {
        live.broker.cancelAll(INTERRUPTED_REASON);
        return live.session.close();
      }),
    );
  }

  #interrupted(runId: string): RunRecord {
    const record = this.#record(runId);
    if (record.status !== "interrupted")
      throw new ExistsError(
        `run ${runId} is ${record.status}, not interrupted`,
      );
    return record;
  }

  // No session id to resume and no turn in flight (a launch's first turn has no id until
  // the CLI reports one): the next send starts a Claude that knows nothing of the task.
  #fresh(live: Live): boolean {
    const { sessionId, status } = live.session;
    return !sessionId && status !== "starting" && status !== "working";
  }

  async #freshPrompt(live: Live): Promise<string | null> {
    if (!this.#fresh(live)) return null;
    const { taskSlug, branch } = live.record;
    return runPrompt({ ...(await this.#promptInput(taskSlug)), branch });
  }

  // What a run prompt is built from, besides the branch; NotFoundError for an unknown task.
  async #promptInput(taskSlug: string) {
    const { store } = this.#deps;
    const found = (await store.listTasks()).find(
      (t) => t.task.slug === taskSlug,
    );
    if (!found) throw new NotFoundError(`task ${taskSlug} not found`);
    return {
      task: found.task,
      taskFile: `.blueprint/tasks/${found.file}`,
      spec: (await store.readSpec()) ?? "",
    };
  }

  #record(runId: string): RunRecord {
    const record = this.#live.get(runId)?.record ?? this.#deps.runs.run(runId);
    if (!record) throw new NotFoundError(`run ${runId} not found`);
    return record;
  }

  // start() opened every saved run; this covers a manager that was never started.
  #liveFor(record: RunRecord): Live {
    return this.#live.get(record.id) ?? this.#open(record);
  }

  // The run's worktree as an absolute path; records saved absolute resolve to themselves.
  #worktree(record: RunRecord): string {
    return resolve(this.#deps.root, record.worktree);
  }

  #open(record: RunRecord): Live {
    const { hub, sdk } = this.#deps;
    const runId = record.id;
    const worktree = this.#worktree(record);
    let asked = new Set<string>();
    const broker = new PermissionBroker({
      cwd: worktree,
      onChange: (pending) => {
        if (this.#closing) return;
        for (const p of pending)
          if (!asked.has(p.id))
            hub.broadcast({
              type: "run.event",
              runId,
              event: { kind: "permission", ...p },
            });
        asked = new Set(pending.map((p) => p.id));
        this.#derive(live);
      },
    });
    const session = new PlanSession(
      {
        query: sdk.query,
        getSessionMessages: sdk.getSessionMessages,
        cwd: worktree,
        options: {
          systemPrompt: { type: "preset", preset: "claude_code" },
          permissionMode: record.permissionMode,
          // The SDK passes bypassPermissions on to the CLI only with this flag.
          allowDangerouslySkipPermissions:
            record.permissionMode === "bypassPermissions",
          hooks: {
            PreToolUse: [
              {
                matcher: "Write|Edit|MultiEdit|NotebookEdit",
                hooks: [
                  denyBoardWrites([this.#deps.root, worktree], BOARD_READ_ONLY),
                ],
              },
            ],
          },
          canUseTool: (tool, input, { signal, suggestions, toolUseID }) =>
            broker.ask({ toolUseID, tool, input, suggestions, signal }),
        },
        onEvent: (event) => {
          if (this.#closing) return;
          if (event.kind === "assistant_text" && !event.partial)
            live.turnText = live.lastText = event.text;
          if (event.kind === "result") {
            live.endedText = live.turnText;
            live.turnText = null;
          }
          // An error result reports what its process spent, as a result does.
          if (
            (event.kind === "result" || event.kind === "error") &&
            typeof event.costUsd === "number"
          )
            this.#patch(live, { costUsd: live.costBase + event.costUsd });
          hub.broadcast({ type: "run.event", runId, event });
        },
        onStatus: (status, message) => {
          if (this.#closing) return;
          // A new CLI process: its cost totals start from zero, and no turn text is ours yet.
          if (status === "starting") {
            live.costBase = live.record.costUsd;
            live.turnText = live.endedText = null;
          }
          live.base = this.#fromSession(live, status, message);
          this.#derive(live);
        },
        onSessionId: (sessionId) => this.#patch(live, { sessionId }),
      },
      record.sessionId || undefined,
    );
    const live: Live = {
      record: { ...record },
      session,
      broker,
      // A restored failed run keeps its reason until it runs again.
      base: { status: record.status, message: record.failure ?? undefined },
      turnText: null,
      endedText: null,
      lastText: null,
      costBase: record.costUsd,
    };
    this.#live.set(runId, live);
    return live;
  }

  #fromSession(live: Live, status: AgentStatus, message?: string): Derived {
    switch (status) {
      // Done sticks: a later turn with no URL, or a stop while the CLI starts, leaves a
      // run that opened its PR, or was marked done, done.
      case "idle":
      case "stopped": {
        const prUrl = prUrlIn(live.endedText ?? "") ?? live.record.prUrl;
        if (prUrl) return { status: "done", prUrl };
        return { status: live.record.markedDone ? "done" : "idle" };
      }
      case "error":
        return { status: "failed", message };
      default:
        return { status: "working" };
    }
  }

  // A waiting permission ask overrides the session; a change patches and broadcasts.
  #derive(live: Live): void {
    const next: Derived =
      live.broker.pending().length > 0 ? { status: "needs_you" } : live.base;
    const failure = next.status === "failed" ? (next.message ?? null) : null;
    if (next.status === live.record.status && failure === live.record.failure)
      return;
    const ended = next.status === "done" || next.status === "failed";
    this.#patch(live, {
      status: next.status,
      failure,
      endedAt: ended ? now() : null,
      ...(next.prUrl ? { prUrl: next.prUrl } : {}),
    });
    this.#deps.hub.broadcast({
      type: "run.status",
      runId: live.record.id,
      status: next.status,
      ...(next.message ? { message: next.message } : {}),
    });
  }

  #patch(live: Live, patch: Partial<RunRecord>): void {
    live.record = { ...live.record, ...patch };
    this.#deps.runs.patchRun(live.record.id, patch).then(
      // A write that lands after close() began tells no one: the sockets are going.
      () => this.#closing || this.#deps.hub.broadcast({ type: "runs.changed" }),
      (err) => console.error(`could not save run ${live.record.id}`, err),
    );
  }
}
