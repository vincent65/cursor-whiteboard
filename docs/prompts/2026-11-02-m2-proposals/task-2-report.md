# Task 2 report: the proposal store

## What I implemented

`ProposalStore` in `src/server/agent/proposals.ts`, matching the brief's interface exactly.

- State is a `Map<string, Proposal>` for pending (insertion order, so `pending()` is oldest first and a revision keeps its original slot), a `Set<string>` of every id seen, and a `string[]` of notes.
- `load()` replays `readProposals()`: `proposed`/`revised` set the record, `accepted`/`rejected` delete it, and every id goes into `seen`.
- `newId()` loops `p_` + `randomBytes(4).toString("hex")` until unseen, then adds the new id to `seen` so two calls before a `proposed()` cannot collide.
- `proposed`/`revised`/`decided` append the log line first and update memory only after the append succeeds, so a failed write leaves memory matching the log.
- `revised` and `decided` throw `NotFoundError("proposal <id> is not pending")` for ids not pending and write nothing.
- `decided` returns the record and queues `[Proposal <id> "<title>" was <decision>.]` (title via `JSON.stringify`) or `[Proposal <id> was <decision>.]` when the title is null.
- `takeNotes()` drains the queue.
- `pending()` and `get()` return the stored records themselves, as resolved; the class comment says callers must not mutate them.

One addition beyond the brief: mutations run through a small promise queue (`serial`).
Without it, two concurrent `decided("p_1", "accepted")` calls (for example a double-clicked Accept) both pass the pending check before either append finishes, so the log gets two `accepted` lines, two notes are queued, and the caller applies the proposal twice.
With the queue, the second call sees the proposal is gone and rejects with `NotFoundError`.
A test covers this.

## TDD evidence

RED (test written first, no module yet):

```
$ pnpm vitest run test/server/agent/proposals.test.ts
Error: Cannot find module '/src/server/agent/proposals.js' imported from .../test/server/agent/proposals.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN after the first implementation:

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

RED for the race test, added before the queue:

```
   × concurrent decisions on one proposal log it once 4ms
      Tests  1 failed | 5 passed (6)
```

GREEN after adding the queue:

```
      Tests  6 passed (6)
```

`pnpm check` before committing: both typechecks clean, `Checked 85 files in 54ms. No fixes applied.`, `Test Files 29 passed (29)`, `Tests 146 passed (146)`, no warnings or stderr.
(A first `pnpm check` run found a TS narrowing error in `apply()` on `entry.event` comparisons; fixed by narrowing with `"proposal" in entry`.)

## Tests

`test/server/agent/proposals.test.ts`, using a fake `files` object over an in-memory log array:

1. `load` replays proposed/proposed/revised/accepted into one pending `p_1` with the revised ops.
2. `proposed`, `revised`, `decided` write the right log lines and maintain pending; `takeNotes()` returns `[Proposal p_1 "Login flow" was accepted.]` and then `[]`.
3. A null title gives `[Proposal p_2 was rejected.]`.
4. `revised`/`decided` reject an unknown id and an already decided id with `NotFoundError` and the exact message, and append nothing.
5. `newId` skips ids seen in the log (decided and still pending) by mocking `node:crypto`'s `randomBytes` with queued bytes, and real ids match `/^p_[0-9a-f]{8}$/`.
6. Concurrent decisions on one proposal log it once.

## Manual verification

The brief names none.

## Files changed

- `src/server/agent/proposals.ts` (new)
- `test/server/agent/proposals.test.ts` (new)

## Commit

`3b81289 feat(proposals): the proposal store replays the log and tracks pending proposals`

## Self-review

- Interface, error message, id format, and note text match the brief and the resolutions verbatim.
- Imports use `.js` extensions; no new dependencies; only the two listed files.
- `proposed()` does not reject an id that is already pending; it replaces it.
  The brief does not ask for that check, and callers get ids from `newId()`.
- `load()` is not guarded against being called twice; replaying again yields the same state because set/delete are idempotent and the Map keeps first-insertion order.

## Concerns

None blocking.
The serialization queue is a small addition the brief did not spell out; it is easy to remove if the route layer serializes decisions itself, but I think keeping it in the store is the right call.
