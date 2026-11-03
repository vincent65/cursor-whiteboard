import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { SPLIT_PROMPT, splitSpec } from "../../../src/server/agent/split.js";
import type { Task } from "../../../src/shared/tasks.js";

const task = (slug: string, dependsOn: string[] = []): Task => ({
  slug,
  title: `Build ${slug}`,
  body: "Do it.",
  dependsOn,
  files: ["src/a.ts"],
  acceptance: ["it works"],
  sources: ["[[board:main#r1]]"],
});

// A fake `query` that records its call and yields an init message, then the scripted result.
function fakeQuery(result: Record<string, unknown>) {
  const calls: { prompt: unknown; options?: Options }[] = [];
  const query = vi.fn((params: { prompt: unknown; options?: Options }) => {
    calls.push(params);
    return (async function* (): AsyncGenerator<SDKMessage> {
      yield { type: "system", subtype: "init", session_id: "s" } as SDKMessage;
      yield { type: "result", session_id: "s", ...result } as SDKMessage;
    })();
  });
  return {
    query: query as unknown as Parameters<typeof splitSpec>[0]["query"],
    calls,
  };
}

test("splitSpec passes the schema and returns validated tasks", async () => {
  const tasks = [task("schema"), task("routes", ["schema"])];
  const fake = fakeQuery({
    subtype: "success",
    is_error: false,
    result: "",
    structured_output: { tasks },
    total_cost_usd: 0.042,
  });

  const out = await splitSpec({ query: fake.query, cwd: "/repo" }, "# Spec");
  expect(out).toEqual({ tasks, costUsd: 0.042 });

  expect(fake.calls).toHaveLength(1);
  const { prompt, options } = fake.calls[0];
  expect(prompt).toBe(SPLIT_PROMPT("# Spec"));
  expect(prompt).toContain("## Specification\n\n# Spec");
  expect(options).toMatchObject({
    cwd: "/repo",
    maxTurns: 2,
    tools: [],
    permissionMode: "default",
  });
  expect(options?.outputFormat?.type).toBe("json_schema");
  expect(options?.outputFormat?.schema).toHaveProperty("properties.tasks");
  // The CLI's validator rejects Zod's default draft 2020-12 meta-schema.
  expect(options?.outputFormat?.schema.$schema).toBe(
    "http://json-schema.org/draft-07/schema#",
  );
});

test("splitSpec rejects a result without valid structured output", async () => {
  const retries = fakeQuery({
    subtype: "error_max_structured_output_retries",
    is_error: true,
    errors: ["output did not match the schema"],
    total_cost_usd: 0.1,
  });
  await expect(
    splitSpec({ query: retries.query, cwd: "/repo" }, "# Spec"),
  ).rejects.toThrow(/^split failed: output did not match the schema$/);

  const empty = fakeQuery({
    subtype: "success",
    is_error: false,
    result: "",
    structured_output: { tasks: [] },
    total_cost_usd: 0.1,
  });
  await expect(
    splitSpec({ query: empty.query, cwd: "/repo" }, "# Spec"),
  ).rejects.toThrow(/split failed/);

  const missing = fakeQuery({
    subtype: "success",
    is_error: false,
    result: "here you go",
    total_cost_usd: 0.1,
  });
  await expect(
    splitSpec({ query: missing.query, cwd: "/repo" }, "# Spec"),
  ).rejects.toThrow(/split failed/);
});

test("an error result without errors reads as a sentence", async () => {
  const sentences = {
    error_max_turns: "the split ran out of turns",
    error_max_structured_output_retries:
      "Claude did not return a valid task list",
    error_max_budget_usd: "the split hit its budget",
    error_during_execution: "the split failed while running",
  };
  for (const [subtype, sentence] of Object.entries(sentences)) {
    const fake = fakeQuery({
      subtype,
      is_error: true,
      errors: [],
      total_cost_usd: 0.1,
    });
    await expect(
      splitSpec({ query: fake.query, cwd: "/repo" }, "# Spec"),
    ).rejects.toThrow(new Error(sentence));
  }
});
