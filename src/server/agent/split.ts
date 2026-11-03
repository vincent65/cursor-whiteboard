import type { query, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { type Task, TaskGraph } from "../../shared/tasks.js";

export const SPLIT_PROMPT = (spec: string): string =>
  `Split the specification below into 3 to 12 implementation tasks.
Each task must be independently testable: it ends in a state where its acceptance checks can be run and pass.
For each task give:
- slug: a short kebab-case name (lowercase letters, digits, and single hyphens), unique among the tasks.
- title: one line saying what the task builds.
- body: what to build and how, in Markdown.
- dependsOn: the slugs of the tasks that must be done first; never the task itself, and no cycles.
- files: the files the task likely creates or changes.
- acceptance: the checks that show the task is done.
- sources: the spec's citations this task implements, copied verbatim, like [[board:main#abc]] or [[doc:notes.md#caching]]; never invent one.
Answer only with the structured output; do not read or change any files.

## Specification

${spec}`;

// What an error result means, for one that carries no error text of its own.
const FAILURES: Record<string, string> = {
  error_max_turns: "the split ran out of turns",
  error_max_structured_output_retries:
    "Claude did not return a valid task list",
  error_max_budget_usd: "the split hit its budget",
  error_during_execution: "the split failed while running",
};

// draft-7: the CLI rejects Zod's default draft 2020-12 meta-schema as not a valid schema.
const SCHEMA = z.toJSONSchema(TaskGraph, { target: "draft-7" });

// One tool-less query whose structured output the SDK validates against TaskGraph and
// retries on mismatch; parsed again here, since structured_output is typed unknown.
export async function splitSpec(
  deps: { query: typeof query; cwd: string },
  spec: string,
): Promise<{ tasks: Task[]; costUsd: number | null }> {
  let result: SDKResultMessage | undefined;
  for await (const msg of deps.query({
    prompt: SPLIT_PROMPT(spec),
    options: {
      cwd: deps.cwd,
      maxTurns: 2,
      tools: [],
      permissionMode: "default",
      outputFormat: { type: "json_schema", schema: SCHEMA },
    },
  }))
    if (msg.type === "result") result = msg;

  if (!result)
    throw new Error("split failed: the query ended without a result");
  if (result.subtype !== "success")
    throw new Error(
      result.errors.length > 0
        ? `split failed: ${result.errors.join("\n")}`
        : (FAILURES[result.subtype] ?? `split failed: ${result.subtype}`),
    );
  const graph = TaskGraph.safeParse(result.structured_output);
  if (!graph.success)
    throw new Error(`split failed: ${z.prettifyError(graph.error)}`);
  return { tasks: graph.data.tasks, costUsd: result.total_cost_usd ?? null };
}
