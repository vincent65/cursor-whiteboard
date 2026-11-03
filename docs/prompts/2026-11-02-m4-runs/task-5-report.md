# Task 5 report: Other sessions in the repository

Status: DONE_WITH_CONCERNS

## What I implemented

- `src/server/agent/session.ts`: `export function transcriptFrom(messages: SessionMessage[]): PanelEvent[]`.
  It holds the loop `restore()` ran (interrupt marker as an interrupted result, typed prompts as user events with the compile label, everything else through `SdkEventMapper`).
  It dedupes by event id, as `#remember` did, so a text block split across transcript lines keeps one entry.
  `restore()` now does `for (const e of transcriptFrom(saved)) this.#remember(e);`, so the 500-event limit still applies there.
- `src/server/sessions.ts`: `OtherSession` and `listOtherSessions({ listSessions, root, exclude })`.
  It calls `listSessions({ dir: root, includeWorktrees: true, includeProgrammatic: true })`, drops excluded ids, sorts by `lastModified` descending, and maps to exactly the five `OtherSession` fields (`cwd` and `gitBranch` become `null` when absent).
- `src/server/runRoutes.ts`: `SessionRouteDeps` (`listSessions`, `getSessionMessages`, `root`, `exclude: () => Set<string>`) and `sessionRoutes(deps)`.
  - `GET /` returns `listOtherSessions` with the exclude set read per request, so a plan session or run started after the server came up is still left out.
  - `GET /:id/transcript` calls `getSessionMessages(id, { dir: root })` and throws `NotFoundError("session <id> not found")` when the array is empty; the app's error handler maps that to 404.
- `src/server/app.ts`: `createApp` takes an optional fourth argument `sessions?: SessionRouteDeps` and mounts `sessionRoutes` at `/api/sessions`.
- `src/server/index.ts`: wires the real SDK's `listSessions` and `getSessionMessages`, `root`, and `exclude = plan session id (agent.state().sessionId) + every run's sessionId (manager.list())`.

### Flaky test fix (separate commit)

`pnpm check` failed intermittently in `test/server/runs/manager.test.ts`, unrelated to this task:
- "events and statuses carry the run id for two concurrent runs" read `runs.run(b.id)?.sessionId` right after the live status turned idle, before the store's queued write landed (`expected "" to be "sess-beta"`).
- Several tests failed in `afterEach` with `ENOTEMPTY: directory not empty, rmdir .../.blueprint` because a run's last `sessions.json` write was still landing while `rm` ran.

Fixes: the session-id reads moved into a `vi.waitFor`; `RunStore` gained `settled()` (resolves once every queued write has landed or failed); and the manager test teardown awaits `runs.settled()` before `rm`.
Before the fix, 2 of 6 concurrent full-suite runs failed; after it, 8 of 8 concurrent runs passed.

## TDD evidence

RED (before any implementation):

```
$ pnpm vitest run test/server/sessions.test.ts
 FAIL  test/server/sessions.test.ts [ test/server/sessions.test.ts ]
Error: Cannot find module '../../src/server/sessions.js' imported from .../test/server/sessions.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

Refactor check after extracting `transcriptFrom` (restore tests unchanged):

```
$ pnpm vitest run test/server/agent/session.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

GREEN:

```
$ pnpm vitest run test/server
 Test Files  20 passed (20)
      Tests  187 passed (187)

$ pnpm check
Checked 124 files in 123ms. No fixes applied.
 Test Files  48 passed (48)
      Tests  323 passed (323)

$ pnpm build
(!) Some chunks are larger than 500 kB after minification.   <- pre-existing, the only warning
✓ built in 1.25s
```

Tests added in `test/server/sessions.test.ts`:
- `listOtherSessions excludes Blueprint's own sessions and sorts newest first`: asserts the exact `listSessions` options, exclusion, newest-first order, null-filled `cwd`/`gitBranch`, and that extra SDK fields (`fileSize`, `firstPrompt`) are dropped.
- `GET /api/sessions/:id/transcript maps a saved session and 404s an unknown one`: asserts the mapped events, the `{ dir: root }` call, the 404 body, and that `GET /api/sessions` reads the exclude set per request.

## Manual verification

Started the real server (`startServer({ root: <this repo>, port: 0 })` under `node --import tsx`) and hit the routes:

```
count 123 sorted true
first {"sessionId":"d151fe45-…","summary":"Other sessions listing for Blueprint","lastModified":1793690388659,"cwd":"/Users/vincentyip/programming/cursor-whiteboard","gitBranch":"m4-runs"}
keys sessionId,summary,lastModified,cwd,gitBranch
transcript 200 8 user,tool_use,tool_result,assistant_text
unknown 404 {"error":"session nope not found"}
traversal 404 {"error":"session ../../etc not found"}
```

Exclusion check: I temporarily wrote `.blueprint/sessions.json` with the second-newest session as the plan session and the third-newest as a run's session, started the server, listed, then deleted the file:

```
total 123 listed 121 plan excluded true run excluded true
```

The SDK's `getSessionMessages` returns `[]` for any id that is not a UUID (including `../../etc/passwd`), so those ids get a 404 and never reach the filesystem.

## Files changed

Commit `7649522 feat(server): list the repository's other Claude sessions with read-only transcripts`:
- `src/server/sessions.ts` (new)
- `src/server/agent/session.ts`
- `src/server/runRoutes.ts`
- `src/server/app.ts` (not in the brief's list; needed to mount `/api/sessions`)
- `src/server/index.ts` (not in the brief's list; needed to wire the real SDK and the exclude set)
- `test/server/sessions.test.ts` (new)

Commit `9ceef72 test(runs): manager tests wait for the store's writes before reading or removing them`:
- `src/server/runs/store.ts` (`settled()`)
- `test/server/runs/manager.test.ts`

`src/server/routes.ts` and `test/server/agent/session.test.ts` are unchanged; the existing restore tests cover the extraction.

## Self-review findings

- Where the routes live: the brief says "runRoutes.ts or routes.ts". `runRoutes` is mounted at `/api/runs`, so `/api/sessions` needs its own mount. I put `sessionRoutes` in `runRoutes.ts` and mounted it from `app.ts`. That made `app.ts` and `index.ts` necessary edits outside the brief's file list.
- `transcriptFrom` is all-or-nothing. Before, a mapper throw partway through `restore()` left the events already remembered and then the error event. Now it leaves only the error event, which is cleaner.
- The exclude set includes `""` for runs whose session has not reported an id yet. That is harmless, because a real session id is never empty.
- The transcript route returns the whole session, with no 500-event cap like the live panel has. For a local, read-only view this is fine, but a very long session gives a large JSON response.

## Concerns

- With `includeProgrammatic: true` (as the dispatch specified), the list also shows Blueprint sessions that are not in the exclude set: the headless split session (`splitSpec`) and any earlier plan session replaced after a failed resume. If those should be hidden, the split session id and earlier plan ids would need to be recorded somewhere. Decide in Task 6 or later.
- The brief's file list did not cover `app.ts` and `index.ts`, which were needed for the wiring, or the store/test change for the pre-existing flake (a separate commit).

## Fix round 1

Commit `a9204ea fix(server): other sessions hide headless ones, keep the last 500 events, and show saved times`.

1. `listOtherSessions` now passes `includeProgrammatic: false`, matching the terminal `/resume` picker.
   This hides Blueprint's split sessions, replaced plan sessions, and other headless SDK sessions.
   The test's expected options are updated.
   This resolves the first concern above.
2. `sessionRoutes` and `SessionRouteDeps` moved from `src/server/runRoutes.ts` into `src/server/sessions.ts`.
   `app.ts` imports them from there.
   `runRoutes.ts` is back to its Task 4 shape.
3. `GET /api/sessions/:id/transcript` returns `transcriptFrom(saved).slice(-TRANSCRIPT_LIMIT)`.
   `TRANSCRIPT_LIMIT` (500) is now exported from `agent/session.ts`, so the panel and the route share one constant.
   New test: `GET /api/sessions/:id/transcript keeps the last 500 events` (510 saved prompts give `u10`..`u509`).
4. `transcriptFrom` dates each event by its saved line.
   The SDK's `SessionMessage` type in `sdk.d.ts` has no timestamp field.
   At runtime, though, every line `getSessionMessages` returns carries `timestamp` as an ISO string (checked against real sessions, e.g. `2026-11-03T01:50:40.694Z`).
   So `savedAt(msg)` reads `timestamp` when it is a string and otherwise falls back to now.
   It applies to user, interrupted, and mapped events (`{ ...e, at }`).
   This also changes `restore()`: restored plan and run transcripts now show their original times.
   The route test asserts `at` on both the user and the assistant events.
   The fixture casts through `unknown`, with a comment, because tsc rejects the field the type leaves out.

### TDD evidence

RED, with the updated tests run against the committed source (src stashed):

```
   × listOtherSessions excludes Blueprint's own sessions and sorts newest first
   × GET /api/sessions/:id/transcript maps a saved session and 404s an unknown one
   × GET /api/sessions/:id/transcript keeps the last 500 events
      Tests  3 failed (3)
```

GREEN:

```
$ pnpm vitest run test/server/sessions.test.ts test/server/agent/session.test.ts
      Tests  23 passed (23)
$ pnpm check
Checked 124 files in 93ms. No fixes applied.
 Test Files  48 passed (48)
      Tests  324 passed (324)
```

`pnpm check` did not pass on the first try.
tsc rejected the `timestamp` fixture field, and biome flagged a trailing blank line left in `runRoutes.ts` by the move.
I fixed both, and the run above is clean.

### Manual check (real server on this repo)

```
all incl. headless 124 listed 0
biggest transcript events 500 first at 2026-11-03T04:34:37.698Z last at 2026-11-03T07:22:49.551Z
```

Every session in this repository was started through the SDK, so the filtered list is now empty here.
A terminal `claude` session in the repo would appear.
The largest saved session's transcript returns exactly 500 events, dated across its real three-hour span.

### Concerns

None new.
In this repository the other-sessions list is empty until someone starts a terminal session in it.
Keep that in mind when doing the manual check of the Task 6 sessions view.
