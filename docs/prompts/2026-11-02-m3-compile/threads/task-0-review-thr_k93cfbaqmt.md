### Spec Compliance
- Issues found: the interface matches the brief (as amended in commits dc3454d and c484bd1), and both tests the brief asks for exist and assert what it says. However, the save-time reconcile breaks the browser's undo grace period for hand-removed ghosts. See Important #1.
- `reconcile` matches the brief's signature at `src/server/agent/proposals.ts:199-229`. It skips non-ghost and deleted elements (`:216`), proposals being revised (`:224`) and proposals inside the grace period (`:225`), and it returns the proposals it rejected.
- `routes(store, proposals?)` matches (`src/server/routes.ts:385`, `:409-415`), as do `createApp(store, agent?, proposals?)` (`src/server/app.ts:304-314`), `agent.proposals` (`src/server/agent/index.ts:66,88`) and the `startServer` wiring (`src/server/index.ts:340`).
- Test 1 (`test/server/agent/proposals.test.ts:651-672`): p_1 is rejected, logged and noted, while p_2 (live ghost), p_3 (being revised) and p_4 (other board) stay pending. It also covers a deleted ghost and an accepted element with no ghost tag.
- Test 2 (`test/server/routes.test.ts:775-811`): after the save, GET no longer lists p_1 and the last log line is the rejection. This matches the brief.
- Extra change: `test/server/agentRoutes.test.ts:727`. It is justified, because `fakeAgent` uses `satisfies Agent` and would not compile without the new field.
- Cannot verify from the diff:
  - That the commit messages carry no co-author trailer. The package shows subjects only.
  - The `pnpm check` and `pnpm build` output. I relied on the report.

### Strengths
- Splitting the store's private `decide()` out of `decided()` (`proposals.ts:192-194`, `:249-256`) avoids a deadlock on the `serial()` chain, and it keeps the whole check-then-log loop atomic.
- The clock is injected in one place, through the constructor (`proposals.ts:135`). It drives the stamps and the grace check, so tests cannot set the two inconsistently.
- Stamping `at` when the entry is logged (`proposals.ts:163-175`) correctly starts the grace period after the browser has drawn the ghosts.
- A failed reconcile does not fail a save that already succeeded (`routes.ts:409-415`).
- The server's ghost test (`ghost !== undefined`) is looser than the UI's `ghostOf`, so where they disagree the server keeps the proposal alive rather than rejecting it.
- I checked that every applied proposal leaves at least one ghost-tagged element: in `src/ui/board/ghosts.ts:203-246`, every op either gets claimed and tagged or throws. So reconcile cannot reject a valid proposal that simply has no ghosts.
- I checked accept ordering: `BoardView.tsx:412-429` tells the server before it strips ghost tags. So an autosave cannot reject a proposal the user is accepting.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The server rejects hand-removed ghosts before the browser's undo grace period ends.** (`src/server/routes.ts:409`, `src/server/agent/proposals.ts:220-227`)
   - The browser's own drop handling waits 1 s, so an undo can bring the ghosts back (`src/ui/board/BoardView.tsx:440-450`, timer at `:444`).
   - The autosave fires 500 ms after the last edit (`BoardView.tsx:226-231`).
   - With this change, deleting a ghost from a proposal older than 5 s causes a save at about 500 ms, and that save rejects the proposal on the server.
   - Failure scenario:
     1. The user deletes a ghost by mistake.
     2. About 700 ms later they undo, and the ghosts come back.
     3. The server has already logged `rejected` and queued the note "[Proposal p_x was rejected.]" for the agent.
     4. When the user then clicks Accept, the server returns 404, and `tellServer` resolves it locally (`BoardView.tsx:403-408`).
     5. The board shows an accepted proposal, while the log and the agent both say it was rejected.
   - Even without an undo, every hand removal now ends with the browser's 1 s timer calling `decideProposal` and getting a 404. That logs a `console.warn` in the browser (`BoardView.tsx:407`) on what is now the normal path.
   - The grace period guards the propose side only. It needs a counterpart on the removal side. One option: record when a pending proposal's ghosts were first seen missing, and reject only on a later save that is at least the browser's grace period after that. Another option: drop the browser's 1 s timer and let the server own the reconcile.
   - The brief is silent on this interaction. It is a regression in the gap this task was meant to close.

#### Minor (Nice to Have)
1. There is no test for the failure path at `routes.ts:409-415`, where a failing append inside reconcile should still return 200 and only warn. The partial-rejection behaviour the report describes is also untested.
2. The route test (`test/server/routes.test.ts:782-788`) can only use the real clock, because `createAgent` builds the store. It only works because the fixture `at` (`2026-11-02T00:00:00Z`) is before now; that time is today. A fixture well in the past, such as 2020, would remove any dependence on the clock.
3. Without a broadcast, the agent learns of a reconcile rejection only from the next decision note, and other tabs learn of it only when they next fetch. The report already raises this (concern 2), and the brief does not require it, but it matters together with Important #1.
4. The `proposal.apply` message still sends the browser the `at` the tool minted, while `/api/agent/proposals` returns the logging time (report, last note). Nothing compares the two today, but there are now two values for one field.
5. `createApp(store, agent, agent.proposals)` passes the store twice (`src/server/index.ts:340`, `test/server/routes.test.ts:793`). The brief mandates this signature, so it is plan-mandated, but defaulting to `agent?.proposals` would remove the redundancy.

### Assessment
Task quality: Needs fixes
Reasoning: The implementation matches the brief, and the store logic is sound, serialized and well tested. However, the 500 ms autosave reconcile now beats the browser's 1 s undo grace period. An undo can then leave the board, the proposal log and the agent disagreeing about the decision, and every hand removal produces a 404 warning in the browser.
