import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Options,
  PermissionResult,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { type Agent, createAgent } from "../../src/server/agent/index.js";
import { compileMessage } from "../../src/server/agent/prompt.js";
import {
  ProposalBusyError,
  ProposalStore,
} from "../../src/server/agent/proposals.js";
import { createApp } from "../../src/server/app.js";
import { FileStore, NotFoundError } from "../../src/server/files.js";
import { RunStore } from "../../src/server/runs/store.js";
import { WsHub } from "../../src/server/ws.js";
import type { ServerMessage } from "../../src/shared/messages.js";
import type { Proposal } from "../../src/shared/proposals.js";
import type { Task } from "../../src/shared/tasks.js";
import type { RunRecord } from "../../src/shared/types.js";

let root: string;
let store: FileStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-agent-routes-"));
  store = new FileStore(root);
  await store.init();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const post = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

const proposal = (id: string, title: string | null = "Cache"): Proposal => ({
  id,
  board: "main",
  title,
  ops: [{ op: "add_note", text: "hello" }],
  at: "2026-11-02T00:00:00.000Z",
});

function fakeAgent() {
  return {
    send: vi.fn(
      async (
        _text: string,
        _selection?: { board: string; ids: string[] },
        proposalId?: string,
      ) => {
        if (proposalId === "p_9")
          throw new NotFoundError("proposal p_9 is not pending");
        return "u1";
      },
    ),
    proposals: new ProposalStore(store),
    pendingProposals: vi.fn(() => [proposal("p_1")]),
    decideProposal: vi.fn(async (id: string) => {
      if (id === "p_1") return proposal("p_1");
      if (id === "p_2")
        throw new ProposalBusyError("proposal p_2 is being revised");
      throw new NotFoundError(`proposal ${id} is not pending`);
    }),
    compile: vi.fn(async () => "u2"),
    split: vi.fn(async () => undefined),
    interrupt: vi.fn(async () => undefined),
    answerPermission: vi.fn((id: string) => id === "p1"),
    state: vi.fn(() => ({
      status: "idle" as const,
      sessionId: "s1",
      transcript: [],
      pending: [],
      splitting: false,
    })),
    close: vi.fn(async () => undefined),
  } satisfies Agent;
}

test("send returns 202 with the id and rejects empty text with 400", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);
  const selection = { board: "main", ids: ["r1"] };

  const ok = await app.request(
    "/api/agent/send",
    post({ text: "hi", selection }),
  );
  expect(ok.status).toBe(202);
  expect(await ok.json()).toEqual({ id: "u1" });
  expect(agent.send).toHaveBeenCalledWith("hi", selection, undefined);

  for (const body of [{ text: "" }, { text: "  \n" }, {}, { text: 3 }]) {
    const res = await app.request("/api/agent/send", post(body));
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  }
  const badSelection = await app.request(
    "/api/agent/send",
    post({ text: "hi", selection: { board: "main" } }),
  );
  expect(badSelection.status).toBe(400);
  expect(agent.send).toHaveBeenCalledTimes(1);
});

test("send forwards proposalId and 404s when it is not pending", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);

  const ok = await app.request(
    "/api/agent/send",
    post({ text: "tighter", proposalId: "p_1" }),
  );
  expect(ok.status).toBe(202);
  expect(agent.send).toHaveBeenCalledWith("tighter", undefined, "p_1");

  const gone = await app.request(
    "/api/agent/send",
    post({ text: "tighter", proposalId: "p_9" }),
  );
  expect(gone.status).toBe(404);
  expect(await gone.json()).toEqual({ error: "proposal p_9 is not pending" });

  const bad = await app.request(
    "/api/agent/send",
    post({ text: "tighter", proposalId: 9 }),
  );
  expect(bad.status).toBe(400);
});

test("proposal routes list pending proposals and record decisions", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);

  const list = await app.request("/api/agent/proposals");
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual([proposal("p_1")]);

  const decision = (id: string, body: unknown) =>
    app.request(`/api/agent/proposals/${id}/decision`, post(body));
  const ok = await decision("p_1", { decision: "accepted" });
  expect(ok.status).toBe(204);
  expect(agent.decideProposal).toHaveBeenCalledWith("p_1", "accepted");

  const gone = await decision("p_9", { decision: "rejected" });
  expect(gone.status).toBe(404);
  expect(await gone.json()).toEqual({ error: "proposal p_9 is not pending" });

  const busy = await decision("p_2", { decision: "accepted" });
  expect(busy.status).toBe(409);
  expect(await busy.json()).toEqual({
    error: "proposal p_2 is being revised",
  });

  for (const body of [{ decision: "maybe" }, {}, "accepted"]) {
    const res = await decision("p_1", body);
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  }
  expect(agent.decideProposal).toHaveBeenCalledTimes(3);
});

test("permission answers map to the broker and unknown ids are 404", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);

  const ok = await app.request(
    "/api/agent/permission",
    post({ id: "p1", behavior: "deny", message: "not now" }),
  );
  expect(ok.status).toBe(204);
  expect(agent.answerPermission).toHaveBeenCalledWith("p1", {
    behavior: "deny",
    message: "not now",
  });

  const unknown = await app.request(
    "/api/agent/permission",
    post({ id: "p2", behavior: "allow" }),
  );
  expect(unknown.status).toBe(404);
  expect(await unknown.json()).toHaveProperty("error");

  const bad = await app.request(
    "/api/agent/permission",
    post({ id: "p1", behavior: "maybe" }),
  );
  expect(bad.status).toBe(400);
  expect(agent.answerPermission).toHaveBeenCalledTimes(2);
});

test("state is returned as JSON and interrupt returns 204", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);

  const state = await app.request("/api/agent/state");
  expect(state.status).toBe(200);
  expect(await state.json()).toEqual({
    status: "idle",
    sessionId: "s1",
    transcript: [],
    pending: [],
    splitting: false,
  });

  const interrupt = await app.request("/api/agent/interrupt", post({}));
  expect(interrupt.status).toBe(204);
  expect(agent.interrupt).toHaveBeenCalledOnce();
});

test("POST /api/agent/compile returns 202 with the id", async () => {
  const agent = fakeAgent();
  const app = createApp(store, agent);

  const res = await app.request("/api/agent/compile", post({}));
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ id: "u2" });
  expect(agent.compile).toHaveBeenCalledOnce();
});

test("without an agent the routes are absent (404 JSON)", async () => {
  const app = createApp(store);
  for (const [path, init] of [
    ["/api/agent/state", undefined],
    ["/api/agent/send", post({ text: "hi" })],
  ] as const) {
    const res = await app.request(path, init);
    expect(res.status, path).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  }
});

// A fake SDK whose query, on the first user message, reports a session and then asks to run
// Bash, staying open (like the real streaming query) until it is closed.
function fakeSdk(saved: unknown[] = []) {
  const log: string[] = [];
  // Set by the test so interrupt() can record what the agent had settled by then.
  const hooks = { onInterrupt: () => "" };
  const received: string[] = [];
  let options: Options | undefined;
  let ask: Promise<PermissionResult | null> | undefined;
  const query = vi.fn(
    (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => {
      options = params.options;
      const abort = new AbortController();
      let closed = () => {};
      const done = new Promise<void>((resolve) => {
        closed = resolve;
      });
      async function* run(): AsyncGenerator<SDKMessage> {
        for await (const m of params.prompt) {
          received.push(m.message.content as string);
          yield {
            type: "system",
            subtype: "init",
            session_id: "s1",
          } as SDKMessage;
          ask = params.options?.canUseTool?.(
            "Bash",
            { command: "ls" },
            {
              signal: abort.signal,
              suggestions: [],
              toolUseID: "tu1",
              requestId: "r1",
            },
          );
          await ask;
          await done;
          return;
        }
      }
      return Object.assign(run(), {
        interrupt: vi.fn(async () => {
          log.push(`interrupt ${hooks.onInterrupt()}`);
        }),
        close: vi.fn(() => {
          abort.abort();
          closed();
        }),
      });
    },
  );
  const getSessionMessages = vi.fn(async () => saved);
  return {
    sdk: { query, getSessionMessages } as unknown as Parameters<
      typeof createAgent
    >[0]["sdk"],
    query,
    log,
    hooks,
    received,
    options: () => options,
    ask: () => ask,
  };
}

test("createAgent: interrupt cancels pending permission asks before interrupting the session", async () => {
  const hub = new WsHub();
  const sent: ServerMessage[] = [];
  hub.add({ send: (data) => sent.push(JSON.parse(data)) });
  const fake = fakeSdk();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const agent = await createAgent({
    store,
    hub,
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  // Lazy: nothing runs before the first send.
  expect(fake.query).not.toHaveBeenCalled();
  expect(agent.state()).toEqual({
    status: "idle",
    transcript: [],
    pending: [],
    splitting: false,
  });

  // A selection on a missing board is dropped with a warning; the text still goes.
  await agent.send("list files", { board: "nope", ids: ["r1"] });
  expect(warn).toHaveBeenCalled();
  await vi.waitFor(() => expect(agent.state().pending).toHaveLength(1));
  expect(fake.received).toEqual(["list files"]);

  const opts = fake.options();
  expect(opts).toMatchObject({
    cwd: root,
    permissionMode: "default",
    systemPrompt: { type: "preset", preset: "claude_code" },
    hooks: {
      PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit" }],
    },
  });
  expect(opts?.mcpServers).toHaveProperty("blueprint");
  expect(opts?.resume).toBeUndefined();
  // Blueprint's own read-only tools skip the dialog; a look-alike from config does not.
  const check = (source: string) =>
    opts?.canUseTool?.(
      "mcp__blueprint__get_selection",
      {},
      {
        signal: new AbortController().signal,
        toolUseID: `own-${source}`,
        requestId: "r2",
        mcpServer: { name: "blueprint", source },
      },
    );
  expect(await check("sdk")).toEqual({ behavior: "allow" });
  void check("project");
  expect(agent.state().pending.map((p) => p.id)).toEqual([
    "tu1",
    "own-project",
  ]);
  agent.answerPermission("own-project", { behavior: "deny" });

  expect(agent.state()).toMatchObject({
    status: "needs_you",
    sessionId: "s1",
    pending: [{ id: "tu1", tool: "Bash", summary: "running ls" }],
  });
  expect(sent).toContainEqual({
    type: "agent.event",
    event: expect.objectContaining({ kind: "permission", id: "tu1" }),
  });
  expect(sent).toContainEqual({ type: "agent.status", status: "needs_you" });
  await vi.waitFor(async () =>
    expect((await store.readSessions()).plan?.sessionId).toBe("s1"),
  );

  fake.hooks.onInterrupt = () => `pending=${agent.state().pending.length}`;
  await agent.interrupt();
  expect(fake.log).toEqual(["interrupt pending=0"]);
  expect(await fake.ask()).toEqual({
    behavior: "deny",
    message: "interrupted",
  });
  expect(agent.state()).toMatchObject({ status: "working", pending: [] });
  expect(sent.at(-1)).toEqual({ type: "agent.status", status: "working" });

  await agent.close();
  expect(agent.state().status).toBe("stopped");
  warn.mockRestore();
});

test("createAgent resumes the saved plan session and composes the selection header", async () => {
  const run: RunRecord = {
    id: "run_abc123",
    taskSlug: "auth",
    sessionId: "r1",
    worktree: join(root, ".blueprint", "worktrees", "auth"),
    branch: "blueprint/auth",
    status: "done",
    permissionMode: "acceptEdits",
    prUrl: null,
    markedDone: false,
    failure: null,
    costUsd: 0.5,
    startedAt: "2026-11-01T00:00:00.000Z",
    endedAt: "2026-11-01T00:10:00.000Z",
  };
  await store.writeSessions({
    plan: { sessionId: "old", updatedAt: "2026-11-01T00:00:00.000Z" },
    runs: [run],
  });
  await store.createBoard("main");
  await store.writeBoard("main", {
    elements: [
      { id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
    ],
    appState: {},
    files: {},
  });
  const fake = fakeSdk([
    {
      type: "user",
      uuid: "m1",
      session_id: "old",
      parent_tool_use_id: null,
      message: { role: "user", content: "first question" },
    },
  ]);
  const runs = new RunStore(store);
  const setPlanSession = vi.spyOn(runs, "setPlanSession");
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs,
    sdk: fake.sdk,
  });

  expect(agent.state()).toMatchObject({
    status: "idle",
    sessionId: "old",
    transcript: [{ kind: "user", id: "m1", text: "first question" }],
  });
  expect(fake.query).not.toHaveBeenCalled();

  await agent.send("describe this", { board: "main", ids: ["r1"] });
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  expect(fake.received[0]).toBe(
    '[Selection on board "main": r1 box ""]\n\ndescribe this',
  );
  expect(fake.options()?.resume).toBe("old");
  // The new plan session id is saved through the run store, keeping the runs.
  await vi.waitFor(async () =>
    expect(await store.readSessions()).toMatchObject({
      plan: { sessionId: "s1" },
      runs: [run],
    }),
  );
  expect(setPlanSession).toHaveBeenCalledWith("s1");
  expect(runs.run(run.id)).toEqual(run);
  await agent.close();
});

test("createAgent survives a corrupt sessions.json and reports it until the first send", async () => {
  await writeFile(join(store.dir, "sessions.json"), "{not json");
  const fake = fakeSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  const app = createApp(store, agent);

  const res = await app.request("/api/agent/state");
  expect(res.status).toBe(200);
  const state = await res.json();
  expect(state).toMatchObject({ status: "error", transcript: [] });
  expect(state.message).toMatch(
    /^sessions\.json could not be read: .+\. Fix or delete \.blueprint\/sessions\.json\.$/,
  );

  // The first send starts fresh and overwrites the file with the new session id.
  await agent.send("hi");
  expect(agent.state().status).not.toBe("error");
  await vi.waitFor(async () =>
    expect((await store.readSessions()).plan?.sessionId).toBe("s1"),
  );
  expect(fake.options()?.resume).toBeUndefined();
  await agent.close();
});

// A fake SDK that answers every user message with a successful turn, so sends run in order.
function echoSdk() {
  const received: string[] = [];
  let options: Options | undefined;
  const query = vi.fn(
    (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => {
      options = params.options;
      async function* run(): AsyncGenerator<SDKMessage> {
        for await (const m of params.prompt) {
          received.push(m.message.content as string);
          yield {
            type: "system",
            subtype: "init",
            session_id: "s1",
          } as SDKMessage;
          yield {
            type: "result",
            subtype: "success",
            session_id: "s1",
            uuid: `r${received.length}`,
            is_error: false,
            num_turns: 1,
            result: "ok",
            total_cost_usd: 0,
            duration_ms: 1,
          } as SDKMessage;
        }
      }
      return Object.assign(run(), { interrupt: vi.fn(), close: vi.fn() });
    },
  );
  return {
    sdk: {
      query,
      getSessionMessages: vi.fn(async () => []),
    } as unknown as Parameters<typeof createAgent>[0]["sdk"],
    query,
    received,
    options: () => options,
  };
}

const logLine = (p: Proposal) =>
  `${JSON.stringify({ event: "proposed", at: p.at, proposal: p })}\n`;

// The session id is saved in the background; waits so it lands before the directory is removed.
const sessionSaved = () =>
  vi.waitFor(async () =>
    expect((await store.readSessions()).plan?.sessionId).toBe("s1"),
  );

test("createAgent prefixes decision notes and refine requests to the next message", async () => {
  await writeFile(
    join(store.dir, "proposals.jsonl"),
    logLine(proposal("p_1")) + logLine(proposal("p_2", null)),
  );
  const fake = echoSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  expect(agent.pendingProposals().map((p) => p.id)).toEqual(["p_1", "p_2"]);

  expect(await agent.decideProposal("p_1", "accepted")).toEqual(
    proposal("p_1"),
  );
  expect(agent.pendingProposals().map((p) => p.id)).toEqual(["p_2"]);
  expect(await store.readProposals()).toMatchObject([
    { event: "proposed" },
    { event: "proposed" },
    { event: "accepted", id: "p_1" },
  ]);
  await expect(agent.decideProposal("p_1", "rejected")).rejects.toThrow(
    new NotFoundError("proposal p_1 is not pending"),
  );

  await agent.send("ok");
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  expect(fake.received[0]).toBe('[Proposal p_1 "Cache" was accepted.]\n\nok');
  // The bubble shows what the user typed, not the notes.
  expect(agent.state().transcript.at(0)).toMatchObject({
    kind: "user",
    text: "ok",
  });

  await agent.send("tighter", undefined, "p_2");
  await vi.waitFor(() => expect(fake.received).toHaveLength(2));
  expect(fake.received[1]).toBe(
    `[The user wants proposal p_2 refined. Call revise with proposalId p_2 and the complete new op list. Its current ops are: ${JSON.stringify(proposal("p_2").ops)}]\n\ntighter`,
  );
  expect(fake.received[1]).toMatch(/call revise with proposalId p_2/i);

  // A refine of a proposal no longer pending is refused, and keeps the notes for the next send.
  await agent.decideProposal("p_2", "rejected");
  await expect(agent.send("again", undefined, "p_2")).rejects.toThrow(
    new NotFoundError("proposal p_2 is not pending"),
  );
  await expect(agent.send("again", undefined, "p_9")).rejects.toBeInstanceOf(
    NotFoundError,
  );
  await agent.send("next");
  await vi.waitFor(() => expect(fake.received).toHaveLength(3));
  expect(fake.received[2]).toBe("[Proposal p_2 was rejected.]\n\nnext");
  await agent.close();
});

// A fake SDK whose first turn waits until it is interrupted; later turns answer at once.
function stallingSdk() {
  const received: string[] = [];
  const query = vi.fn(
    (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => {
      let release: () => void = () => {};
      async function* run(): AsyncGenerator<SDKMessage> {
        for await (const m of params.prompt) {
          received.push(m.message.content as string);
          yield {
            type: "system",
            subtype: "init",
            session_id: "s1",
          } as SDKMessage;
          if (received.length === 1)
            await new Promise<void>((r) => {
              release = r;
            });
          yield {
            type: "result",
            subtype: "success",
            session_id: "s1",
            uuid: `r${received.length}`,
            is_error: false,
            num_turns: 1,
            result: "ok",
            total_cost_usd: 0,
            duration_ms: 1,
          } as SDKMessage;
        }
      }
      return Object.assign(run(), {
        interrupt: vi.fn(async () => release()),
        close: vi.fn(),
      });
    },
  );
  return {
    sdk: {
      query,
      getSessionMessages: vi.fn(async () => []),
    } as unknown as Parameters<typeof createAgent>[0]["sdk"],
    received,
  };
}

test("decision notes on a send that Stop drops ride on the next send instead", async () => {
  await writeFile(
    join(store.dir, "proposals.jsonl"),
    logLine(proposal("p_1")) + logLine(proposal("p_2", null)),
  );
  const fake = stallingSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  await agent.send("first");
  await vi.waitFor(() => expect(agent.state().status).toBe("working"));
  await agent.decideProposal("p_1", "accepted");
  // Held behind the first turn, with the note.
  await agent.send("second");
  await agent.interrupt();
  await vi.waitFor(() => expect(agent.state().status).toBe("idle"));
  await agent.decideProposal("p_2", "rejected");

  await agent.send("third");
  await vi.waitFor(() => expect(fake.received).toHaveLength(2));
  expect(fake.received).toEqual([
    "first",
    '[Proposal p_1 "Cache" was accepted.]\n\n[Proposal p_2 was rejected.]\n\nthird',
  ]);
  await agent.close();
});

test("decision notes on a send the session throws on ride on the next send", async () => {
  await writeFile(join(store.dir, "proposals.jsonl"), logLine(proposal("p_1")));
  const fake = echoSdk();
  fake.query.mockImplementationOnce(() => {
    throw new Error("spawn failed");
  });
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  await agent.decideProposal("p_1", "accepted");
  await expect(agent.send("lost")).rejects.toThrow("spawn failed");
  await agent.send("kept");
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  expect(fake.received[0]).toBe('[Proposal p_1 "Cache" was accepted.]\n\nkept');
  await agent.close();
});

test("compile sends the instruction once while one is pending", async () => {
  await writeFile(join(store.dir, "proposals.jsonl"), logLine(proposal("p_1")));
  await store.createDoc("api");
  await store.writeDoc("api", "# API & Auth\n");
  const message = compileMessage([
    { file: "api.md", markdown: "# API & Auth\n" },
  ]);
  expect(message).toContain("api.md: api--auth");
  const fake = stallingSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  await agent.decideProposal("p_1", "accepted");

  const [id, racing] = await Promise.all([agent.compile(), agent.compile()]);
  expect(racing).toBe(id);
  expect(await agent.compile()).toBe(id);
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  // Notes ride along, as on any send; the bubble shows the short label.
  expect(fake.received[0]).toBe(
    `[Proposal p_1 "Cache" was accepted.]\n\n${message}`,
  );
  const users = () => agent.state().transcript.filter((e) => e.kind === "user");
  expect(users()).toEqual([
    expect.objectContaining({ id, text: "Compile the plan into spec.md" }),
  ]);

  // The stalled turn ends with a result; the next compile sends again.
  await agent.interrupt();
  await vi.waitFor(() => expect(agent.state().status).toBe("idle"));
  const again = await agent.compile();
  expect(again).not.toBe(id);
  await vi.waitFor(() => expect(fake.received).toHaveLength(2));
  expect(fake.received[1]).toBe(message);
  expect(users()).toHaveLength(2);
  await sessionSaved();
  await agent.close();
});

test("compile writes every board's export before the send and skips a board that fails to parse", async () => {
  await store.createBoard("main");
  await store.writeBoard("main", {
    elements: [
      { id: "r1", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
    ],
    appState: {},
    files: {},
  });
  await writeFile(join(store.dir, "boards", "broken.excalidraw.json"), "{");
  const exportPath = join(store.dir, "export", "boards", "main.md");
  await expect(readFile(exportPath, "utf8")).rejects.toThrow(/ENOENT/);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fake = echoSdk();
  const inner = echoSdk();
  let exported: string | undefined;
  fake.query.mockImplementationOnce((params) => {
    exported = readFileSync(exportPath, "utf8");
    return inner.query(params);
  });
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  await agent.compile();
  expect(exported).toContain("r1");
  await vi.waitFor(() => expect(inner.received).toHaveLength(1));
  await sessionSaved();
  expect(warn).toHaveBeenCalledWith(
    expect.stringMatching(/^skipping board broken in the compile: /),
  );
  await expect(
    readFile(join(store.dir, "export", "boards", "broken.md"), "utf8"),
  ).rejects.toThrow(/ENOENT/);
  await agent.close();
  warn.mockRestore();
});

test("compile skips a doc it cannot read, with a warning, and sends the rest", async () => {
  await store.createDoc("api");
  await store.writeDoc("api", "# API\n");
  // Listed like a doc, but reading it fails.
  await mkdir(join(store.dir, "docs", "broken.md"));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fake = echoSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  await agent.compile();
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  expect(fake.received[0]).toBe(
    compileMessage([{ file: "api.md", markdown: "# API\n" }]),
  );
  expect(warn).toHaveBeenCalledWith(
    expect.stringMatching(/^skipping doc broken in the compile: /),
  );
  await sessionSaved();
  await agent.close();
  warn.mockRestore();
});

test("a failed compile does not clear a newer one", async () => {
  const fake = stallingSdk();
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const listDocs = vi
    .spyOn(store, "listDocs")
    .mockImplementationOnce(async () => {
      await gate;
      throw new Error("docs unreadable");
    });

  const first = agent.compile();
  await vi.waitFor(() => expect(listDocs).toHaveBeenCalled());
  // Stopping clears the compile still gathering its docs, so a new one can start.
  await agent.close();
  const id = await agent.compile();
  await vi.waitFor(() => expect(fake.received).toHaveLength(1));
  release();
  await expect(first).rejects.toThrow("docs unreadable");

  expect(await agent.compile()).toBe(id);
  expect(fake.received).toHaveLength(1);
  await sessionSaved();
  await agent.close();
});

test("a compile whose send throws or whose run ends without a result can be sent again", async () => {
  const query = vi.fn(() =>
    Object.assign(
      (async function* (): AsyncGenerator<SDKMessage> {
        yield {
          type: "system",
          subtype: "init",
          session_id: "s1",
        } as SDKMessage;
        throw new Error("crashed");
      })(),
      { interrupt: vi.fn(), close: vi.fn() },
    ),
  );
  query.mockImplementationOnce(() => {
    throw new Error("spawn failed");
  });
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: {
      query,
      getSessionMessages: vi.fn(async () => []),
    } as unknown as Parameters<typeof createAgent>[0]["sdk"],
  });

  await expect(agent.compile()).rejects.toThrow("spawn failed");
  const id = await agent.compile();
  await vi.waitFor(() => expect(agent.state().status).toBe("error"));
  expect(await agent.compile()).not.toBe(id);
  expect(query).toHaveBeenCalledTimes(3);
  await sessionSaved();
  await agent.close();
});

// A hub with one browser tab that has board main open and draws every proposal it is sent.
function tabHub() {
  const hub = new WsHub();
  const tab = {
    send(data: string) {
      const msg = JSON.parse(data);
      if (msg.type === "request")
        queueMicrotask(() =>
          hub.handle(
            tab,
            JSON.stringify({
              type: "response",
              id: msg.id,
              ok: true,
              payload: { elementIds: ["n1"] },
            }),
          ),
        );
    },
  };
  hub.add(tab);
  hub.handle(
    tab,
    JSON.stringify({ type: "selection.changed", board: "main", ids: [] }),
  );
  return hub;
}

// Calls the propose tool the agent handed the SDK, as Claude would.
async function proposeNote(fake: ReturnType<typeof echoSdk>) {
  // The SDK only exposes the live McpServer, whose registry is private.
  const server = fake.options()?.mcpServers?.blueprint as unknown as {
    instance: {
      _registeredTools: Record<
        string,
        { handler(args: unknown, extra: unknown): Promise<unknown> }
      >;
    };
  };
  await server.instance._registeredTools.propose.handler(
    { ops: [{ op: "add_note", text: "hello" }] },
    {},
  );
}

test("createAgent survives a corrupt proposals.jsonl: reports it, starts with nothing pending, and still appends", async () => {
  await store.createBoard("main");
  await writeFile(
    join(store.dir, "proposals.jsonl"),
    `${logLine(proposal("p_1"))}{not json\n`,
  );
  const fake = echoSdk();
  const agent = await createAgent({
    store,
    hub: tabHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  expect(agent.state()).toMatchObject({ status: "error" });
  expect(agent.state().message).toMatch(
    /^proposals\.jsonl could not be read: proposals\.jsonl line 2: .+\. Fix or delete \.blueprint\/proposals\.jsonl\.$/,
  );
  expect(agent.pendingProposals()).toEqual([]);

  await agent.send("hi");
  expect(agent.state().status).not.toBe("error");
  await proposeNote(fake);
  expect(agent.pendingProposals()).toHaveLength(1);
  await agent.close();
});

test("a torn proposals.jsonl tail is skipped, and a proposal appended after it replays on restart", async () => {
  await store.createBoard("main");
  const path = join(store.dir, "proposals.jsonl");
  await writeFile(path, `${logLine(proposal("p_1"))}{"event":"acc`);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const fake = echoSdk();
  const agent = await createAgent({
    store,
    hub: tabHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  expect(warn).toHaveBeenCalledWith(
    "proposals.jsonl: ignoring a torn last line",
  );
  expect(agent.state().status).toBe("idle");
  expect(agent.pendingProposals().map((p) => p.id)).toEqual(["p_1"]);
  await agent.send("hi");
  await proposeNote(fake);
  const added = agent.pendingProposals()[1].id;
  await agent.close();

  const restarted = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk: echoSdk().sdk,
  });
  expect(restarted.pendingProposals().map((p) => p.id)).toEqual(["p_1", added]);
  const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
  expect(lines).toHaveLength(2);
  for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  await restarted.close();
  warn.mockRestore();
});

const task = (slug: string, dependsOn: string[] = []): Task => ({
  slug,
  title: `Build ${slug}`,
  body: "Do it.",
  dependsOn,
  files: [],
  acceptance: ["it works"],
  sources: [],
});

// A fake SDK whose split query (a plain string prompt) waits for release(), then answers
// with the next scripted task list; the plan session is never started here.
function splitSdk(...answers: Task[][]) {
  const prompts: string[] = [];
  let release = () => {};
  const query = vi.fn((params: { prompt: string }) => {
    prompts.push(params.prompt);
    const tasks = answers.shift();
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return (async function* (): AsyncGenerator<SDKMessage> {
      await gate;
      yield {
        type: "result",
        subtype: "success",
        session_id: "split",
        is_error: false,
        result: "",
        structured_output: { tasks },
        total_cost_usd: 0.25,
      } as SDKMessage;
    })();
  });
  return {
    sdk: {
      query,
      getSessionMessages: vi.fn(async () => []),
    } as unknown as Parameters<typeof createAgent>[0]["sdk"],
    prompts,
    release: () => release(),
  };
}

function statusHub() {
  const hub = new WsHub();
  const sent: ServerMessage[] = [];
  hub.add({ send: (data) => sent.push(JSON.parse(data)) });
  const splits = () => sent.filter((m) => m.type === "split.status");
  return { hub, splits };
}

test("split broadcasts running then done and writes task files; a cycle leaves old files and broadcasts error", async () => {
  await writeFile(join(store.dir, "spec.md"), "## Goals\nShip it.\n");
  const fake = splitSdk(
    [task("routes", ["schema"]), task("schema")],
    [task("a", ["b"]), task("b", ["a"])],
  );
  const { hub, splits } = statusHub();
  const agent = await createAgent({
    store,
    hub,
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  const tasksDir = join(store.dir, "tasks");

  await agent.split();
  expect(splits()).toEqual([{ type: "split.status", state: "running" }]);
  expect(fake.prompts[0]).toContain("## Specification\n\n## Goals\nShip it.");
  fake.release();
  await vi.waitFor(() => expect(splits()).toHaveLength(2));
  expect(splits()[1]).toEqual({
    type: "split.status",
    state: "done",
    costUsd: 0.25,
  });
  expect((await readdir(tasksDir)).sort()).toEqual([
    "01-schema.md",
    "02-routes.md",
  ]);

  await agent.split();
  fake.release();
  await vi.waitFor(() => expect(splits()).toHaveLength(4));
  expect(splits()[3]).toEqual({
    type: "split.status",
    state: "error",
    message: "tasks a and b depend on each other",
  });
  expect((await readdir(tasksDir)).sort()).toEqual([
    "01-schema.md",
    "02-routes.md",
  ]);
  await agent.close();
});

test("split is fed the spec without citations that no longer resolve", async () => {
  await store.createBoard("main");
  await store.writeBoard("main", {
    elements: [
      { id: "e1", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
    ],
    appState: {},
    files: {},
  });
  await writeFile(
    join(store.dir, "spec.md"),
    "## Goals\nShip [[board:main#e1]], [[board:main#gone]].\n",
  );
  const fake = splitSdk([task("schema")]);
  const { hub, splits } = statusHub();
  const agent = await createAgent({
    store,
    hub,
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });

  await agent.split();
  expect(fake.prompts[0]).toContain(
    "## Specification\n\n## Goals\nShip [[board:main#e1]].\n",
  );
  fake.release();
  await vi.waitFor(() => expect(splits()).toHaveLength(2));
  await agent.close();
});

test("POST /api/agent/split is 404 without a spec and 409 while running", async () => {
  const fake = splitSdk([task("schema")]);
  const { hub, splits } = statusHub();
  const agent = await createAgent({
    store,
    hub,
    cwd: root,
    runs: new RunStore(store),
    sdk: fake.sdk,
  });
  const app = createApp(store, agent);
  const split = () => app.request("/api/agent/split", post({}));
  // A view that mounts mid-split learns of it from the state route.
  const splitting = async () =>
    (
      (await (await app.request("/api/agent/state")).json()) as {
        splitting: boolean;
      }
    ).splitting;

  const missing = await split();
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: "compile the plan first" });
  expect(splits()).toEqual([]);
  expect(await splitting()).toBe(false);

  await writeFile(join(store.dir, "spec.md"), "## Goals\n");
  expect((await split()).status).toBe(202);
  expect(await splitting()).toBe(true);
  const busy = await split();
  expect(busy.status).toBe(409);
  expect(await busy.json()).toEqual({ error: "a split is already running" });
  expect(fake.prompts).toHaveLength(1);

  fake.release();
  await vi.waitFor(() =>
    expect(splits().map((m) => m.state)).toEqual(["running", "done"]),
  );
  expect(await splitting()).toBe(false);
  await agent.close();
});
