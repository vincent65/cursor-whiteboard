# Task 0 findings, round 1 (from review thr_k93cfbaqmt, with controller rulings)

## Important
1. The save-time reconcile (autosave at 500 ms) rejects a proposal before the browser's 1 s undo window ends, so an undo leaves board, log, and agent disagreeing, and every hand removal now ends with a 404 warning from the browser's own timer. Ruling: the server alone owns the reconcile, with a two-strike rule.
   - `ProposalStore` keeps a `missingSince: Map<id, ms>`. `reconcile` marks a pending proposal (outside the existing 5 s propose grace, not being revised) the first time its ghosts are missing; it rejects it only on a later reconcile at least `REMOVAL_GRACE_MS = 3_000` after the mark; if the ghosts are present again, the mark is cleared. Decisions and revisions clear the mark.
   - The tools also reconcile: `get_board`, `get_selection`, `propose`, and `revise` call `proposals.reconcile(board, storedElements)` on the board they read before using the pending list, so Claude never sees a stale "Pending proposals" line once the grace has passed.
   - Remove the browser's reconcile timer and `droppedProposals` usage from `src/ui/board/BoardView.tsx` (keep `droppedProposals` in ghosts.ts only if something else uses it; otherwise delete it and its test).
   - Tests: first missing save marks and keeps it pending; a save 1 s later keeps it; a save 3 s after the mark rejects it; ghosts back before that clears the mark; a tool read past the grace rejects it.

## Minor (fix in this round)
2. A failing append inside the route's reconcile is untested. Ruling: add a route test where the log append throws: the save still returns 200 and `console.warn` is called.
3. The route test depends on today's clock. Ruling: use a fixture `at` of `2020-01-01T00:00:00.000Z`.
4. `createApp(store, agent, agent.proposals)` passes the store twice. Ruling: `createApp(store, agent?)` takes the proposals from `agent?.proposals`; drop the third parameter.

## Deferred (do not address)
- No broadcast of a reconcile rejection (the next decision note and the next fetch carry it).
- The browser keeps the minted `at` from `proposal.apply`.
