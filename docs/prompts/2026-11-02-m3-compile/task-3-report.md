# Task 3 report: Compile

Status: DONE

Commit: `7f1d6a6 feat(agent): the Compile action`

## What I implemented

- `src/server/agent/prompt.ts`: `COMPILE_INSTRUCTION`, verbatim from the brief (5 lines).
- `src/server/agent/index.ts`:
  - The body of `send` moved into a local `send(text, selection?, proposalId?, shown = text)` so `compile` goes through the exact same path (notes, refine check, `loadErrors` reset, `riding` bookkeeping, note requeue on throw).
    The public `Agent.send` signature is unchanged.
  - `Agent.compile()` sends `COMPILE_INSTRUCTION` with shown text `Compile the plan into spec.md` and returns the user event id.
  - Pending compile is tracked as `compiling: Promise<string> | undefined`.
    Stored as a promise, not an id, so two concurrent `compile()` calls (e.g. a double-click hitting two HTTP requests) get the same id: `send` awaits `header()` before calling `session.send`, so an id-only guard would let both through.
  - Cleared when a `result` event arrives (in the existing `onEvent` fan-out), per the brief.
  - Also cleared when the send throws, and when the session status becomes `error` or `stopped` (run crashed, run closed, Stop on a CLI still starting).
    Without this, a compile whose run ends with no result would return its stale id forever and Compile would never send again.
- `src/server/agentRoutes.ts`: `POST /compile` -> 202 `{ id }`.

## TDD evidence

RED (tests written first):

```
$ pnpm vitest run test/server/agent/prompt.test.ts test/server/agentRoutes.test.ts -t compile
 FAIL  test/server/agentRoutes.test.ts > POST /api/agent/compile returns 202 with the id
AssertionError: expected 404 to be 202
 FAIL  test/server/agentRoutes.test.ts > compile sends the instruction once while one is pending
TypeError: agent.compile is not a function
 Tests  2 failed | 22 skipped (24)
```

`-t compile` is case-sensitive, so it skips the `COMPILE_INSTRUCTION ...` test; ran it separately:

```
$ pnpm vitest run test/server/agent/prompt.test.ts -t COMPILE
 FAIL ... expect(COMPILE_INSTRUCTION).toContain(...)
 Tests  1 failed | 7 skipped (8)
```

After implementing `compile` but before the route, `pnpm vitest run test/server` showed only the route test failing (404), then GREEN after the route:

```
$ pnpm vitest run test/server
 Test Files  12 passed (12)
      Tests  145 passed (145)
```

`pnpm check`: clean, 36 files / 258 tests passing, no lint or type output.

## Tests added

- `prompt.test.ts`: `COMPILE_INSTRUCTION names the six sections in order and the citation grammar` (sections sentence, both citation forms, export glob, 5 lines).
- `agentRoutes.test.ts`:
  - `POST /api/agent/compile returns 202 with the id` (fake agent gained `compile`).
  - `compile sends the instruction once while one is pending` (stalling fake sdk): two concurrent compiles plus a third sequential one all return the same id and send one message; the decision note rides along before the instruction; the transcript has one user event with text `Compile the plan into spec.md`; after the turn's result (via interrupt releasing the stall), compile sends again with a new id.
  - `a compile whose send throws or whose run ends without a result can be sent again`: spawn failure rejects and clears; a run that crashes after init (status `error`, no result) clears.

## Manual observations

The brief names no manual verification.
I did not run Compile against a live Claude session, since it would write `.blueprint/spec.md` with a real model turn; the routes and session wiring are covered by the fake-sdk tests.

## Files changed

- `src/server/agent/prompt.ts`
- `src/server/agent/index.ts`
- `src/server/agentRoutes.ts`
- `test/server/agent/prompt.test.ts`
- `test/server/agentRoutes.test.ts`

## Self-review

- Brief said "tracked by the returned id"; I track the promise of that id. Same observable behaviour, plus it closes the concurrent-request race.
- The extra clear on `error`/`stopped` goes beyond the brief's "until the next result" but only covers paths where no result ever comes.
- Known ceiling, marked with a `ponytail:` comment: any result clears `compiling`, so a compile held behind another user turn is cleared by that earlier turn's result, and a second Compile click would queue a second compile.
  Harmless (it rewrites spec.md again) and matches the brief's "until the next result event".
  Retiring by id via `riding` was rejected because `riding` can retire a turn late after a cut-off turn, which could leave `compiling` stuck.
- The diff in `index.ts` looks large because `send`'s body moved from the object literal to a local function; `git diff -w` shows it is a move plus the `shown` parameter.

## Concerns

None blocking.
