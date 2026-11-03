Two of the concerns in your Task 5 report are correct and need a change before review. Fix them now, in this thread, on branch `m2-proposals`.

1. Group order. Excalidraw's `groupIds` lists the innermost group first and the outermost last, so the proposal id must be the LAST entry (`[...groupIds, proposal.id]`), not the first, for a whole proposal to move as one unit. Ruling: append it. Update the test that asserted `groupIds[0] === "p_1"` to assert `groupIds.at(-1) === "p_1"` and that any diagram-internal groups come before it.
2. Accepting an addition must not change its stroke style. Ruling: an `add` ghost snapshots its rendered `strokeStyle` in `before.strokeStyle` (like update and delete do), and `accepted` restores that value instead of forcing `solid`; `opacity` still goes to 100. Add a test with a dotted arrow that stays dotted after accept.

The other two concerns stand as designed: accepted additions keep the proposal group, and a label change on a shape with no text label throws `element <id> has no label` (the tool error tells Claude to use a note instead).

Then run `pnpm vitest run test/ui/ghosts.test.ts` and `pnpm check` once (pristine), commit with a conventional message and NO co-author trailer (for example `fix(ui): proposal group outermost and keep stroke style on accept`), append a "Fix round 0" section to your report, and end with the short status contract only.
