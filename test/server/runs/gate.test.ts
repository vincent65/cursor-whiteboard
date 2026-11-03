import { checkGate } from "../../../src/server/runs/gate.js";
import type { Task } from "../../../src/shared/tasks.js";
import type { RunRecord, RunStatus } from "../../../src/shared/types.js";

const task = (slug: string, dependsOn: string[] = []): Task => ({
  slug,
  title: `Build ${slug}`,
  body: "",
  dependsOn,
  files: [],
  acceptance: [],
  sources: [],
});

const run = (id: string, taskSlug: string, status: RunStatus): RunRecord => ({
  id,
  taskSlug,
  sessionId: "",
  worktree: `/w/${taskSlug}`,
  branch: `blueprint/${taskSlug}-${id}`,
  status,
  permissionMode: "acceptEdits",
  prUrl: null,
  costUsd: 0,
  startedAt: "2026-11-02T00:00:00.000Z",
  endedAt: null,
});

test("checkGate reports each missing dependency with its reason", async () => {
  const runs = [
    run("r1", "failed-dep", "failed"),
    run("r2", "unmerged-dep", "done"),
    run("r3", "merged-dep", "done"),
    // The newest run for a slug decides: a later failure hides an older merge.
    run("r4", "retried-dep", "done"),
    run("r5", "retried-dep", "failed"),
  ];
  const isAncestor = vi.fn(
    async (branch: string) => branch !== "blueprint/unmerged-dep-r2",
  );

  const gated = await checkGate({
    task: task("t", [
      "no-run-dep",
      "failed-dep",
      "unmerged-dep",
      "merged-dep",
      "retried-dep",
    ]),
    runs,
    isAncestor,
  });
  expect(gated).toEqual({
    ok: false,
    missing: [
      { slug: "no-run-dep", reason: "no run" },
      { slug: "failed-dep", reason: "not done" },
      { slug: "unmerged-dep", reason: "not merged" },
      { slug: "retried-dep", reason: "not done" },
    ],
  });
  // Only done runs reach git.
  expect(isAncestor.mock.calls.map(([b]) => b).sort()).toEqual([
    "blueprint/merged-dep-r3",
    "blueprint/unmerged-dep-r2",
  ]);

  expect(
    await checkGate({ task: task("t", ["merged-dep"]), runs, isAncestor }),
  ).toEqual({ ok: true, missing: [] });
  expect(await checkGate({ task: task("t"), runs: [], isAncestor })).toEqual({
    ok: true,
    missing: [],
  });
});
