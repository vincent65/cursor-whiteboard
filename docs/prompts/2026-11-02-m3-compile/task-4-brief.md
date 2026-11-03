### Task 4: Split with structured output

**Files:**
- Create: `src/server/agent/split.ts`
- Modify: `src/shared/messages.ts`, `src/server/agent/index.ts`, `src/server/agentRoutes.ts`
- Test: `test/server/agent/split.test.ts`, `test/server/agentRoutes.test.ts`

**Interfaces:**
- Consumes: `TaskGraph` (Task 1), `FileStore.readSpec`, `FileStore.replaceTasks` (Task 2), the SDK's `query`.
- Produces in `src/shared/messages.ts`, added to `ServerMessage`: `{ type: "split.status"; state: "running" | "done" | "error"; message?: string; costUsd?: number }`.
- Produces in `src/server/agent/split.ts`:

```ts
export const SPLIT_PROMPT: (spec: string) => string;
   // asks for 3 to 12 implementation tasks, each independently testable, with kebab-case slugs, dependsOn by slug, files likely touched,
   // acceptance checks, and sources copied verbatim from the spec's citations; the spec text follows under a "## Specification" heading
export async function splitSpec(deps: { query: typeof import("@anthropic-ai/claude-agent-sdk").query; cwd: string }, spec: string): Promise<{ tasks: Task[]; costUsd: number | null }>;
   // one query() with prompt SPLIT_PROMPT(spec) and options { cwd, maxTurns: 2, tools: [] (if `tools` is not an `Options` field in the installed SDK, use `disallowedTools` naming every file, shell, and web tool instead and say so in the report), permissionMode: "default", outputFormat: { type: "json_schema", schema: z.toJSONSchema(TaskGraph) } };
   // reads the result message: subtype "success" with structured_output parsed by TaskGraph → tasks; any other subtype or an invalid output → throws Error("split failed: <errors or zod message>")
```

- Produces on `Agent`: `split(): Promise<void>` reads the spec (throws `NotFoundError("compile the plan first")` when null), broadcasts `split.status running`, runs `splitSpec`, calls `store.replaceTasks`, broadcasts `done` with `costUsd` (or `error` with the message), and refuses a second split while one runs (`Error("a split is already running")`).
- Produces in `src/server/agentRoutes.ts`: `POST /split` → 202 when started, 404 when there is no spec, 409 while one runs.

- [ ] **Step 1: Write the failing tests**

```ts
// split.test.ts, with a fake query that yields a scripted result message
test("splitSpec passes the schema and returns validated tasks", async () => {
  // asserts options.outputFormat.type === "json_schema" and the schema has tasks; result structured_output → tasks; costUsd from total_cost_usd
});
test("splitSpec rejects a result without valid structured output", async () => {
  // subtype "error_max_structured_output_retries" → rejects /split failed/; subtype success with { tasks: [] } → rejects
});
// agentRoutes.test.ts
test("split broadcasts running then done and writes task files; a cycle leaves old files and broadcasts error", ...);
test("POST /api/agent/split is 404 without a spec and 409 while running", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/split.test.ts test/server/agentRoutes.test.ts -t split`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/split.ts src/shared/messages.ts src/server/agent/index.ts src/server/agentRoutes.ts test/server/agent/split.test.ts test/server/agentRoutes.test.ts
git commit -m "feat(agent): split the spec into task files with structured output"
```

---

