# Task 5 report: Ghost logic

Status: DONE_WITH_CONCERNS

Commit: `5d72597 feat(ui): ghost placement, application, and decisions as pure functions`

## What I implemented

`src/ui/board/ghosts.ts` exports these, with the types exactly as the brief gives them: `GhostKind`, `Before`, `Ghost`, `El`, `Bounds`, `Viewport`, `Counts`, `ghostOf`, `bounds`, `anchor`, `placeBeside`, `pendingProposals`, `applyProposal`, `decideProposal`, `labelOf`.
The module has no DOM or Excalidraw import.

- `ghostOf`: returns `customData` as a `Ghost` only when `origin === "ai"`, `proposalId` is a string, and `ghost` is one of the three kinds. Accepted elements (`{ origin, proposalId }` with no `ghost`) return null.
- `bounds`: the bounding box of non-deleted elements, or null when there are none.
- `anchor`: the first non-null of: the bounds of the near ids, the bounds of the selected ids, the bounds of everything.
- `placeBeside`: with an anchor, returns `x = anchor.x + anchor.w + 80` and `y = anchor.y + offsetY`. With a null anchor, it centers `size` in the viewport and adds `offsetY` to y.
- `labelOf`: the first non-deleted element whose `containerId === id`, or the element itself when it is text.
- `applyProposal`:
  - It validates every op before it touches anything. A missing or soft-deleted update/delete target throws `unknown element id <id>`. A label update on an element with no label throws `element <id> has no label`. An add op with no entry in `rendered` throws `op <i> was not rendered`.
  - Each addition is translated so the `bounds()` top-left of its group lands on the placement, then it gets the ghost style, `groupIds: [proposal.id, ...groupIds]`, and the `add` tag.
  - Each op computes its anchor against the input elements, never against additions made earlier in the same proposal. `offsetY` accumulates each earlier group's height plus 40.
  - With a null anchor, the first group is centered. Later groups stack below it, left-aligned with it.
  - Updates and deletes snapshot `before` and apply the style exactly as the brief specifies.
  - `ids` lists every touched element: the added elements, then the update and delete targets in op order, with no duplicates. Label elements are not in the list. Task 8 sends this list back as `elementIds` and uses it for `scrollToContent`.
- `decideProposal`: applies the accepted and rejected rules exactly as the brief gives them. A rejected update or delete restores every `before` key, including the label text (`text` and `originalText`). When the original `customData` was undefined, a rejected update or delete removes the `customData` key, so the element deep-equals its original.
- Immutability: inputs are never mutated. Untouched elements are reused by reference, and touched elements are new objects.

Two edge cases outside the brief, kept for reject-restores-exactly:
- When two ops in one proposal touch the same element, the first op's originals win in `before`, so a reject restores the true original.
- After a `delete` op on an element, later `update` ops on that element in the same proposal are skipped, so the element stays a delete ghost.

## TDD evidence

RED: `pnpm vitest run test/ui/ghosts.test.ts`
```
 ❯ test/ui/ghosts.test.ts:2:1
      2| import {
 Test Files  1 failed (1)
      Tests  no tests
```
(The failure was module not found, because `src/ui/board/ghosts.ts` did not exist yet.)

GREEN: `pnpm vitest run test/ui/ghosts.test.ts`
```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Mutation check: I disabled the delete-sticky guard, and `two ops on one element reject back to the original` failed (1 failed | 11 passed). I then restored the file, and the suite was green again.

`pnpm check`: both typechecks were clean, Biome said "Checked 87 files ... No fixes applied.", and Vitest reported 30 files and 185 tests passed.

## Tests (test/ui/ghosts.test.ts, 12 tests)

The file has all nine tests the brief names.
It also has three more:
- placeBeside, and the anchor fallback from near to selection to everything.
- A text element is its own label (apply and reject).
- Two ops on one element (update then delete rejects to the original, and delete then update stays a delete ghost).

## Manual verification

The brief names no manual verification.
This module is pure, and Task 8 wires it into Excalidraw.

## Files changed

- `src/ui/board/ghosts.ts` (new)
- `test/ui/ghosts.test.ts` (new)

## Self-review

- Every rule in the brief is covered by an assertion.
- The resolutions from the dispatch are implemented as stated: label lookup by `containerId`, a text element as its own label, the group translated by its own bounds, `offsetY` accumulation, the null-anchor centering, and no mutation.
- `decideProposal` loops over the output array by index, so a label that an earlier ghost already patched is read in its current state. One example is a bound text that is itself a delete ghost.
- Accept and reject skip ghosts that are already soft-deleted. In the replace flow, the old rejected additions stay deleted and are not counted.

## Concerns

1. `groupIds: [proposal.id, ...groupIds]` makes the proposal group the innermost group. Excalidraw treats the last entry as the outermost group. If a rendered diagram has its own groups, clicking selects the diagram's group and not the whole proposal. Mermaid output is usually ungrouped, so this is minor. I followed the brief verbatim. Appending the proposal id would make it the outermost group.
2. Accepted additions keep the proposal id in `groupIds`, because the brief does not say to remove it. So an accepted proposal stays one selectable group.
3. Accepting an addition forces `strokeStyle: "solid"`. That replaces any dotted or dashed edges the Mermaid importer produced, for example `-.->` arrows. Preserving them would need `before.strokeStyle` on additions too, which the brief does not specify.
4. A label update on a shape with no bound text throws `element <id> has no label`. Creating a new bound text element needs Excalidraw's constructors, which this pure module cannot use. Claude gets a clear error and can choose another op.
5. `pendingProposals` counts elements, not ops. One diagram can therefore show as "12 added". This is how the brief defines it.

## Fix round 0

Commit: `fix(ui): proposal group outermost and keep stroke style on accept`

1. Group order: added elements now get `groupIds: [...groupIds, proposal.id]`.
   Excalidraw lists groups innermost first, so the proposal is now the outermost group and the whole proposal moves as one unit.
   The add test now asserts `groupIds.at(-1) === "p_1"`, and that `r2`'s groups are `["g", "p_1"]` (the diagram-internal group comes first).
2. Stroke style on accept: an `add` ghost now stores its rendered `strokeStyle` in `before` (`customData: { origin, proposalId, ghost: "add", before: { strokeStyle } }`).
   `accepted` sets `opacity: 100` and restores `before.strokeStyle`.
   It falls back to `solid` only when `before` is missing.
   New test `accepting an addition keeps its rendered stroke style`: a dotted arrow shows dashed as a ghost and is dotted again after accept.
   The add test's exact `customData` assertion now includes `before: { strokeStyle: "solid" }`.

Concerns 2 and 5 from the first round stand as designed, per the ruling: accepted additions keep the proposal group, and a label change on a shape with no text label throws.

Verification:
- `pnpm vitest run test/ui/ghosts.test.ts`: 13 passed (13).
- `pnpm check`: both typechecks clean. Biome reported "Checked 87 files ... No fixes applied." Vitest reported 30 files and 186 tests passed.

## Fix round 1

Commit: `0f7adb1 fix(ui): refuse cross-proposal targets and snapshot original label text`

Changes in `src/ui/board/ghosts.ts`, each applied as the findings file rules:

1. Cross-proposal targets (Important): the validation loop now throws `element <id> is in pending proposal <p>` when an update or delete target carries a ghost tag from a different proposal id.
   Re-targeting within the same proposal still uses the first-op-wins merge.
   Covering test: `an element in another pending proposal is refused before anything changes`.
   It runs both a delete and an update from `p_2` against an element that `p_1` already ghosts, and asserts that the input is unchanged.
2. Wrapped labels (Important): the label snapshot is now `before.label = label.originalText ?? label.text`.
   On reject, that value is written to both `text` and `originalText`, as before.
   Covering test: `a wrapped label rejects back to its original text`.
   Its fixture has `text: "A long\nlabel"` and `originalText: "A long label"`.
   After reject, both fields equal `"A long label"`.
3. Empty rendered group (Minor): validation throws `op <i> rendered nothing` when a rendered group has no non-deleted elements.
   The silent skip during application is removed.
   Covering test: `an add op that renders nothing throws`.
4. Delete label fade (Minor): the bound text of a delete target now gets `opacity: 40` and its own ghost tag `{ origin: "ai", proposalId, ghost: "delete", before: { opacity, customData } }`.
   Reject therefore restores the label exactly, and accept deletes it together with its container.
   `pendingProposals` still lists every proposal that has a live ghost, but it increments counts only for elements without a `containerId`, so the pair counts once.
   Covering test: `a delete ghost fades its label too and counts the pair once`.
   It checks the fade and tag, counts `deleted: 1`, that reject deep-equals the original label, and that accept deletes the label.
   The existing accept, reject, and replace-flow tests still pass with the label now tagged.

TDD:
- RED: `pnpm vitest run test/ui/ghosts.test.ts` failed 4 of 17 tests, one per finding.
  - "expected [Function] to throw an error" (findings 1 and 3)
  - "expected 'A long\nlabel' to be 'A long label'" (finding 2)
  - "expected 100 to be 40" (finding 4)
- GREEN: `pnpm vitest run test/ui/ghosts.test.ts` passed 17 of 17.
- `pnpm check`: both typechecks were clean. Biome reported "Checked 87 files ... No fixes applied." Vitest reported 30 files and 190 tests passed.

Deferred minors are left alone, as ruled.
