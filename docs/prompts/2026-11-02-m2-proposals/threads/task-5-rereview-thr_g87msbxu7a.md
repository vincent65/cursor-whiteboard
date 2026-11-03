### Finding Verdicts

1. **Cross-proposal targets: ADDRESSED.**
   The validation loop now reads `ghostOf(target)?.proposalId` and throws `element ${op.id} is in pending proposal ${other}` when that id differs from `proposal.id` (`src/ui/board/ghosts.ts:131-135`).
   The check runs in the validation pass, before `out` is built, so a refused proposal changes nothing.
   Same-proposal re-targeting still reaches the existing `snapshot` merge, where the first op wins.
   Accepted and rejected elements carry no `ghost` key, so `ghostOf` returns null for them and they stay targetable (`ghosts.ts:52-58`).
   A label tagged by another proposal's delete cannot slip through: its container carries the same tag, and an op that names the label id directly is caught by the same check.
   Test: `an element in another pending proposal is refused before anything changes` (`test/ui/ghosts.test.ts:394-410`) covers both delete and update from `p_2` and asserts the input is unchanged.

2. **Wrapped label snapshot: ADDRESSED.**
   The snapshot is now `before.label = label.originalText ?? label.text` (`ghosts.ts:246-247`).
   Reject already writes that value to both `text` and `originalText`, for a separate label and for a text element that is its own label (`decideProposal`, `ghosts.ts:~318-321`).
   Test: `a wrapped label rejects back to its original text` (`test/ui/ghosts.test.ts:412-432`) uses the ruled fixture (`text: "A long\nlabel"`, `originalText: "A long label"`).
   It asserts the snapshot value, and that both fields equal `"A long label"` after reject.

3. **Empty rendered group: ADDRESSED.**
   Validation throws `op ${i} rendered nothing` when `bounds` of the group is null, which covers both an empty group and an all-deleted group (`ghosts.ts:144-145`).
   The silent `if (!b) return` is gone.
   The `as Bounds` cast at `ghosts.ts:171` is safe because validation guarantees it.
   Test: `an add op that renders nothing throws` (`test/ui/ghosts.test.ts:434-443`).

4. **Delete ghost label fade: ADDRESSED.**
   The bound label gets `opacity: GHOST_OPACITY` and its own `tag("delete", snapshot(label, { opacity, customData }))` (`ghosts.ts:213-224`).
   `pendingProposals` counts only elements without a `containerId` (`ghosts.ts:107-108`).
   I traced `decideProposal` for both array orders:
   - **Accept:** the container's `patch(label, { isDeleted: true })` and the label's own delete ghost both soft-delete the label. A label already deleted is skipped by `labelOf` or by the `isDeleted` check.
   - **Reject:** the label restores its own opacity and `customData`.
   - **Same-proposal update, then delete:** the container's `before.label` patch and the label's own restore touch disjoint fields, so they compose in either order.

   Test: `a delete ghost fades its label too and counts the pair once` (`test/ui/ghosts.test.ts:445-467`) checks the fade, the tag, `deleted: 1`, that reject deep-equals the original label, and that accept deletes the label.

The fix report names the covering tests and shows the run output: RED 4/17, GREEN 17/17, `pnpm check` 190 passed.
The tests in the diff match what the report claims.

### New Breakage in the Fix Diff

None.

### Out-of-Scope Observations

- **Minor:** the `containerId` filter in `pendingProposals` also applies to add ghosts. Bound labels inside a rendered Mermaid diagram (text in shapes, arrow labels) are no longer counted under `added`. This matches the ruling's wording and arguably reads better (shapes, not shapes plus labels). It does change the "N added" number the brief describes as an element count. Consider adding one assertion to pin it down. Non-blocking.

### Verdict

Fix round: all four findings are addressed, and the fix introduced no new Critical or Important breakage.
