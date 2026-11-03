import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CanUseTool, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  ExistsError,
  FileStore,
  NotFoundError,
} from "../../../src/server/files.js";
import { RunManager } from "../../../src/server/runs/manager.js";
import { runPrompt } from "../../../src/server/runs/prompt.js";
import { RunStore } from "../../../src/server/runs/store.js";
import type { WsHub } from "../../../src/server/ws.js";
import type { ServerMessage } from "../../../src/shared/messages.js";
import type { Task } from "../../../src/shared/tasks.js";
import type { RunRecord } from "../../../src/shared/types.js";
import {
  type ErrorFixture,
  fakeQuery,
  init,
  type Script,
  sdk,
  textTurn,
  turnsOf,
} from "../agent/fakeSdk.js";

const PR = "https://github.com/acme/app/pull/7";

const task = (slug: string): Task => ({
  slug,
  title: `Build ${slug}`,
  body: `Body of ${slug}.`,
  dependsOn: [],
  files: [`src/${slug}.ts`],
  acceptance: [`${slug} works`],
  sources: [],
});

let root: string;
let store: FileStore;
let runs: RunStore;
let sent: ServerMessage[];
const hub = {
  broadcast: (msg: ServerMessage) => sent.push(msg),
} as unknown as WsHub;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-manager-"));
  store = new FileStore(root);
  await store.init();
  await store.replaceTasks([task("alpha"), task("beta")]);
  await writeFile(join(root, ".blueprint", "spec.md"), "# Spec\n\nThe spec.\n");
  runs = new RunStore(store);
  await runs.load();
  sent = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function setup(script: Script) {
  const { query, runs: queries } = fakeQuery(script);
  const git = {
    createWorktree: vi.fn(async (repo: string, slug: string) => ({
      worktree: join(repo, ".blueprint", "worktrees", slug),
      branch: `blueprint/${slug}`,
    })),
  };
  const manager = new RunManager({
    store,
    runs,
    hub,
    root,
    sdk: {
      query:
        query as unknown as typeof import("@anthropic-ai/claude-agent-sdk").query,
      getSessionMessages: vi.fn(async () => []),
    },
    git,
  });
  return { manager, query, queries, git };
}

const view = (manager: RunManager, id: string) =>
  manager.list().find((r) => r.id === id);
const statusesOf = (runId: string) =>
  sent.flatMap((m) =>
    m.type === "run.status" && m.runId === runId ? [m.status] : [],
  );
// The record on disk once every queued write has landed: what the manager holds now.
async function saved(manager: RunManager, id: string): Promise<RunRecord> {
  const {
    pending: _pending,
    lastText: _lastText,
    ...record
  } = view(manager, id) ?? {};
  await vi.waitFor(async () =>
    expect((await store.readSessions()).runs.find((r) => r.id === id)).toEqual(
      record,
    ),
  );
  return record as RunRecord;
}

// Holds every turn until released.
function gated() {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  return { gate, release: () => release() };
}

test("launch creates a worktree, a working record, and sends the run prompt", async () => {
  const { gate, release } = gated();
  const { manager, query, queries, git } = setup((_text, turn) =>
    (async function* () {
      if (turn === 0) yield init("sess-a");
      await gate;
      yield* textTurn("m", "working on it", "r");
    })(),
  );

  await expect(
    manager.launch({ taskSlug: "nope", permissionMode: "acceptEdits" }),
  ).rejects.toThrow(NotFoundError);
  expect(git.createWorktree).not.toHaveBeenCalled();

  const record = await manager.launch({
    taskSlug: "alpha",
    permissionMode: "bypassPermissions",
  });
  const worktree = join(root, ".blueprint", "worktrees", "alpha");
  expect(git.createWorktree).toHaveBeenCalledWith(root, "alpha");
  expect(record).toMatchObject({
    taskSlug: "alpha",
    worktree,
    branch: "blueprint/alpha",
    status: "working",
    prUrl: null,
    costUsd: 0,
    endedAt: null,
  });
  expect(record.id).toMatch(/^run_[0-9a-f]{6}$/);
  expect(sent).toContainEqual({ type: "runs.changed" });
  expect(query).toHaveBeenCalledTimes(1);

  const options = queries[0].options;
  expect(options).toMatchObject({
    cwd: worktree,
    permissionMode: "bypassPermissions",
    systemPrompt: { type: "preset", preset: "claude_code" },
  });
  expect(options?.systemPrompt).not.toHaveProperty("append");
  expect(options?.mcpServers).toBeUndefined();
  expect(options?.hooks?.PreToolUse).toHaveLength(1);
  expect(options?.canUseTool).toBeTypeOf("function");

  await vi.waitFor(() => expect(queries[0].read).toHaveLength(1));
  expect(queries[0].read[0]).toBe(
    runPrompt({
      task: task("alpha"),
      taskFile: ".blueprint/tasks/01-alpha.md",
      spec: "# Spec\n\nThe spec.\n",
      branch: "blueprint/alpha",
    }),
  );
  // The session id lands on the record once the CLI reports it.
  await vi.waitFor(() => expect(runs.run(record.id)?.sessionId).toBe("sess-a"));
  expect(view(manager, record.id)).toMatchObject({
    status: "working",
    pending: [],
  });
  release();
  await vi.waitFor(() => expect(view(manager, record.id)?.status).toBe("idle"));
  await manager.close();
});

test("a turn ending with a PR URL makes the run done with prUrl and cost; without one it is idle", async () => {
  const { manager, queries } = setup((text, turn) =>
    turnsOf(
      ...(turn === 0 ? [init(`sess-${turn}`)] : []),
      ...textTurn(
        `m${turn}`,
        text.includes("Body of alpha")
          ? `Opened the PR.\n${PR}\nAll done.`
          : "Pushed the branch; gh is not installed.",
        `r${turn}`,
      ),
    ),
  );

  const a = await manager.launch({
    taskSlug: "alpha",
    permissionMode: "acceptEdits",
  });
  await vi.waitFor(() => expect(view(manager, a.id)?.status).toBe("done"));
  expect(await saved(manager, a.id)).toMatchObject({
    status: "done",
    prUrl: PR,
    costUsd: 0.01,
    endedAt: expect.any(String),
  });
  expect(view(manager, a.id)?.lastText).toBe(
    `Opened the PR.\n${PR}\nAll done.`,
  );
  expect(statusesOf(a.id)).toEqual(["done"]);

  const b = await manager.launch({
    taskSlug: "beta",
    permissionMode: "acceptEdits",
  });
  await vi.waitFor(() => expect(view(manager, b.id)?.status).toBe("idle"));
  expect(await saved(manager, b.id)).toMatchObject({
    status: "idle",
    prUrl: null,
    costUsd: 0.01,
    endedAt: null,
  });

  // A done run takes another message: it works again, then ends with no PR in that turn.
  await manager.message(a.id, "also fix the typo");
  await vi.waitFor(() =>
    expect(statusesOf(a.id)).toEqual(["done", "working", "idle"]),
  );
  expect(await saved(manager, a.id)).toMatchObject({
    prUrl: PR,
    endedAt: null,
  });
  expect(queries).toHaveLength(2);
  await expect(manager.message("run_000000", "hi")).rejects.toThrow(
    NotFoundError,
  );
  await manager.close();
});

test("an error result fails the run with the message", async () => {
  const { manager, queries } = setup((text) =>
    text === "try again"
      ? turnsOf(init("sess-e"), {
          ...(textTurn("m2", "", "r2").at(-1) as SDKMessage),
        })
      : turnsOf(
          init("sess-e"),
          // A PR URL from the failed turn must not make a later turn done.
          ...textTurn("m1", PR, "unused").slice(0, -1),
          sdk({
            type: "result",
            subtype: "error_during_execution",
            session_id: "sess-e",
            uuid: "r-err",
            is_error: true,
            num_turns: 1,
            duration_ms: 5,
            total_cost_usd: 0.02,
            errors: ["the tool crashed"],
          } satisfies ErrorFixture),
        ),
  );

  const run = await manager.launch({
    taskSlug: "alpha",
    permissionMode: "acceptEdits",
  });
  await vi.waitFor(() => expect(view(manager, run.id)?.status).toBe("failed"));
  expect(sent).toContainEqual({
    type: "run.status",
    runId: run.id,
    status: "failed",
    message: "the tool crashed",
  });
  expect(await saved(manager, run.id)).toMatchObject({
    status: "failed",
    endedAt: expect.any(String),
  });

  // A failed run takes a message: a new process resumes it, and a turn with no text is idle.
  await manager.message(run.id, "try again");
  await vi.waitFor(() =>
    expect(statusesOf(run.id)).toEqual(["failed", "working", "idle"]),
  );
  expect(queries[1].options?.resume).toBe("sess-e");
  expect(await saved(manager, run.id)).toMatchObject({
    status: "idle",
    prUrl: null,
    endedAt: null,
  });
  await manager.close();
});

test("permission asks mark the run needs_you and stop cancels them", async () => {
  const { gate, release } = gated();
  const { manager, queries } = setup((_text, turn) =>
    (async function* () {
      if (turn === 0) yield init("sess-p");
      await gate;
      yield* textTurn("m", "stopped", "r");
    })(),
  );

  const run = await manager.launch({
    taskSlug: "alpha",
    permissionMode: "default",
  });
  await vi.waitFor(() => expect(runs.run(run.id)?.sessionId).toBe("sess-p"));
  // The SDK asks, as the CLI would for a tool the mode does not allow.
  const canUseTool = queries[0].options?.canUseTool as CanUseTool;
  const answer = canUseTool(
    "Bash",
    { command: "rm -rf build" },
    {
      signal: new AbortController().signal,
      toolUseID: "tool-1",
      requestId: "req-1",
    },
  );

  await vi.waitFor(() =>
    expect(view(manager, run.id)?.status).toBe("needs_you"),
  );
  expect(view(manager, run.id)?.pending).toMatchObject([
    { id: "tool-1", tool: "Bash" },
  ]);
  expect(sent).toContainEqual({
    type: "run.event",
    runId: run.id,
    event: expect.objectContaining({ kind: "permission", id: "tool-1" }),
  });
  expect((await saved(manager, run.id))?.status).toBe("needs_you");
  expect(manager.answerPermission(run.id, "nope", { behavior: "allow" })).toBe(
    false,
  );

  await manager.stop(run.id);
  expect(await answer).toEqual({ behavior: "deny", message: "interrupted" });
  expect(queries[0].interrupt).toHaveBeenCalled();
  expect(view(manager, run.id)?.pending).toEqual([]);
  release();
  await vi.waitFor(() => expect(view(manager, run.id)?.status).toBe("idle"));
  expect(statusesOf(run.id)).toEqual(["needs_you", "working", "idle"]);
  await manager.close();
});

test("events and statuses carry the run id for two concurrent runs", async () => {
  const { manager, queries } = setup((text) => {
    const slug = text.includes("Body of alpha") ? "alpha" : "beta";
    return turnsOf(
      init(`sess-${slug}`),
      ...textTurn(`m-${slug}`, `did ${slug}`, `r-${slug}`),
    );
  });

  const [a, b] = await Promise.all([
    manager.launch({ taskSlug: "alpha", permissionMode: "acceptEdits" }),
    manager.launch({ taskSlug: "beta", permissionMode: "acceptEdits" }),
  ]);
  await vi.waitFor(() => {
    expect(view(manager, a.id)?.status).toBe("idle");
    expect(view(manager, b.id)?.status).toBe("idle");
  });
  expect(queries).toHaveLength(2);

  const finalTexts = (runId: string) =>
    sent.flatMap((m) =>
      m.type === "run.event" &&
      m.runId === runId &&
      m.event.kind === "assistant_text" &&
      !m.event.partial
        ? [m.event.text]
        : [],
    );
  expect(finalTexts(a.id)).toEqual(["did alpha"]);
  expect(finalTexts(b.id)).toEqual(["did beta"]);
  expect(manager.transcript(a.id).map((e) => e.kind)).toEqual([
    "user",
    "assistant_text",
    "result",
  ]);
  expect(statusesOf(a.id)).toEqual(["idle"]);
  expect(statusesOf(b.id)).toEqual(["idle"]);
  expect(runs.run(a.id)?.sessionId).toBe("sess-alpha");
  expect(runs.run(b.id)?.sessionId).toBe("sess-beta");
  expect(() => manager.transcript("run_000000")).toThrow(NotFoundError);
  await manager.close();
});

test("start marks active records interrupted and resume continues the saved session id in the worktree", async () => {
  const record = (id: string, status: RunRecord["status"]): RunRecord => ({
    id,
    taskSlug: "alpha",
    sessionId: `sess-${id}`,
    worktree: `/w/${id}`,
    branch: "blueprint/alpha",
    status,
    prUrl: null,
    costUsd: 0.5,
    startedAt: "2026-11-02T00:00:00.000Z",
    endedAt: status === "done" ? "2026-11-02T01:00:00.000Z" : null,
  });
  await store.writeSessions({
    plan: null,
    runs: [
      record("run_aaaaaa", "working"),
      record("run_bbbbbb", "needs_you"),
      record("run_cccccc", "done"),
    ],
  });
  await runs.load();
  const { manager, queries } = setup(() =>
    turnsOf(...textTurn("m", "picked it back up", "r")),
  );

  await manager.start();
  expect(manager.list().map((r) => [r.id, r.status, r.endedAt])).toEqual([
    ["run_aaaaaa", "interrupted", null],
    ["run_bbbbbb", "interrupted", null],
    ["run_cccccc", "done", "2026-11-02T01:00:00.000Z"],
  ]);
  expect((await saved(manager, "run_aaaaaa"))?.status).toBe("interrupted");
  expect(sent).toContainEqual({ type: "runs.changed" });

  await expect(manager.resume("run_cccccc")).rejects.toThrow(ExistsError);
  await expect(manager.resume("run_000000")).rejects.toThrow(NotFoundError);

  await manager.resume("run_aaaaaa");
  expect(queries).toHaveLength(1);
  expect(queries[0].options).toMatchObject({
    cwd: "/w/run_aaaaaa",
    resume: "sess-run_aaaaaa",
    permissionMode: "acceptEdits",
  });
  await vi.waitFor(() =>
    expect(queries[0].read).toEqual(["Continue the task where you left off."]),
  );
  await vi.waitFor(() =>
    expect(view(manager, "run_aaaaaa")?.status).toBe("idle"),
  );
  expect(statusesOf("run_aaaaaa")).toEqual(["working", "idle"]);
  // The resumed process counts from zero, so its total adds to what the run had spent.
  expect((await saved(manager, "run_aaaaaa"))?.costUsd).toBeCloseTo(0.51);
  await manager.close();
});
