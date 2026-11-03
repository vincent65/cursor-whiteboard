# Task 4 report: Split with structured output

Status: DONE_WITH_CONCERNS

Commit: `355eb22 feat(agent): split the spec into task files with structured output`

## What I implemented

- `src/server/agent/split.ts`
  - `SPLIT_PROMPT(spec)` asks for 3 to 12 independently testable tasks.
    Each task has a kebab-case slug, a title, a body, `dependsOn` by slug, likely files, acceptance checks, and sources copied verbatim from the spec's citations.
    The spec follows under `## Specification`.
  - `splitSpec({ query, cwd }, spec)` runs one `query()` with a plain string prompt and these options: `{ cwd, maxTurns: 2, tools: [], permissionMode: "default", outputFormat: { type: "json_schema", schema } }`.
    It reads the whole iterator and keeps the last `result` message.
    A non-success subtype throws `split failed: <errors joined>` (or the subtype name if `errors` is empty).
    A success result whose `structured_output` fails `TaskGraph` throws `split failed: <zod prettified message>`.
    No result at all throws `split failed: the query ended without a result`.
    It returns `{ tasks, costUsd: total_cost_usd ?? null }`.
  - `tools` is an `Options` field in the installed SDK (`tools?: string[] | { type: "preset" ... }`, where `[]` disables all built-in tools), so I used `tools: []`, not the `disallowedTools` fallback.
- `src/shared/messages.ts`: adds `{ type: "split.status"; state: "running" | "done" | "error"; message?: string; costUsd?: number }` to `ServerMessage`.
- `src/server/agent/index.ts`: `Agent.split()`.
  - It refuses with `ExistsError("a split is already running")` while a split is in flight.
    The flag is set before the first `await`, so two racing calls cannot both start.
  - It reads the spec and throws `NotFoundError("compile the plan first")` when the spec is null.
    The flag clears on that path.
  - It broadcasts `split.status running`, then runs `splitSpec` and `store.replaceTasks` in the background.
    It then broadcasts `done` (with `costUsd`) or `error` (with the message).
    The flag clears in a `finally`.
  - `split()` resolves once `running` has been broadcast, not when the split finishes, so the route can return 202 "when started".
    The UI already waits on `split.status`, as Task 7 specifies.
- `src/server/agentRoutes.ts`: `POST /split` returns 202 once started.
  The app's existing error handler turns `NotFoundError` into 404 and `ExistsError` into 409.

## Deviations and judgment calls

1. **`z.toJSONSchema(TaskGraph, { target: "draft-7" })` instead of `z.toJSONSchema(TaskGraph)`.**
   The plain call breaks the real split.
   The CLI exits with `Error: --json-schema is not a valid JSON Schema: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"`.
   Zod's own `target` option changes the `$schema` draft and removes nothing from the schema, so this still follows the "strip nothing" instruction.
   A unit test now checks that `$schema` is draft-07, so this cannot regress.
2. **409 uses `ExistsError`.**
   The brief says `Error("a split is already running")` and requires a 409.
   `app.ts` (not in my file list) maps only `ExistsError` and `ProposalBusyError` to 409.
   `ExistsError` is an `Error` subclass with that exact message, so it gives the 409 without changing `app.ts`.
   If a reviewer prefers a dedicated `SplitBusyError`, adding one needs a one-line change in `app.ts`.
3. **`split()` resolves when the split starts, not when it finishes.** The reason is above, and the comment on the `Agent` type says so.

## TDD evidence

RED (before `split.ts` and `Agent.split` existed):

```
$ pnpm vitest run test/server/agent/split.test.ts test/server/agentRoutes.test.ts -t split
 FAIL  test/server/agent/split.test.ts [ test/server/agent/split.test.ts ]
Error: Cannot find module '../../../src/server/agent/split.js' imported from .../test/server/agent/split.test.ts
 FAIL  test/server/agentRoutes.test.ts > split broadcasts running then done and writes task files; a cycle leaves old files and broadcasts error
TypeError: agent.split is not a function
 FAIL  test/server/agentRoutes.test.ts > POST /api/agent/split is 404 without a spec and 409 while running
AssertionError: expected { error: 'not found' } to deeply equal { error: 'compile the plan first' }
 Test Files  2 failed (2)
      Tests  2 failed | 17 skipped (19)
```

Running the tests after implementing failed once, on a wrong guess in my test: I expected the cycle message as `tasks b and a ...`, but `orderTasks` says `tasks a and b depend on each other`.
I fixed the test's expectation.

GREEN:

```
$ pnpm vitest run test/server/agent/split.test.ts test/server/agentRoutes.test.ts -t split
 Test Files  2 passed (2)
      Tests  4 passed | 17 skipped (21)
```

RED/GREEN for the draft-7 regression assertion (added after the manual run below):

```
# with z.toJSONSchema(TaskGraph)
   × splitSpec passes the schema and returns validated tasks
AssertionError: expected 'https://json-schema.org/draft/2020-12…' to be 'http://json-schema.org/draft-07/schem…'
      Tests  1 failed | 1 passed (2)
# with { target: "draft-7" }
      Tests  2 passed (2)
```

`pnpm check` (final): tsc for both configs is clean, and `biome check` reports `Checked 100 files ... No fixes applied.`

```
 Test Files  37 passed (37)
      Tests  262 passed (262)
```

## Manual verification

The brief names no manual step.
I ran `splitSpec` once against the real SDK, using my Claude Code login and no API key.
The input was a small six-section spec with two citations (`[[board:main#r1]]`, `[[doc:notes.md#storage]]`).
- First attempt, with the default Zod schema: the CLI exited with code 1 and the draft 2020-12 error quoted above.
  The fake-query unit tests could not have caught this.
- After switching to `target: "draft-7"`: the call succeeded.
  It returned 5 tasks with kebab-case slugs and a valid `dependsOn` graph.
  The sources were copied verbatim from the spec's two citations.
  It returned `costUsd: 0.0764689`.
I did not exercise the full browser flow; Task 8 covers that.

## Files changed

- `src/server/agent/split.ts` (new)
- `src/shared/messages.ts`
- `src/server/agent/index.ts`
- `src/server/agentRoutes.ts`
- `test/server/agent/split.test.ts` (new)
- `test/server/agentRoutes.test.ts` (adds `split` to the fake agent, a `splitSdk` fake with a release gate, and the two brief tests)

## Self-review

- **Single-flight:** `splitting` is set synchronously before any await.
  The 409 test fires a second request while the first is gated, and checks that `query` ran only once.
- **Cycle or duplicate in the answer:** `replaceTasks` runs `orderTasks` before writing anything.
  The old files stay, and the error message is broadcast.
  The cycle test checks that the directory is unchanged.
- **No result message:** this throws instead of returning empty tasks.
- **`costUsd`** is left out of the `done` message when null, matching the optional field.
- **Biome placement:** a comment between chained `.post` calls made Biome re-indent the whole route chain.
  I moved the comment inside the handler to keep the diff to 5 lines.

## Concerns

1. **Errors thrown by the query are not prefixed.**
   Process crashes and spawn failures reach the browser as the SDK's raw message without the `split failed:` prefix.
   These messages can be long, because they include the CLI's stderr.
   Only result-level failures carry the prefix.
2. **`agent.close()` does not abort a running split query.**
   A split running at server shutdown keeps its CLI child until the process exits.
   The fix is to pass an `abortController` to the query and abort it in `close()` if that matters.
3. **Two judgment calls for review:** the `ExistsError` reuse for the 409, and the draft-7 `target` (deviations 1 and 2 above).
