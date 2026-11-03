You are re-reviewing one task's fix round. A previous review produced findings; the implementer has attempted to fix them. Your job is to verdict each finding and inspect the fix diff, nothing else.

## The Task

Read the task brief: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-final-brief.md

## The Findings Under Verification

# Milestone 2 final review findings and controller rulings (review thread thr_wips97jyai)

Full review: final-review-report.md in this directory. Fix every numbered item below in this wave; leave the "deferred" list alone.

## Important
1. Board reads show `update` ghosts as fact (the new label is already in the stored board), and milestone 3's compile reads the same files. Ruling: normalize inside the export module so every consumer agrees: `excalidrawToBoardGraph` in `src/export/boardGraph.ts` drops elements tagged `ghost: "add"` (and their bound text) and, for elements tagged `ghost: "update"` with `before.label` set, uses `before.label` as the label; delete ghosts stay. Remove `withoutAddGhosts` from `src/server/agent/tools.ts` (the tools and the `PUT /boards/:name` export route then get it for free). Tests in `test/export/boardGraph.test.ts` (or the existing export test file) for both cases; keep the goldens unchanged.
2. A pending proposal can be orphaned on the server when the user deletes or undoes ghosts by hand. Ruling: `BoardView` reconciles: when the pending list computed in `onChange` drops an id that the previous list had, and no decision is in flight for it, it waits a 1 s grace period and, if the id is still absent from the scene's ghosts, posts `rejected` for it (a 404 is tolerated as today); the server's log then records the outcome. Add the pure part (`droppedProposals(prev, next)`) to `ghosts.ts` with a test; the timer and the post stay in `BoardView`.
3. No in-flight guard on Accept and Reject. Ruling: `BoardView` keeps a `deciding` set; `ProposalsBar` items gain `busy: boolean` and a busy row's three buttons are disabled; the set clears when the request settles. Test in `test/ui/ProposalsBar.test.tsx`.
4. The `applyProposal` → `restoreElements` seam has no persistent test. Ruling: add a jsdom test (`test/ui/restoreSeam.test.ts`, with the same canvas and FontFace stubs as `mermaid.test.ts`) that runs the `between` fixture through `applyProposal`, `listBoundArrows`, and the real `restoreElements(…, { refreshDimensions: true, repairBindings: true })`, asserting the arrow label survives, both arrows keep their bindings, and both targets list them in `boundElements`.
5. Decision notes are consumed at send time and lost if that send never runs. Ruling: `SessionDeps` gains optional `onNotSent(sendId: string)`, called by `PlanSession` for every held or queued send it drops (Stop, run ended) with that send's user-event id; `createAgent` remembers the notes attached to each send id until its turn's `result` arrives (or until the next send succeeds) and re-queues them through a new `ProposalStore.requeueNotes(notes)` when `onNotSent` fires; a synchronous throw from `session.send` re-queues them too. Tests in `session.test.ts` and `agentRoutes.test.ts`.

## From the deferred-list triage (fix in this wave)
6. Stale `target` closures after an await in `src/ui/board/BoardView.tsx` and `src/ui/panel/ClaudePanel.tsx`. Ruling: `useRefine`'s `setTarget` accepts an updater function; both call sites use `setTarget((t) => (t?.id === id ? null : t))`.
7. `renderMermaid` treats an empty `files` object as unsupported. Ruling: `Object.keys(files ?? {}).length > 0`.

## Minor (fix in this wave, each a few lines)
8. Accepting a `delete` leaves live arrows bound to the soft-deleted element. Ruling: in the accept branch, null the `startBinding`/`endBinding` of live arrows whose end is being deleted (and drop the arrow from nothing else); test in `ghosts.test.ts`.
9. The refine note gives Claude nothing to start from after a failed resume. Ruling: the note ends with ` Its current ops are: <JSON.stringify(p.ops)>`; update the test expectation.
10. The loop-local `arrow` string in `src/export/markdown.ts` shadows the `arrow` helper. Ruling: rename the local to `link`.

## Deferred (do not address)
- `refreshDimensions: true` rebuilds the whole scene per apply or decision (upgrade: restore only the changed elements).
- The proposal's board is whatever tab last reported a selection (an optional `board` on `Propose` would make a switch a clear error).
- Titles in a second tab after mount show as "changes".
- Undo after Accept brings ghosts back locally while the log says accepted (re-deciding hits the tolerated 404).
- Everything in the review's "Can wait" list.

## The Fix

Read the implementer's report (fix reports are appended at the end): /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-final-report.md

Fix base: 9dac292 (the head the previous review saw)
Head: dceb14a
Diff file: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/review-9dac292..dceb14a.diff

Read the diff file once; it contains the fix commits, a stat summary, and the fix diff with context. Do not re-run git commands. Your review is read-only on this checkout: do not mutate the working tree, the index, HEAD, or branch state.

## You Do Not Dispatch Subagents

Do all of this review yourself. Never spawn a subagent or another reviewer.

## Scope

Verdict every finding. Inspect the fix diff for new problems the fix itself introduced. Do not re-review code the fix did not touch; anything you notice outside the fix diff goes under Out-of-Scope Observations and does not block this task.

## Tests

The implementer re-ran the covering tests and appended the output to the report. Treat the report as unverified claims: confirm the fix report names the covering tests and shows their output, and verify the claims against the diff. Do not re-run the suite to confirm. Run a focused test only when reading the code raises a specific doubt no existing run answers.

## Output Format

Your final message is the report itself. Begin directly with the first finding's verdict.

### Finding Verdicts
For each finding, in order: ADDRESSED or NOT ADDRESSED, with file:line evidence. "Attempted" is not addressed.

### New Breakage in the Fix Diff
Severity and file:line, or "None".

### Out-of-Scope Observations
Non-blocking, or "None".

### Verdict
Fix round: all findings addressed with no new Critical/Important breakage, or findings remain open (list them).
