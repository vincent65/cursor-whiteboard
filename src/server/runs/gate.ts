import type { Task } from "../../shared/tasks.js";
import type { RunRecord } from "../../shared/types.js";

type Missing = { slug: string; reason: "no run" | "not done" | "not merged" };
export type GateResult = { ok: boolean; missing: Missing[] };

export class GateError extends Error {
  constructor(readonly missing: Missing[]) {
    super("dependencies are not merged");
  }
}

// Each dependency is judged by its newest run (runs are kept oldest first); only a done
// run is checked against git.
export async function checkGate(input: {
  task: Task;
  runs: RunRecord[];
  isAncestor: (branch: string) => Promise<boolean>;
}): Promise<GateResult> {
  const missing = (
    await Promise.all(
      input.task.dependsOn.map(async (slug): Promise<Missing | null> => {
        const run = input.runs.filter((r) => r.taskSlug === slug).at(-1);
        const reason = !run
          ? "no run"
          : run.status !== "done"
            ? "not done"
            : (await input.isAncestor(run.branch))
              ? null
              : "not merged";
        return reason && { slug, reason };
      }),
    )
  ).filter((m) => m !== null);
  return { ok: missing.length === 0, missing };
}
