import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  Options,
  PermissionResult,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { type Agent, createAgent } from "../../src/server/agent/index.js";
import { createApp } from "../../src/server/app.js";
import { FileStore } from "../../src/server/files.js";
import { WsHub } from "../../src/server/ws.js";
import type { ServerMessage } from "../../src/shared/messages.js";

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

function fakeAgent() {
  return {
    send: vi.fn(async () => "u1"),
    interrupt: vi.fn(async () => undefined),
    answerPermission: vi.fn((id: string) => id === "p1"),
    state: vi.fn(() => ({
      status: "idle" as const,
      sessionId: "s1",
      transcript: [],
      pending: [],
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
  expect(agent.send).toHaveBeenCalledWith("hi", selection);

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
  });

  const interrupt = await app.request("/api/agent/interrupt", post({}));
  expect(interrupt.status).toBe(204);
  expect(agent.interrupt).toHaveBeenCalledOnce();
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
  const agent = await createAgent({ store, hub, cwd: root, sdk: fake.sdk });

  // Lazy: nothing runs before the first send.
  expect(fake.query).not.toHaveBeenCalled();
  expect(agent.state()).toEqual({
    status: "idle",
    transcript: [],
    pending: [],
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
    pending: [{ id: "tu1", tool: "Bash", summary: "running `ls`" }],
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
  await store.writeSessions({
    plan: { sessionId: "old", updatedAt: "2026-11-01T00:00:00.000Z" },
    runs: [],
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
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
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
  await agent.close();
});
