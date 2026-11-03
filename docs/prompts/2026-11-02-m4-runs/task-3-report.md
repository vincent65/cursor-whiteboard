# Task 3 report: the run manager

Status: DONE_WITH_CONCERNS

Commit: `e00ee9e feat(runs): the run manager drives one session per task in its worktree`

## What I implemented

- `src/shared/messages.ts`: `run.event`, `run.status`, and `runs.changed` added to `ServerMessage`.
- `src/server/runs/manager.ts`: `RunManager`, `LaunchOptions`, `RunView`, with the brief's API.
  - Each run gets its own `PermissionBroker` and `PlanSession` (cwd = worktree, `systemPrompt` preset with no append, the launch's `permissionMode`, `PreToolUse` hook `denyBoardWrites(worktree)`, no `mcpServers`, `canUseTool` straight to the broker).
  - `launch`: finds the task through `listTasks` (`NotFoundError` if unknown), reads the spec (`""` if missing), creates the worktree, saves a `working` record with `sessionId: ""`, broadcasts `runs.changed`, sends `runPrompt` with `taskFile: .blueprint/tasks/<file>`.
  - Status derivation: session `starting`/`working` -> `working`; broker pending -> `needs_you`; `idle` -> `done` (sets `prUrl`) if `prUrlIn` finds a URL in the last non-partial `assistant_text` of the turn the last `result` ended, else `idle`; `error` -> `failed` with the message; `stopped` -> `idle`.
    `endedAt` is set for `done`/`failed` and cleared (`null`) for every other status, so a done run that is messaged again reads `working` with no end time; `prUrl` is kept.
  - Every derived change patches the record and broadcasts `run.status`; every event broadcasts `run.event` with the run id; new permission asks broadcast as `run.event` permission events, as the plan agent does.
  - Every store patch broadcasts `runs.changed` once it is on disk.
  - The manager keeps an in-memory copy of each live record ahead of the serialized store writes, so `list()`, `resume()`'s status check, and status comparisons never read a write that has not landed yet.
  - `start()` marks `working`/`needs_you` records `interrupted` with `endedAt: null`, then broadcasts `runs.changed` (only if it changed something).
  - `message()` sends to the live session, or opens one with the record's session id as resume id (a run from an earlier server); `NotFoundError` for unknown ids.
  - `resume()`: `NotFoundError` for unknown ids, `ExistsError` (the existing 409 class) unless the run is `interrupted`; opens the session in the worktree with the saved session id and sends `Continue the task where you left off.`.
  - `stop()`: cancels the broker's asks, then `session.interrupt()`; status follows the session.
  - `answerPermission()` returns `false` for an unknown run or ask.
  - `transcript()`: `NotFoundError` for unknown ids, the live session's transcript, or `[]`.
  - `close()`: sets a closing flag (so the session's `stopped` and the broker's cancel do not patch records), cancels asks, closes sessions; records keep their last status.
- `test/server/agent/fakeSdk.ts`: the fake sdk (`sdk`, `init`, `textTurn`, `fakeQuery`, `turnsOf`, `Script`, fixture types) extracted verbatim from `session.test.ts`, which now imports it; its 20 tests still pass.
- `test/server/runs/manager.test.ts`: the six tests the brief names, using a real `FileStore`/`RunStore` in a temp dir, a fake hub, the fake sdk, and a fake git.

## Deviation from the resolutions

- `costUsd`: the resolution says it is the `result` event's `costUsd`.
  I store `costAtProcessStart + result.costUsd` instead: on the session's `starting` status (a new CLI process) the manager snapshots the record's cost, and each result adds its total to that.
  For a run that lives in one process this is exactly the result's `costUsd`; for a resumed or restarted run (new process, whose totals restart at zero) it keeps what was already spent instead of overwriting it.
  The resume test asserts `0.5 + 0.01`.
- The turn text used for the PR check is also cleared on `starting`, so a failed turn's text (an error result is mapped to an `error` event, not a `result`) cannot make a later turn of the next process `done`.
  The error test covers it; I confirmed it fails with the reset removed.

## TDD evidence

RED:

```
$ pnpm vitest run test/server/runs/manager.test.ts
 FAIL  test/server/runs/manager.test.ts [ test/server/runs/manager.test.ts ]
Error: Cannot find module '../../../src/server/runs/manager.js' imported from .../test/server/runs/manager.test.ts
 Test Files  1 failed (1)
```

First GREEN attempt failed one test: my `saved()` helper compared disk to `RunStore.run()`, which can match between two queued writes.
It now waits until the disk record equals the manager's view, which is what the record will be once every queued write lands.

GREEN:

```
$ pnpm vitest run test/server/runs/manager.test.ts   (x5)
      Tests  6 passed (6)
$ pnpm check
Checked 117 files in 103ms. No fixes applied.
 Test Files  45 passed (45)
      Tests  309 passed (309)
```

Mutation check: deleting the turn-text reset makes `an error result fails the run with the message` fail; restored, it passes.
Repeated runs of the manager and session tests (3x) all passed.

## Manual verification

The brief names none.
None done: a real run needs the routes (Task 4) and a real Claude login.

## Files changed

- `src/server/runs/manager.ts` (new)
- `src/shared/messages.ts`
- `test/server/runs/manager.test.ts` (new)
- `test/server/agent/fakeSdk.ts` (new)
- `test/server/agent/session.test.ts` (imports the fake sdk instead of defining it)

## Self-review findings

- Fixed: the deps type was written twice (field and constructor); now one `RunManagerDeps` type.
- Fixed: stale turn text across a failed process (see above).
- Checked: `close()` does not turn active records `idle`, so `start()` reads them as `interrupted` next time.
- Checked: `start()` broadcasts nothing when no record changed.

## Concerns

- Permission mode is not saved on `RunRecord`, so a session reopened by `message()` or `resume()` after a restart uses `acceptEdits`, not the launch's mode (marked `ponytail:` in the code).
  A run launched with `default` would get fewer prompts after a restart; adding `permissionMode` to `RunRecord` fixes it if wanted.
- `transcript()` returns only what this process saw; a run from an earlier server shows no history until it resumes (marked `ponytail:`); `PlanSession.restore()` could load it if the sessions view needs it.
- A run that crashed before the CLI's init has `sessionId: ""`; resuming it starts a fresh session whose first message is `Continue the task where you left off.` with no context.
- `denyBoardWrites`' deny reason says "Propose changes with the propose tool instead", but run sessions have no propose tool; the hook is reused as the brief says, so the wording is slightly off for runs.
- `resume()` throws `ExistsError` for a non-interrupted run because it is the class `statusFor` already maps to 409, which Task 4's route wants; the name reads oddly for this case.

## Fix round 0

Rulings applied: cost accounting and `ExistsError` for a non-interrupted resume were accepted as they are.
The three requested changes are done.

Commits:

- `0d108c6 feat(agent): the board-write guard takes the reason it gives`
- `6dce619 fix(runs): a run keeps its permission mode and transcript across a restart`

### 1. Permission mode survives a restart

- `src/shared/types.ts`: `RunPermissionMode = "acceptEdits" | "default" | "bypassPermissions"`; `RunRecord.permissionMode`.
- `src/server/files.ts`: the sessions schema reads `permissionMode` with `.default("acceptEdits")`, so older records parse as `acceptEdits`.
- `src/server/runs/manager.ts`: `launch` stores the mode; every session is built from `record.permissionMode`; `LaunchOptions.permissionMode` is `RunPermissionMode`; the `ponytail:` note about the lost mode is gone.
- Fixtures in `test/server/runs/store.test.ts` and `test/server/agentRoutes.test.ts` gained the field.
- New test `a run launched with default resumes with default after a restart`: launch with `default`, close, reload the store from disk, start a new manager, resume; the query runs with `permissionMode: "default"` and `resume: "sess-d"`.
- The start test now writes raw records without `permissionMode` and asserts they read as `acceptEdits`.

### 2. Transcripts after a restart

- `start()` now builds a session for every record (after marking active ones interrupted), not started, with the saved session id and the worktree as cwd, and awaits `session.restore()`.
  `resume()` and `message()` reuse that session object; `#liveFor` still opens one if `start()` was never called.
- The `ponytail:` note on `transcript()` is gone.
- The start test now gives the fake sdk a saved transcript and asserts: `getSessionMessages` is called with the saved id and `{ dir: worktree }`; `transcript()` returns the saved events after `start()`; no `run.status` fires during restore; after `resume()` the same session's transcript is the saved turn, then `Continue the task where you left off.`, then the reply.
- I first added a `restoring` flag to keep restore's idle status from deriving a run status.
  Its mutation survived: a new `PlanSession` already reads `idle` and `setStatus` skips an unchanged status, so `restore()` never calls `onStatus`.
  I removed the flag and left a one-line comment saying why.
- Behaviour to know: `PlanSession.restore()` treats an empty or unreadable saved session as lost and drops the id, so resuming that run starts a fresh session (the plan panel works the same way).
  The restart test gives the fake sdk a non-empty saved session for that reason.

### 3. Board-write denial reason

- `src/server/agent/hooks.ts`: `denyBoardWrites(root, reason = PLAN_REASON)`; the plan session's text is unchanged.
- Run sessions pass `Blueprint board files are read-only in a run. Leave the board to the user.`
- New hooks test `denyBoardWrites gives the reason it was built with`; the launch test calls the run session's `PreToolUse` hook on a board write and asserts the run reason.

### Evidence

This round I wrote the implementation before the tests, so I proved each test by mutating its fix:

```
== mode not used        -> launch test and restart test fail
== no restore           -> start test fails
== plan reason          -> launch test fails
== no restoring guard   -> 7 passed (dead code; removed)
restored                -> Tests  7 passed (7)
```

```
$ pnpm check
Checked 117 files in 77ms. No fixes applied.
      Tests  311 passed (311)
$ pnpm vitest run test/server/runs test/server/agent   (x4)
      Tests  121 passed (121)
```

### 4. Resume with no usable session id

Ruling: when `resume()` has no session id (none was saved, or `restore()` dropped it), it sends the full run prompt instead of the continue message.

Commit: `73e6e3b fix(runs): a resume with no session to continue sends the full run prompt`

- `src/server/runs/manager.ts`: `resume()` sends `Continue the task where you left off.` when the session has an id, else `runPrompt` rebuilt from the task file, the spec, and the record's branch.
  The task-file and spec lookup moved into `#promptInput(taskSlug)`, shared with `launch` (`NotFoundError` for an unknown task in both).
  The interrupted check moved into `#interrupted(runId)` and runs again after the lookup's await, so two resumes at once cannot both send.
- New test `resume with no usable session id sends the full run prompt instead`: one interrupted record with `sessionId: ""` and one whose saved session loads empty (so `restore()` drops it); both resume with no `resume` option and read exactly the run prompt for task `beta` on `blueprint/beta`; the new session id lands on the record; two concurrent resumes of one run give one success and one `ExistsError`.
- Mutations: always sending the continue message fails the new test; dropping the re-check fails it too; restored, 8 of 8 pass.
- `pnpm check`: `Checked 117 files ... No fixes applied.`, `Tests  312 passed (312)`; the manager tests passed 3 more times in a row.

### Remaining concerns

- `start()` reads every run's saved session at startup; fine for a handful of runs, and lazy loading in `transcript()` would be the upgrade if the list grows long.

## Fix round 1

Source: `task-3-findings-1.md` (review thr_u3ygb5ufvt with controller rulings).
All six findings are fixed; the deferred item (lazy transcript loading in `start()`) is left alone.

Commits:

- `d7f5676 feat(agent): the board-write guard checks every root it is given`
- `6e77fd4 feat(agent): an error result's event carries what its process spent`
- `a6ca48d fix(runs): fresh sessions get the run prompt, the live board is guarded, and failed spend counts`

### 1. `message()` to a session with nothing to resume (Important)

- New `#fresh(live)`: the session has no id and no turn in flight (`starting`/`working`).
  The turn-in-flight condition matters: a launch's first turn has no id until the CLI's init, and a message then must not repeat the prompt.
- New `#freshPrompt(live)`: the run prompt built through `#promptInput` when fresh, else `null`; `resume()` uses it too (`prompt ?? CONTINUE`).
- `message()` sends `<run prompt>\n\n<text>` when fresh, re-checking `#fresh` after the await so two concurrent messages send the prompt once; the user event shows only the typed text.
- Tests: `message with no usable session id sends the run prompt, then the text` (a failed run with no saved id, and one whose saved session restore dropped; two concurrent messages to the second; a later message once the session has an id is just the text) and `a message during a launch's first turn, before the CLI reports an id, is just the text`.

### 2. The live board under the repository root (Important)

- `denyBoardWrites(roots: string | string[], reason)` denies when the resolved path is protected under any root; relative paths still resolve against the hook's `cwd`.
- Run sessions pass `[root, worktree]`.
- Tests: hooks test `denyBoardWrites with several roots denies a board under any of them` (relative `../../boards/x.excalidraw.json` from the worktree, an absolute root path, and the worktree's own board are denied; `src/x.ts` in the worktree is allowed); the manager launch test now writes to the root's absolute board path through the run's hook.

### 3. A failed process's spend (Minor)

- `PanelEvent` `error` gains optional `costUsd`; `SdkEventMapper` sets it from an error result's `total_cost_usd`.
- The manager adds an `error` event's `costUsd` to the run's cost exactly as it does a `result`'s.
- Tests: the two events tests for error results now expect `costUsd`; the manager error test asserts the failed run's cost is `0.02`, then `0.03` after the next process spends `0.01`.

### 4. Multi-turn cost (Minor)

- `textTurn` in `fakeSdk.ts` takes an optional running total (default `0.01`).
- Test `a process's running total is the run's cost, not the sum of its results`: two turns in one query report `0.01` then `0.03`; the record ends at `0.03`.
  It passed on the existing code (it pins behaviour); it fails if results are summed (mutation below).

### 5. `INTERRUPTED` renamed to `INTERRUPTED_REASON`.

### 6. `onEvent` after `close()` (Minor)

- `onEvent` returns early once `close()` began, like `onStatus`.
- Test `events after close are not broadcast`: `start()` is held on `getSessionMessages`, `close()` runs, then the load resolves empty; the session records the restore error in its transcript and no `run.event` is broadcast.

### Evidence

RED (before the implementation):

```
$ pnpm vitest run test/server/runs/manager.test.ts test/server/agent/hooks.test.ts test/server/agent/events.test.ts
   × denyBoardWrites with several roots denies a board under any of them
   × an error result becomes an error event with the joined messages
   × a success result flagged is_error becomes an error event with its result text
   × launch creates a worktree, a working record, and sends the run prompt
   × an error result fails the run with the message
   × a process's running total is the run's cost, not the sum of its results   (my status expectation was wrong; fixed, then it passed on existing code)
   × message with no usable session id sends the run prompt, then the text
   × events after close are not broadcast
      Tests  8 failed | 15 passed (23)
```

Mutations on `manager.ts`, each caught by at least one test, then restored:

```
message never prepends            -> message test fails
message no re-check after await   -> message test fails
#fresh ignores the turn in flight -> message test and launch-first-turn test fail
onEvent without the closing guard -> events-after-close test fails
error cost ignored                -> error test fails
guard on the worktree only        -> launch test fails
results summed, not totals        -> running-total test fails
resume no re-check after await    -> resume test fails
```

Flakiness found and fixed: the first full `pnpm check` failed 1 of 317, and repeated runs failed 1 or 2 of 127.
The cause was in my tests: the concurrent-resume test (round 0) and the concurrent-message test assumed which of two calls finishes its task-file read first.
Both now assert order-independently (exactly one resume refused; exactly one message carries the prompt), and both still catch their re-check mutations.

GREEN:

```
$ pnpm check
Checked 117 files in 101ms. No fixes applied.
      Tests  317 passed (317)
$ pnpm vitest run test/server/runs test/server/agent   (x8)
      Tests  127 passed (127)
```
