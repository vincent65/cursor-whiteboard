### Spec Compliance
- Issues found: one spec gap. The brief requires a reject to "restore every `before` key, including the label text", and `src/ui/board/ghosts.ts:402` does not do that for a wrapped label (Important #2). Everything else in the brief is implemented.
- All 15 exported types and functions match the brief's signatures (`ghosts.ts:181-218` and the functions after them).
- The module imports nothing from Excalidraw or the DOM. Its only import is `ghosts.ts:175`, which is type-only.
- All 9 tests the brief names exist (`test/ui/ghosts.test.ts:515-863`). There are 4 extra tests: placeBeside and the anchor fallback, a text element as its own label, two ops on one element, and accept keeping the stroke style.
- Plan inconsistency: the plan still says `groupIds[0] === "p_1"` in the Step 1 test comment (plan line 427). Its rule text, revised in `8e52994`, says the proposal id is appended. The code (`ghosts.ts:355`) and the test (`ghosts.test.ts:537,545`) follow the revised rule.
- Extra items not in the brief:
  - The `element <id> has no label` throw (`ghosts.ts:305-310`).
  - The `op <i> was not rendered` throw (`ghosts.ts:311-312`).
  - "The first op's originals win" (`ghosts.ts:326-331`).
  - "A delete is sticky" (`ghosts.ts:385-386`).
  - The report says the first was accepted in a ruling. All four are reasonable.
- Cannot verify from the diff: whether Task 8 re-wraps bound text after `applyProposal` and `decideProposal` set `text` directly.

### Strengths
- The functions are genuinely pure. Untouched elements are reused by reference, and the tests check this at `test:547,548,636-637,790,792`.
- All ops are validated before any write (`ghosts.ts:302-314`).
- Restoring an element whose original `customData` was undefined removes the key (`ghosts.ts:454-456`). The test checks this strictly with `not.toHaveProperty` (`test:814`).
- Two ops on the same element are handled well. The snapshot merge keeps the first originals, the delete stays sticky, and a mutation check confirmed this.
- The fix round is correct. The proposal group is now outermost (`ghosts.ts:355`), and accept restores the stroke style the add had when it was rendered (`ghosts.ts:356,437`). The dotted arrow test pins it (`test:795-807`).
- The placement arithmetic matches the brief. I checked both the beside case and the centered case against `test:566-576`.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **An op on an element that already belongs to another pending proposal corrupts both proposals.** (`ghosts.ts:300-314`, `326-331`, `385`)
   - The plan allows several pending proposals at once (`Pending proposals: p_1 (2 ops), p_2 (1 op)`, plan line 234).
   - Board reads hide only `add` ghosts (`src/server/agent/tools.ts:57`), so Claude can still see update and delete ghosts and target their ids.
   - Validation checks only that the target exists and is not deleted.
   - `snapshot` merges the earlier originals only when the earlier ghost is from the same proposal.
   - Scenario:
     - p_1 updates `u` to `strokeColor: "#f00"`. Then p_2 updates `u`'s label.
     - `u`'s tag becomes p_2, with `before.strokeStyle: "dashed"` and `before.customData` set to p_1's tag.
     - `pendingProposals` stops counting `u` for p_1, so p_1 can vanish from the toolbar while the server still lists it as pending.
     - Accepting p_2 restores `strokeStyle: "dashed"` (`ghosts.ts:443`), so `u` stays dashed permanently.
     - p_1's snapshot is lost, so rejecting p_1 afterwards cannot revert the red stroke.
   - Fix: in the validation loop, throw if a target already belongs to a different pending proposal (for example `element u is in pending proposal p_1`). An alternative is to nest the snapshots.
   - No test covers this.

2. **The label snapshot stores the wrapped `text` instead of `originalText`, so rejecting a wrapped label writes line breaks into `originalText` permanently.** (`ghosts.ts:402`, `457-459`)
   - In Excalidraw, a container-bound text keeps the display text with wrap newlines in `text` and the raw text in `originalText`.
   - `before.label = label.text` stores the wrapped form.
   - Reject writes that value into both `text` and `originalText`.
   - Result: any label long enough to wrap no longer reflows after a reject, and the brief's requirement that the element "deep-equals its original" fails.
   - The tests miss this because every fixture has `text === originalText` (`test:609-610,742-743,750-751`).
   - Fix: snapshot `label.originalText ?? label.text`. Add a test whose fixture has a wrapped `text` (containing `\n`) and a different `originalText`.

#### Minor (Nice to Have)
1. The plan's Step 1 comment (plan line 427) still says `groupIds[0] === "p_1"`, which contradicts the revised rule. The plan should be corrected so later tasks don't follow it.
2. The two extra throws, `element <id> has no label` and `op <i> was not rendered` (`ghosts.ts:305-313`), are never exercised by a test.
3. An add op whose rendered group is empty is skipped without any error (`ghosts.ts:339`). The proposal then "applies" with nothing on the board. Throwing would match how the other validation failures are handled.
4. `bounds` uses `e.x` as the left edge (`ghosts.ts:238-241`). For an Excalidraw arrow, `x` is its first point, and later points can be to the left of it (negative relative coordinates). So group bounds can be slightly wrong when an arrow is the outermost element. This is low risk because node shapes usually set the diagram's edges.
5. A delete ghost restyles only the container, not its bound text (`ghosts.ts:374-380`). The label stays at full opacity while the box is faded red. This follows the brief, but it looks inconsistent in the UI.
6. `toEqual` on `before` with `customData: undefined` (`test:628-633`) cannot tell a missing key from a key set to undefined. The reject test (`test:814`) covers that gap, so this is cosmetic.

### Assessment
Task quality: Needs fixes

Reasoning: the module is clean, pure, and closely follows the brief. But one ghost targeting another pending proposal's ghost can leave an element permanently dashed with no way to revert it. Separately, rejecting a wrapped label writes line breaks into `originalText` permanently. Both break the "only accept makes it real, reject restores exactly" guarantee.
