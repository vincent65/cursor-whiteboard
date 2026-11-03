## Final review: m2-proposals (75105af..9dac292)

I read the full diff once, the design sections named in the brief, the plan's constraints and review focus, the deferred list, and the Task 8, 10, and 11 manual-run reports. For the named risks I read the Excalidraw 0.18.1 restore and binding internals, the importer's supported diagram switch, and the exporter. No commands mutated the checkout and no Claude session was started.

### Strengths

- **The lifecycle is sound end to end.** Validate (shared Zod, `checkRefs`, then ids against the stored board), round trip before logging, log after the browser acknowledges, ghost state in `customData`, decide server-first, revise under a per-proposal lock. A failed Mermaid parse or an unknown id leaves no trace anywhere, which the tools tests pin.
- **The anti-goal holds.** Every write path lands as a ghost; only `accepted` makes anything real. The `canUseTool` auto-allow is scoped to the server's source, not the tool name. The hook copy now points Claude at `propose`.
- **Restart and reload are handled.** The store replays the log, a torn tail is skipped with a warning and cut off by the next append, a corrupt log reports and does not take the server down, and the bar rebuilds from the scene. The acceptance report confirms step 5 with a real restart.
- **The pure ghost module is well tested** against what Excalidraw really does: bound text found by `containerId` not `boundElements`, groups appended outermost-last, soft deletes with `isDeleted`, `originalText` as the label source, two ops on one element, cross-proposal claims, and identity-preservation of untouched elements.
- **Session gating is better than M1.** Holding sends in the session instead of the SDK queue is what makes Stop actually drop them. The one-result-per-send assumption is written down next to the code, and the interrupted and error-result paths are tested.
- **Execution corrected itself.** Tasks 8b and 11 came from real-login runs, not speculation, and the "between" placement fix landed with a pure helper and tests.

### Issues

#### Critical (Must Fix)

None.

#### Important (Should Fix)

1. **`src/server/agent/tools.ts:57` - the board Claude reads shows update ghosts as fact.** `withoutAddGhosts` hides additions, but an `update` ghost's new label is already in the stored board, so `get_board` and `get_selection` report "Dashboard" while the rename is still pending. The system prompt tells Claude never to treat a change as landed until accepted, and the tool contradicts it. Milestone 3's compile will read the same files and bake pending renames into the spec. Fix: rename the helper to `withoutGhosts` and, for elements tagged `ghost: "update"` with `before.label` set, swap the label text in the bound text (or own text) before exporting. Delete ghosts are correct as is (the element still exists).

2. **`src/ui/board/BoardView.tsx:425` - a pending proposal can be orphaned on the server with no outcome ever logged.** If the user removes ghosts the ordinary way (select, Delete) or presses Cmd+Z right after they appear, the bar disappears but the server still lists the proposal. From then on every `get_board` says "Pending proposals on this board: p_x", Claude may try to revise it, and `proposals.jsonl` never gets an outcome for it. This is a first-hour action. Fix: reconcile scene against server. When the pending list computed in `onChange` drops an id that the previous list had and no decision is in flight for it, post `rejected` for it (the ruling that the board is the record already points this way). Guard the apply window by ignoring ids whose `proposal.apply` has not been acknowledged yet.

3. **`src/ui/board/ProposalsBar.tsx:33` - no in-flight guard on Accept and Reject.** Two clicks on one row send two decisions. The second gets a 404 and is applied locally, which is a no-op in the common case, but Accept then Reject in flight together can land the reject's local change after the accept's log line, leaving the board rejected and the log accepted. The fix is a `deciding` set in `BoardView` that disables the row's buttons until the request settles. Five lines.

4. **Test coverage - the `applyProposal` to `restoreElements` seam has no persistent test.** Two bugs already came from that seam (the zero-size arrow label dropped by `isInvisiblySmallElement`, and `repairBindings` not listing arrows on their targets), and both were found by hand. The Task 11 report says the jsdom check that proved the label fix was deleted. Add one jsdom test that runs the `between` fixture through `applyProposal`, `listBoundArrows`, and the real `restoreElements(…, { refreshDimensions: true, repairBindings: true })`, asserting the label survives, both arrows keep their bindings, and the targets list them.

5. **`src/server/agent/index.ts:178` - decision notes are consumed at send time and lost if that send never runs.** `takeNotes()` empties the queue before the session accepts the message. A send held behind a turn and then dropped by Stop, or a send whose `session.send` throws, loses the acceptance or rejection note. Claude then never hears that the proposal landed. Fix: take the notes only after the session has accepted the send, or re-queue them when the send is reported as not sent.

#### Minor (Nice to Have)

- `src/ui/board/ghosts.ts:471` - accepting a `delete` of a shape leaves arrows bound to a soft-deleted element. Excalidraw's own delete runs `fixBindingsAfterDeletion`; restore only nulls bindings whose target is absent from the map, and the map includes deleted elements. The exporter copes (`liveId` returns null), and the arrow unbinds on its next drag, but the binding is stale until then. Null the bindings of live arrows whose end is being deleted in the accept branch.
- `src/ui/board/BoardView.tsx:97` - `refreshDimensions: true` re-measures every text element in the scene on every apply and decision, and every element becomes a new object. Harmless at MVP sizes, but it is the whole scene being rebuilt for one proposal. Restoring only the changed elements and merging would be the upgrade.
- `src/ui/board/mermaid.ts:16` - `if (files || …)` treats an empty `files` object as unsupported. The 3.2.0 importer returns `undefined` for the five laid-out kinds today, but one upstream change would reject every diagram. Use `Object.keys(files ?? {}).length`.
- `src/ui/board/BoardView.tsx:412` and `src/ui/panel/ClaudePanel.tsx:152` - stale `target` closures after an await. Use the functional setter keyed on the id that was sent or decided.
- `src/server/agent/index.ts:180` - the refine note tells Claude to send "the complete new op list" but gives it nothing to start from. After a failed resume the ops are gone from context. Append `JSON.stringify(p.ops)` to the note; the record is already in hand.
- `src/server/agent/tools.ts:82` - the proposal's board is whatever tab last reported a selection, not what Claude was reading. If the user switches boards while Claude thinks, an add-only proposal lands on the new board silently. An optional `board` on `Propose` that must equal the open board would make this a clear tool error.
- Titles in a second tab: `listProposals` runs once per mount, so a proposal made after mount in another tab shows as "Claude proposed changes".
- `src/export/markdown.ts:97` - the loop-local `arrow` string shadows the new `arrow` helper. Rename one.

### Deferred-list triage

**Fix before merge** (each is minutes of work and closes a real gap):

- Task 8b "no in-flight guard on Accept/Reject" (Important 3 above).
- Task 8 "undo after a decision or after an apply is not synced with the server's pending set" - the apply half is Important 2; the decision half (undo after Accept brings ghosts back locally while the log says accepted) can stay deferred, since re-deciding hits the tolerated 404 and leaves no broken state.
- Task 9 "a resolving send can clear a newer refine target" and Task 8b "stale `target` closure" - same two-line fix with the functional setter.
- Task 6 `files` empty-object check.

**Can wait** (cosmetic, test-only, or already covered elsewhere): `_registeredTools` access (ruled, consistent with M1); Task 1 schema-branch test, `prettifyError`, `Proposal` declared twice; Task 2 `newId` and `queued` test hygiene, `load()` comment; Task 3 `revising undefined`, fixture leak; Task 4 helper placement; Task 5 zero counts for a label-only update, shapes-only counts (the better reading); Task 7 client-side proposal calls untested (the routes pin the contract, and `api.test.ts` now covers the error shape); Task 8 ghosts drawn under the conflict banner; Task 8b `arrow` shadow, the 404/409 branch test, prompt id sources, Arrows bullet direction versus the reversed Mermaid line; Task 9 chip naming an already-decided proposal, selection-plus-refine untested; Task 11 self-loop check only on the server.

**Rulings:** none looks wrong. Two deserve a note. "Board exports hide add ghosts" is right but incomplete; update ghosts leak their new values (Important 1). "A 404 applies locally with a warning" is the right call for a board-is-the-record design, but it is what turns the double-click race into a log mismatch, so it needs the in-flight guard beside it. The forward-then-log order (a deviation from design section 4 step 5, which says store then forward) is a justified improvement: nothing is logged that the user never saw.

### Declined to judge

- Claude deleting and redrawing both boxes before Task 11 existed: a capability gap the branch fixed, not a defect in the reviewed head.
- The importer routing a flowchart edge through a box: upstream layout in `@excalidraw/mermaid-to-excalidraw`.
- `ToolSearch` and "(non-text result)" rows on a cold session: SDK behaviour, carried as the M1 deferred item.
- The Cache node being 67x35 with sharp corners beside hand-drawn rounded boxes: the plan's skeleton has no size or roundness; a design choice for a later pass.
- Ghost elements being persisted into the committed board file (a pending proposal shows in a git diff): an explicit plan call ("the board file is the single source of truth"); its downstream effect on compile is Important 1.
- Two parallel `propose` calls from one assistant message placing both groups at the same anchor: cosmetic overlap, no torn state since the scene read and write are synchronous after the renders.
- Bash writes to `.blueprint/boards/` bypassing the `PreToolUse` hook: M1 territory, and the permission dialog covers Bash.
- The design's section 9 "fake SDK selected by an environment variable": milestone 5 scope.

### Recommendations

- Land Important 1 before milestone 3 starts, because compile reads the same board files; put the normaliser in `src/export` so both the tools and the compiler use it.
- Add the restore-seam test (Important 4) now; it is the cheapest insurance on this branch and it would have caught both hand-found bugs.
- Consider a `revised` note like the decision notes ("[Proposal p_x was revised; its current ops are …]") so Claude after a failed resume can still refine.

### Assessment

Ready to merge? **With fixes**

Reasoning: the milestone's "done when" row is met and verified with real-login runs, the anti-goal holds, and the failure paths are tested; but the server's pending set can drift from the board through ordinary user actions (undo, Delete, a double click), and Claude is shown pending renames as fact, which should be closed before milestone 3 builds on this.
