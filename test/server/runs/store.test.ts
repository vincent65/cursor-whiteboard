import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, NotFoundError } from "../../../src/server/files.js";
import { RunStore } from "../../../src/server/runs/store.js";
import type { RunRecord } from "../../../src/shared/types.js";

// Real random bytes unless a test scripts them.
vi.mock("node:crypto", async (importOriginal) => {
  const crypto = await importOriginal<typeof import("node:crypto")>();
  return { ...crypto, randomBytes: vi.fn(crypto.randomBytes) };
});

let root: string;
let files: FileStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-runs-"));
  files = new FileStore(root);
  await files.init();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const record = (id: string): RunRecord => ({
  id,
  taskSlug: `task-${id}`,
  sessionId: `s-${id}`,
  worktree: `/w/${id}`,
  branch: `blueprint/task-${id}`,
  status: "working",
  permissionMode: "acceptEdits",
  prUrl: null,
  markedDone: false,
  failure: null,
  costUsd: 0,
  startedAt: "2026-11-02T00:00:00.000Z",
  endedAt: null,
});

const plan = { sessionId: "p1", updatedAt: "2026-11-01T00:00:00.000Z" };

test("writes are serialized: two overlapping patches both land", async () => {
  await files.writeSessions({ plan, runs: [] });
  const runs = new RunStore(files);
  await runs.load();
  const a = record("run_aaaaaa");
  const b = record("run_bbbbbb");
  await Promise.all([runs.upsertRun(a), runs.upsertRun(b)]);

  const [pa, pb] = await Promise.all([
    runs.patchRun(a.id, { status: "done" }),
    runs.patchRun(b.id, { costUsd: 1 }),
  ]);
  expect(pa).toEqual({ ...a, status: "done" });
  expect(pb).toEqual({ ...b, costUsd: 1 });
  expect(await files.readSessions()).toEqual({
    plan,
    runs: [
      { ...a, status: "done" },
      { ...b, costUsd: 1 },
    ],
  });
  expect(runs.run(a.id)).toEqual({ ...a, status: "done" });

  // Upserting a known id replaces it in place; an unknown patch throws and writes nothing.
  await runs.upsertRun({ ...a, status: "failed" });
  expect(runs.runs().map((r) => [r.id, r.status])).toEqual([
    [a.id, "failed"],
    [b.id, "working"],
  ]);
  await expect(runs.patchRun("run_ffffff", { costUsd: 2 })).rejects.toThrow(
    NotFoundError,
  );
  expect((await files.readSessions()).runs).toEqual(runs.runs());

  // Records handed out are copies.
  const first = runs.runs()[0];
  first.status = "idle";
  expect(runs.run(a.id)?.status).toBe("failed");
});

test("setPlanSession preserves runs and newRunId never repeats", async () => {
  const a = record("run_aaaaaa");
  await files.writeSessions({ plan: null, runs: [a] });
  const runs = new RunStore(files);
  expect(await runs.load()).toEqual({ plan: null, runs: [a] });

  await runs.setPlanSession("p2");
  const saved = await files.readSessions();
  expect(saved.runs).toEqual([a]);
  expect(saved.plan?.sessionId).toBe("p2");
  expect(Date.parse(saved.plan?.updatedAt ?? "")).not.toBeNaN();

  // 5000 ids out of 16.7M collide about half the time, so the retry is exercised too.
  const ids = Array.from({ length: 5000 }, () => runs.newRunId());
  for (const id of ids) expect(id).toMatch(/^run_[0-9a-f]{6}$/);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).not.toContain(a.id);
});

test("a failed write leaves memory as it was on disk", async () => {
  const runs = new RunStore({
    readSessions: async () => ({ plan: null, runs: [] }),
    writeSessions: async () => {
      throw new Error("disk full");
    },
  });
  await runs.load();
  await expect(runs.upsertRun(record("run_aaaaaa"))).rejects.toThrow(
    "disk full",
  );
  expect(runs.runs()).toEqual([]);
});

test("newRunId draws again when the id is a stored run's", async () => {
  await files.writeSessions({ plan: null, runs: [record("run_aaaaaa")] });
  const runs = new RunStore(files);
  await runs.load();
  const bytes = vi.mocked(randomBytes as (n: number) => Buffer);
  bytes.mockClear();
  bytes
    .mockReturnValueOnce(Buffer.from("aaaaaa", "hex"))
    .mockReturnValueOnce(Buffer.from("bbbbbb", "hex"));
  expect(runs.newRunId()).toBe("run_bbbbbb");
  expect(bytes).toHaveBeenCalledTimes(2);
});

test("a write queued behind a failed one starts from the state on disk and lands", async () => {
  let calls = 0;
  let saved: unknown = null;
  const runs = new RunStore({
    readSessions: async () => ({ plan: null, runs: [] }),
    writeSessions: async (s) => {
      if (++calls === 1) throw new Error("disk full");
      saved = s;
    },
  });
  await runs.load();
  const b = record("run_bbbbbb");
  const failed = runs.upsertRun(record("run_aaaaaa"));
  const next = runs.upsertRun(b);
  await expect(failed).rejects.toThrow("disk full");
  await next;
  expect(saved).toEqual({ plan: null, runs: [b] });
  expect(runs.runs()).toEqual([b]);
});
