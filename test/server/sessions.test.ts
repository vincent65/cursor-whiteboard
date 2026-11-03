import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  SDKSessionInfo,
  SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { createApp } from "../../src/server/app.js";
import { FileStore } from "../../src/server/files.js";
import { listOtherSessions } from "../../src/server/sessions.js";

let root: string;
let store: FileStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-sessions-"));
  store = new FileStore(root);
  await store.init();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const infos: SDKSessionInfo[] = [
  { sessionId: "old", summary: "Fix the login bug", lastModified: 100 },
  {
    sessionId: "plan",
    summary: "Blueprint plan",
    lastModified: 400,
    cwd: "/repo",
  },
  {
    sessionId: "new",
    summary: "Refactor the router",
    lastModified: 300,
    cwd: "/repo/.claude/worktrees/x",
    gitBranch: "router",
    fileSize: 1234,
    firstPrompt: "Refactor the router",
  },
  { sessionId: "run", summary: "Run auth", lastModified: 200 },
];

test("listOtherSessions excludes Blueprint's own sessions and sorts newest first", async () => {
  const listSessions = vi.fn(async () => infos);

  const others = await listOtherSessions({
    listSessions,
    root: "/repo",
    exclude: new Set(["plan", "run"]),
  });

  expect(listSessions).toHaveBeenCalledWith({
    dir: "/repo",
    includeWorktrees: true,
    includeProgrammatic: true,
  });
  expect(others).toEqual([
    {
      sessionId: "new",
      summary: "Refactor the router",
      lastModified: 300,
      cwd: "/repo/.claude/worktrees/x",
      gitBranch: "router",
    },
    {
      sessionId: "old",
      summary: "Fix the login bug",
      lastModified: 100,
      cwd: null,
      gitBranch: null,
    },
  ]);
});

test("GET /api/sessions/:id/transcript maps a saved session and 404s an unknown one", async () => {
  const saved = [
    {
      type: "user",
      uuid: "u1",
      session_id: "new",
      parent_tool_use_id: null,
      message: { role: "user", content: "refactor the router" },
    },
    {
      type: "assistant",
      uuid: "a1",
      session_id: "new",
      parent_tool_use_id: null,
      message: { id: "msg_1", content: [{ type: "text", text: "Done." }] },
    },
  ] as SessionMessage[];
  const getSessionMessages = vi.fn(async (id: string) =>
    id === "new" ? saved : [],
  );
  let exclude = new Set(["plan"]);
  const app = createApp(store, undefined, undefined, {
    listSessions: vi.fn(async () => infos),
    getSessionMessages,
    root,
    exclude: () => exclude,
  });

  const res = await app.request("/api/sessions/new/transcript");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject([
    { kind: "user", id: "u1", text: "refactor the router" },
    { kind: "assistant_text", text: "Done." },
  ]);
  expect(getSessionMessages).toHaveBeenCalledWith("new", { dir: root });

  const missing = await app.request("/api/sessions/ghost/transcript");
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: "session ghost not found" });

  // The excluded ids are read per request, so a run started since is left out too.
  exclude = new Set(["plan", "run"]);
  const list = await app.request("/api/sessions");
  expect(list.status).toBe(200);
  expect(
    ((await list.json()) as { sessionId: string }[]).map((s) => s.sessionId),
  ).toEqual(["new", "old"]);
});
