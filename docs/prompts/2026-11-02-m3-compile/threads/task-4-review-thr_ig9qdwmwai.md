### Spec Compliance
- **Spec compliant.** Every item in the brief is present in the diff: `SPLIT_PROMPT`, `splitSpec`, the `split.status` message type, `Agent.split()`, `POST /split` with 202/404/409, and all four tests the brief lists.
- **`SPLIT_PROMPT`** (`src/server/agent/split.ts:5-20`) covers everything the brief asks for:
  - 3 to 12 tasks, each independently testable.
  - Kebab-case slugs and `dependsOn` by slug.
  - Files, acceptance checks, and sources copied verbatim from the spec's citations.
  - The spec text follows under a `## Specification` heading.
- **`splitSpec` options** (`split.ts:33-41`) match the brief: `cwd`, `maxTurns: 2`, `tools: []`, `permissionMode: "default"`, and `outputFormat` of type `json_schema`.
  - The report says `tools` is a real `Options` field in the installed SDK.
    Typecheck passing is consistent with that.
- **Result handling** (`split.ts:44-53`) matches the brief.
  - A non-success subtype throws `split failed: <errors>`.
  - Output that fails `TaskGraph` throws `split failed: <zod message>`.
  - A stream with no result message also throws, which is a sensible extra guard.
- **`Agent.split()`** (`src/server/agent/index.ts:259-300`) matches the brief.
  - It throws `NotFoundError("compile the plan first")` when there is no spec.
  - It broadcasts `running`, then `done` with `costUsd` or `error` with the message.
  - It refuses a second split while one runs.
- **Deviation 1, schema draft:** `z.toJSONSchema(TaskGraph, { target: "draft-7" })` (`split.ts:23`) replaces the plain call.
  - The reason is a real failure the implementer hit when running against the actual CLI.
  - The schema keeps the same constraints; only the draft changes.
  - `split.test.ts:57-59` guards against it reverting.
  - I accept this deviation.
- **Deviation 2, `ExistsError`:** the brief says `Error("a split is already running")`; the code throws `ExistsError` (`index.ts:260`).
  - `ExistsError` is a subclass of `Error` with the exact message, and it produces the 409 the brief requires.
  - The 409 test (`agentRoutes.test.ts:939-942`) asserts both the status and the body.
- **Tests the brief lists:**
  - The schema test asserts `outputFormat.type`, that the schema has `properties.tasks`, the tasks returned, and `costUsd` (`split.test.ts:31-60`).
  - The rejection test covers `error_max_structured_output_retries` and `{ tasks: [] }`, plus a success result with no structured output (`split.test.ts:62-93`).
  - The routes test covers running then done, the task files written, and a cycle that leaves the old files and broadcasts the error (`agentRoutes.test.ts:893-927`).
  - The HTTP test covers 404 with no spec and 409 while running (`agentRoutes.test.ts:929-953`).
- **Cannot verify from the diff alone:**
  - That the app's error handler sends `ExistsError` to 409 and `NotFoundError` to 404. The reported passing route test covers this.
  - That the real CLI accepts the draft-7 schema. This rests only on the implementer's manual run in the report.
  - That `pnpm check` is pristine. This rests on the report's summary of 262 passing tests and no Biome fixes.

### Strengths
- **No race on the busy flag:** `splitting` is set before the first `await` (`index.ts:260-261`) and cleared on both the no-spec path and in `finally`, so two concurrent calls cannot both start.
  - The 409 test proves this by checking that the SDK's `query` ran once (`agentRoutes.test.ts:943`).
- **A test catches the CLI schema failure:** the implementer ran the split against the real CLI, found the draft 2020-12 rejection that the fake-SDK tests could not catch, and added a regression assertion.
- **Failed splits never touch the files on disk:** `replaceTasks` validates the task graph before writing anything, and the routes test checks the directory is unchanged after a cycle.
- **No crash path from the background split:** any throw from `sdk.query` happens inside the async block, so it becomes an `error` broadcast instead of an unhandled rejection.
- **Small, matching code:** the route is 5 lines and uses the existing error mapping, and `costUsd` is left out of `done` when null.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **`close()` does not stop a running split** (`index.ts:271-299`).
   - `Agent.close()` neither waits for nor aborts the background split.
   - If the server shuts down mid-split, the CLI child process keeps running.
   - Once the split finishes, `replaceTasks` can still write after `close()` has resolved.
   - The implementer raised this themselves (report concern 2).
   - Fix: pass an `abortController` to the query and abort it in `close()`.
2. **Errors thrown by the SDK skip the `split failed:` prefix** (`index.ts:283-288` with `split.ts:32-42`).
   - Spawn failures and CLI crashes reach the browser as the SDK's raw message, which can include long CLI stderr.
   - Only result-level failures get the prefix.
   - The implementer raised this too (report concern 1).
   - Fix: wrap the `for await` loop in `splitSpec` and prefix the message.
3. **Reusing `ExistsError` is a semantic stretch** (`index.ts:260`).
   - The class elsewhere means "the file already exists"; here it means "busy".
   - `ProposalBusyError` is already a 409 precedent, so a dedicated `SplitBusyError` would be clearer.
   - It would need a one-line change in `app.ts`.
4. **The error broadcast drops the cost** (`index.ts:283-288`).
   - A failed result such as `error_max_structured_output_retries` still has a `total_cost_usd`, but the `error` message leaves it out.
   - The brief does not ask for it, so this is polish only.
5. **Small test gaps:**
   - Nothing checks that `costUsd` is left out of `done` when `total_cost_usd` is null.
   - The cycle test compares only file names (`agentRoutes.test.ts:922-925`), not contents. That is enough here because the cycle's slugs (`a`, `b`) differ from the original files' slugs.

### Assessment
Task quality: Approved

Reasoning: The implementation matches the brief. The two deviations are well-justified, and the draft-7 one is backed by a real CLI run and a regression test. Every remaining item is shutdown or message polish that the implementer already flagged as a concern.
