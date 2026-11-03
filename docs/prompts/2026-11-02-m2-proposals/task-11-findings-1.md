# Task 11 findings, round 1 (from review thr_k9iu5j57sv, with controller rulings)

## Important
1. `listBoundArrows` in BoardView.tsx is untested, runs on every element on every apply or decision, and version-bumps elements it touches. Ruling: move it into `src/ui/board/ghosts.ts` as a pure `listBoundArrows(elements: El[]): El[]` (`El` gains optional `boundElements`), skipping deleted arrows and deleted targets, keeping untouched elements by identity (no version bump), and never duplicating an entry; BoardView calls it from `throughGhosts`. Tests: both ends get listed; an existing entry is not duplicated; deleted arrows are skipped; deleted targets are skipped; an unchanged element keeps its identity.

## Minor (fix in this round)
2. Arrow ends skip the "element is in pending proposal X" guard, and an arrow may bind to an element the same proposal deletes. Ruling: an `add_arrow` end that is an existing element must pass the same cross-proposal guard as update and delete, and must not be the target of a `delete` op in the same proposal (`Error("op <i>: arrow end <id> is deleted by this proposal")`). Tests for both.
3. `$01` validates in `checkRefs` but does not match `betweenTargets`. Ruling: refs match `^\$(0|[1-9]\d*)$` exactly, everywhere.
4. Self-loops (`from === to`) give a zero-length arrow. Ruling: `checkRefs` rejects them with `Error("op <i>: an arrow needs two different ends")`.
5. The `$`-reference rule is duplicated between `src/shared/proposals.ts` and `ghosts.ts`. Ruling: `src/shared/refs.ts` (no zod) exports `isRef(s): boolean` and `refIndex(s): number | null`; both files import it; `checkRefs` stays in proposals.ts.

## Deferred (do not address)
- The plan's Step 1 test sketch still describes beside placement (controller fixes the plan text).
