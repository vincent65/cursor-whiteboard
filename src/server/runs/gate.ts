import type { GateResult, MissingDependency } from "../../shared/runs.js";
import type { Task } from "../../shared/tasks.js";
import type { RunRecord } from "../../shared/types.js";

export class GateError extends Error {
  constructor(readonly missing: MissingDependency[]) {
    super("dependencies are not ready");
  }
}

// A dependency is met by any done run whose branch is merged; only done runs reach git.
// Otherwise it reports the best reason: a done run that is not merged, then any run.
export async function checkGate(input: {
  task: Task;
  runs: RunRecord[];
  isAncestor: (branch: string) => Promise<boolean>;
}): Promise<GateResult> {
  const missing = (
    await Promise.all(
      input.task.dependsOn.map(
        async (slug): Promise<MissingDependency | null> => {
          const runs = input.runs.filter((r) => r.taskSlug === slug);
          const done = runs.filter((r) => r.status === "done");
          const merged = await Promise.all(
            done.map((r) => input.isAncestor(r.branch)),
          );
          if (merged.includes(true)) return null;
          const reason =
            done.length > 0
              ? "not merged"
              : runs.length > 0
                ? "not done"
                : "no run";
          return { slug, reason };
        },
      ),
    )
  ).filter((m) => m !== null);
  return { ok: missing.length === 0, missing };
}
