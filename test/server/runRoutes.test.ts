import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/app.js";
import {
  ExistsError,
  FileStore,
  NotFoundError,
} from "../../src/server/files.js";
import type { RunManager, RunView } from "../../src/server/runs/manager.js";
import type { PanelEvent } from "../../src/shared/panel.js";
import type { Task } from "../../src/shared/tasks.js";
import type { RunRecord } from "../../src/shared/types.js";

let root: string;
let store: FileStore;

const task = (slug: string, dependsOn: string[] = []): Task => ({
  slug,
  title: `Build ${slug}`,
  body: "",
  dependsOn,
  files: [],
  acceptance: [],
  sources: [],
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-run-routes-"));
  store = new FileStore(root);
  await store.init();
  await store.replaceTasks([task("base"), task("top", ["base"])]);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  headers: { "Content-Type": "application/json" },
});

const record = (id: string, taskSlug: string): RunRecord => ({
  id,
  taskSlug,
  sessionId: "",
  worktree: `/w/${taskSlug}`,
  branch: `blueprint/${taskSlug}`,
  status: "working",
  permissionMode: "acceptEdits",
  prUrl: null,
  costUsd: 0,
  startedAt: "2026-11-02T00:00:00.000Z",
  endedAt: null,
});

const transcript: PanelEvent[] = [
  { kind: "user", id: "u1", text: "hi", at: "2026-11-02T00:00:00.000Z" },
];

function fakeRuns(views: RunView[] = []) {
  const known = (id: string) => {
    if (id !== "run_1") throw new NotFoundError(`run ${id} not found`);
  };
  const manager = {
    list: vi.fn(() => views),
    launch: vi.fn(async ({ taskSlug, permissionMode }) => {
      if (taskSlug === "ghost")
        throw new NotFoundError(`task ${taskSlug} not found`);
      return { ...record("run_2", taskSlug), permissionMode };
    }),
    message: vi.fn(async (id: string) => {
      known(id);
      return "u7";
    }),
    stop: vi.fn(async (id: string) => known(id)),
    resume: vi.fn(async (id: string) => {
      known(id);
      throw new ExistsError(`run ${id} is working, not interrupted`);
    }),
    answerPermission: vi.fn(
      (id: string, p: string) => id === "run_1" && p === "p1",
    ),
    transcript: vi.fn((id: string) => {
      known(id);
      return transcript;
    }),
  };
  const isAncestor = vi.fn(async () => true);
  const app = createApp(store, undefined, {
    manager: manager as unknown as RunManager,
    isAncestor,
  });
  return { app, manager, isAncestor };
}

test("POST /api/runs refuses a gated task without override and launches with it", async () => {
  const { app, manager } = fakeRuns();

  const gate = await app.request("/api/runs/gate/top");
  expect(gate.status).toBe(200);
  expect(await gate.json()).toEqual({
    ok: false,
    missing: [{ slug: "base", reason: "no run" }],
  });
  expect((await app.request("/api/runs/gate/ghost")).status).toBe(404);

  const refused = await app.request(
    "/api/runs",
    post({ taskSlug: "top", permissionMode: "default" }),
  );
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({
    error: "dependencies are not ready",
    missing: [{ slug: "base", reason: "no run" }],
  });
  expect(manager.launch).not.toHaveBeenCalled();

  const forced = await app.request(
    "/api/runs",
    post({ taskSlug: "top", permissionMode: "default", override: true }),
  );
  expect(forced.status).toBe(201);
  expect(await forced.json()).toEqual({
    ...record("run_2", "top"),
    permissionMode: "default",
  });
  expect(manager.launch).toHaveBeenCalledWith({
    taskSlug: "top",
    permissionMode: "default",
  });

  // No dependencies, no gate.
  const free = await app.request(
    "/api/runs",
    post({ taskSlug: "base", permissionMode: "acceptEdits" }),
  );
  expect(free.status).toBe(201);

  const ghost = await app.request(
    "/api/runs",
    post({ taskSlug: "ghost", permissionMode: "acceptEdits" }),
  );
  expect(ghost.status).toBe(404);
  const forcedGhost = await app.request(
    "/api/runs",
    post({ taskSlug: "ghost", permissionMode: "acceptEdits", override: true }),
  );
  expect(forcedGhost.status).toBe(404);

  for (const body of [
    {},
    { taskSlug: "base" },
    { taskSlug: "base", permissionMode: "plan" },
    { taskSlug: "base", permissionMode: "default", override: "yes" },
  ]) {
    const res = await app.request("/api/runs", post(body));
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  }
  expect(manager.launch).toHaveBeenCalledTimes(3);
});

test("the gate passes a dependency whose newest run is done and merged", async () => {
  const done = { ...record("run_1", "base"), status: "done" as const };
  const { app, isAncestor } = fakeRuns([
    { ...done, pending: [], lastText: null },
  ]);

  const gate = await app.request("/api/runs/gate/top");
  expect(await gate.json()).toEqual({ ok: true, missing: [] });
  expect(isAncestor).toHaveBeenCalledWith("blueprint/base");

  const launched = await app.request(
    "/api/runs",
    post({ taskSlug: "top", permissionMode: "acceptEdits" }),
  );
  expect(launched.status).toBe(201);
});

test("run routes forward message, stop, resume, permission, and transcript with the right codes", async () => {
  const view: RunView = {
    ...record("run_1", "base"),
    pending: [],
    lastText: "ok",
  };
  const { app, manager } = fakeRuns([view]);

  const list = await app.request("/api/runs");
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual([view]);

  const sent = await app.request(
    "/api/runs/run_1/message",
    post({ text: "go on" }),
  );
  expect(sent.status).toBe(202);
  expect(await sent.json()).toEqual({ id: "u7" });
  expect(manager.message).toHaveBeenCalledWith("run_1", "go on");
  for (const body of [{ text: " " }, {}]) {
    const res = await app.request("/api/runs/run_1/message", post(body));
    expect(res.status, JSON.stringify(body)).toBe(400);
  }
  expect(
    (await app.request("/api/runs/run_9/message", post({ text: "hi" }))).status,
  ).toBe(404);

  const stopped = await app.request("/api/runs/run_1/stop", post());
  expect(stopped.status).toBe(204);
  expect(manager.stop).toHaveBeenCalledWith("run_1");
  expect((await app.request("/api/runs/run_9/stop", post())).status).toBe(404);

  const resumed = await app.request("/api/runs/run_1/resume", post());
  expect(resumed.status).toBe(409);
  expect(await resumed.json()).toEqual({
    error: "run run_1 is working, not interrupted",
  });
  expect((await app.request("/api/runs/run_9/resume", post())).status).toBe(
    404,
  );

  const answered = await app.request(
    "/api/runs/run_1/permission",
    post({ id: "p1", behavior: "allow" }),
  );
  expect(answered.status).toBe(204);
  expect(manager.answerPermission).toHaveBeenCalledWith("run_1", "p1", {
    behavior: "allow",
  });
  const unknown = await app.request(
    "/api/runs/run_1/permission",
    post({ id: "p2", behavior: "deny", message: "no" }),
  );
  expect(unknown.status).toBe(404);
  expect(await unknown.json()).toHaveProperty("error");
  expect(
    (
      await app.request(
        "/api/runs/run_1/permission",
        post({ id: "p1", behavior: "maybe" }),
      )
    ).status,
  ).toBe(400);

  const log = await app.request("/api/runs/run_1/transcript");
  expect(log.status).toBe(200);
  expect(await log.json()).toEqual(transcript);
  expect((await app.request("/api/runs/run_9/transcript")).status).toBe(404);
});
