# Task 0 report: server-side proposal reconcile on save

Status: DONE_WITH_CONCERNS

Commit: `2625f7d fix(proposals): reconcile pending proposals against the saved board`

## What I implemented

- `ProposalStore.reconcile(board, elements)` in `src/server/agent/proposals.ts`.
  It runs on the store's `serial()` chain.
  It collects the `proposalId` of every non-deleted element whose `customData.ghost` is set.
  It then rejects each pending proposal of `board` that is not in that set and is not being revised, and returns the rejected proposals.
  A proposal being revised is skipped silently and checked again on the next save.
- `decided()` now calls a new private `decide()` inside `serial()`.
  `reconcile` calls `decide()` directly.
  It cannot call `decided()`, because that queues on the chain `reconcile` already holds, so it would deadlock.
  Rejections log the line and push the decision note the same way a manual reject does.
- `routes(store, proposals?)`: after `PUT /boards/:name` writes the board and its Markdown export, it awaits `proposals?.reconcile(name, board.elements)`.
  If reconcile fails, the route logs it with `console.warn` and the save still returns 200.
- `createApp(store, agent?, proposals?)` passes `proposals` to `routes`.
- `Agent` gains `proposals: ProposalStore` (`src/server/agent/index.ts`), and `startServer` calls `createApp(store, agent, agent.proposals)`.

## TDD evidence

RED (`pnpm vitest run test/server/agent/proposals.test.ts test/server/routes.test.ts`):

```
 FAIL  test/server/routes.test.ts > PUT /api/boards/:name reconciles pending proposals of that board
AssertionError: expected [ …(2) ] to deeply equal [ { id: 'p_2', board: 'flow', …(3) } ]
 FAIL  test/server/agent/proposals.test.ts > reconcile rejects a pending proposal with no ghost left on the board and skips one being revised
TypeError: store.reconcile is not a function
      Tests  2 failed | 19 passed (21)
```

GREEN (same command):

```
 Test Files  2 passed (2)
      Tests  21 passed (21)
```

`pnpm check` (tsc for both the UI and server configs, biome, vitest):

```
Checked 96 files in 73ms. No fixes applied.
 Test Files  35 passed (35)
      Tests  236 passed (236)
```

The full vitest run prints no warnings or stderr.

## Tests

- `test/server/agent/proposals.test.ts`: p_1, p_2 and p_3 are pending on `main`, and p_4 is pending on `flow`.
  p_1 has only a deleted ghost and an accepted, untagged element, so it is rejected, logged, and noted.
  p_2 has a live ghost and stays pending.
  p_3 is being revised (`beginRevise`) and stays pending.
  p_4 is on another board and stays pending.
- `test/server/routes.test.ts`: p_1 and p_2 are seeded in `proposals.jsonl` for `flow`.
  The test builds a real `createAgent` with an inert fake SDK.
  It saves a scene that has only p_2's ghost.
  Afterwards `GET /api/agent/proposals` lists only p_2, and the last log line is `rejected` for p_1.

## Files changed

- `src/server/agent/proposals.ts`, `src/server/routes.ts`, `src/server/app.ts`, `src/server/index.ts`, `src/server/agent/index.ts`
- `test/server/agent/proposals.test.ts`, `test/server/routes.test.ts`
- `test/server/agentRoutes.test.ts`: this file is outside the brief's list.
  Its `fakeAgent()` uses `satisfies Agent`, so it must have the new `proposals` field, or tsc fails.
  I added `proposals: new ProposalStore(store)`.

## Self-review

- Serialization: `reconcile` holds the chain for its whole loop, so a decision, a `beginRevise`, or a `revised` cannot run between its pending check and its log line.
- A failed append inside the loop stops the loop and rejects `reconcile`.
  Proposals already rejected stay rejected, both on disk and in memory, because `log()` updates memory only after the append.
  The route logs the error with `console.warn` and the save still succeeds.
- The ghost test is `customData.ghost !== undefined`.
  It does not check `customData.origin` or the exact kind, unlike `ghostOf` in the UI.
  This matches the brief's wording, "carries a ghost tag".
  An accepted element keeps `proposalId` but loses `ghost`, so it correctly does not keep its proposal alive.
- `createApp` takes `proposals` as an explicit third argument and does not default it to `agent.proposals`, because the brief specifies that signature.
  As a result, a test that passes only `agent` gets no reconcile.

## Concerns

1. Stale-save race (narrow, but real).
   `propose` asks the browser to draw the ghosts (`hub.request` "proposal.apply") and only then logs `proposed`.
   A `PUT` that the browser sent before it drew the ghosts can reach `reconcile` after `proposed` is logged.
   Two examples are an autosave already in flight and one that a slow `writeBoard` delays.
   That save has no ghosts, so it rejects a proposal that was just made.
   The ghosts then stay on the board for a proposal the server no longer has pending.
   The same applies to a second tab on the same board that does not have the ghosts, if the user chooses "Keep mine".
   That second case is arguably correct.
   A possible fix is to reconcile only proposals that were already pending when the request began, or to skip proposals younger than a short grace period, as the browser does.
   The brief does not specify either, so I did not add one.
   It should be decided before compile depends on this.
2. Neither `reconcile` nor the route broadcasts the rejection to the browser.
   The browser learns of it the next time it reads `/api/agent/proposals`.
   The brief does not ask for a broadcast.

## Fix round 0

Commit: `fix(proposals): reconcile only proposals older than the save grace period`

The ruling resolves concern 1.
The other two concerns stand as accepted.

### What changed

- `src/server/agent/proposals.ts` exports `RECONCILE_GRACE_MS = 5_000`.
- `reconcile(board, elements, nowMs = Date.now())` now also skips any pending proposal where `nowMs - Date.parse(p.at) < RECONCILE_GRACE_MS`.
  The next save checks it again.
- `p.at` is the time of the proposal's last `proposed` or `revised` entry, because the `revise` tool sets a fresh `at` on the new record.
- The route still calls `reconcile(name, board.elements)` and uses the real clock.
  Tests inject the clock through `nowMs`.
- New test in `test/server/agent/proposals.test.ts`: a proposal logged 1 s ago with no ghosts stays pending.
  The same proposal at 10 s is rejected.

### TDD evidence

RED (`pnpm vitest run test/server/agent/proposals.test.ts`):

```
 FAIL  test/server/agent/proposals.test.ts > reconcile leaves a proposal younger than the grace period for the next save
AssertionError: expected [ { id: 'p_1', board: 'flow', …(3) } ] to deeply equal []
      Tests  1 failed | 11 passed (12)
```

GREEN (`pnpm vitest run test/server/agent/proposals.test.ts test/server/routes.test.ts`):

```
 Test Files  2 passed (2)
      Tests  22 passed (22)
```

`pnpm check`:

```
Checked 96 files in 91ms. No fixes applied.
 Test Files  35 passed (35)
      Tests  237 passed (237)
```

### Self-review notes

- The earlier reconcile tests use the fixed `at` of 2026-11-02T00:00Z and the default real clock.
  That time is always more than 5 s in the past, so those tests are not affected.
- The tools set `at` before the browser round trip that draws the ghosts (`apply`), which has a 30 s timeout.
  If that round trip takes longer than 5 s, the grace period is used up before the ghosts exist.
  In normal use the round trip is milliseconds, so I made no change.
  To close this fully, the grace period could count from when the store logs the entry rather than from the record's `at`.

### Fix round 0, second ruling: stamp at logging time

Commit: `fix(proposals): stamp proposals with the time they were logged`

- `proposed(p)` and `revised(p)` now write `{ ...p, at }` to both the record and the log entry, where `at` is the store's clock at logging time.
  This overrides the `at` that the tool minted before the browser round trip.
  The tools still pass their own `at`.
- The clock is injected once, as an optional constructor argument: `new ProposalStore(files, clock = Date.now)`.
  It drives the `proposed`, `revised` and decision stamps, and reconcile's grace check.
  So `reconcile` no longer takes the `nowMs` parameter added earlier in this round.
  Two separate clock mechanisms would let a test set them inconsistently.
  The route's call is unchanged.
- Tests: `test/server/agent/proposals.test.ts` builds every store through `newStore(files)`, which has a mutable `clock`.
  The clock is reset to the fixtures' minted `at` before each test.
  - The existing "proposed, revised, and decided" test moves the clock 7 s past the minted time before `proposed`.
    It then asserts that the pending record and the log entry carry the logging time, not the minted one.
  - The first reconcile test moves the clock 10 s ahead before reconciling.
  - The grace test moves it 1 s ahead, where the proposal stays pending, and then to 10 s, where it is rejected.

RED (`pnpm vitest run test/server/agent/proposals.test.ts`, with the tests switched to the injected clock):

```
 FAIL  test/server/agent/proposals.test.ts > proposed, revised, and decided write log entries and maintain pending
AssertionError: expected [ { id: 'p_1', board: 'flow', …(3) } ] to deeply equal [ { id: 'p_1', board: 'flow', …(3) } ]
 FAIL  test/server/agent/proposals.test.ts > reconcile leaves a proposal younger than the grace period for the next save
AssertionError: expected [ { id: 'p_1', board: 'flow', …(3) } ] to deeply equal []
      Tests  2 failed | 10 passed (12)
```

GREEN (`pnpm vitest run test/server/agent/proposals.test.ts test/server/routes.test.ts`): 2 files, 22 tests passed.

`pnpm check`: biome reports no fixes; 35 files and 237 tests passed, with no warnings in the output.

Remaining note: the `proposal.apply` message still sends the browser the tool's minted `at`.
Only `/api/agent/proposals` and the log carry the logging time.
I found nothing that compares the two, so I left it as is.

## Fix round 1

Commit: `623b9ed fix(proposals): the server owns the reconcile with a removal grace period`

I made one commit because the findings depend on each other.
The two-strike rule changes what the route test expects.
The route test needs the clock injected through `createAgent` and the new `createApp(store, agent)` signature.

### Finding 1 (Important): the server alone owns the reconcile, with two strikes

- `src/server/agent/proposals.ts` exports `REMOVAL_GRACE_MS = 3_000`.
- The store keeps `missingSince: Map<id, ms>`.
- For each pending proposal of the board, `reconcile` does the following:
  - If the proposal has ghosts in the elements, it clears the mark.
  - If the proposal is being revised, or is younger than `RECONCILE_GRACE_MS`, it skips it.
  - Otherwise, if the proposal has no mark, it marks it with the current time.
  - If the mark is at least `REMOVAL_GRACE_MS` old, it rejects the proposal.
- `apply()` clears the mark for every new log entry (proposed, revised, accepted, rejected).
  So decisions and revisions clear it.
- `src/server/agent/tools.ts`: a new `read(board)` reads the stored board and calls `proposals.reconcile(board, file.elements)` before returning it.
  - `get_board` and `get_selection` use it before they build the "Pending proposals" line.
    `get_selection` now reads the board even when nothing is selected, so that line is reconciled too.
  - `propose` uses it for its id check.
  - `revise` calls it before it looks the proposal up, so a stale target fails with "not pending".
    It still reads the board a second time inside the `beginRevise` bracket for the id check.
    That keeps the existing guarantee that decisions are held off while the ids are checked.
  - `checkIds` now takes the `BoardFile` it is given.
- `src/ui/board/BoardView.tsx` no longer has the drop timer.
  I removed the `reconcileDrop` timer, the `drops` and `seen` refs, `decidingNow`, and the `droppedProposals` call.
  Hand removal now sends nothing from the browser, so the 404 warning is gone.
- Nothing else used `droppedProposals`, so I deleted it from `src/ui/board/ghosts.ts` along with its test in `test/ui/ghosts.test.ts`.
- `createAgent` takes an optional `clock` and passes it to the `ProposalStore`, so the route tests can inject time.

### Minors

2. New route test: the save still succeeds when `appendProposal` throws.
   The second save, 3 s after the first, returns 200 with the saved board.
   `console.warn` is called with "could not reconcile proposals on board flow: disk full".
3. The route fixtures use `at` = `2020-01-01T00:00:00.000Z`, and the agent's clock is injected (`2020-01-01T00:01:00Z`, then 3 s later).
4. `createApp(store, agent?)` passes `agent?.proposals` to `routes`; the third parameter is gone.
   `startServer` calls `createApp(store, agent)`.

### Tests (all time-dependent ones use the injected clock; none sleep)

- `test/server/agent/proposals.test.ts`:
  - The first reconcile without ghosts marks the proposal, and one 3 s later rejects it.
    A proposal being revised and one on another board stay pending.
  - A young proposal is not marked: a check at 1 s does nothing, 10 s marks it, and 13 s rejects it.
  - Removal grace period: mark, then +1 s keeps it, then ghosts back clears the mark.
    Missing again is a fresh mark, still pending at +2.999 s and rejected at +3 s.
  - A revision clears the mark.
- `test/server/agent/tools.test.ts`:
  - `setup()` injects the clock.
  - New test: `get_board`, `get_selection`, `propose`, and `revise` each reject a proposal that an earlier read marked 3 s before.
    It checks that the "Pending proposals" line disappears and that a revise of the stale target fails with "not pending".
  - The existing test "revise holds off decisions from before it reads the board for id checks" now delays the second `readBoard`, the id-check read, because the first read is now the reconcile.
  - "propose round-trips" now expects the pending record to carry the store's logging time.
    Before, it relied on the minted and logged times falling in the same millisecond, which could make it flaky.
- `test/server/routes.test.ts`: there is a shared `withProposals()` fixture.
  The two-strike save test checks that the first save keeps both proposals and the second rejects p_1.
  The append-failure test is described under minor 2.

RED evidence:

```
proposals.test.ts: Tests 4 failed | 10 passed (14)   (each: expected [p_x] to deeply equal [])
tools.test.ts:     FAIL every tool reconciles ... expected '# Board: flow ...' not to contain 'Pending proposals'
routes.test.ts:    FAIL ... rejects a pending proposal whose ghosts stay gone across saves: expected [ …(2) ] to deeply equal [ p_2 ]
                   FAIL ... still saves when the reconcile cannot append: expected "warn" to be called with arguments
```

GREEN: `pnpm vitest run test/server` gave 132 passed.
`pnpm check` gave 35 files and 240 tests passed, with no warnings in the test output.
I ran it twice: the first run failed only on biome formatting in two of my test files, which I fixed with `biome check --write`.
`pnpm build` warns only about the existing chunk size.

### Notes

- If a tool's reconcile cannot append to the log, the error now fails that tool call, and Claude sees it as the tool error.
  The route only warns, as before.
- Marks are kept in memory only.
  After a restart, a proposal whose ghosts are gone needs two strikes again, which is safe.
- A removal followed by no further edit is not rejected by saves alone, because autosave runs only on edits.
  The next tool read, or compile's read later, makes the second strike.
