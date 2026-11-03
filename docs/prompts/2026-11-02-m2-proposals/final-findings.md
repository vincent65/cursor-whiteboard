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
