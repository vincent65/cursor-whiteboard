You are re-reviewing one task's fix round. A previous review produced findings; the implementer has attempted to fix them. Your job is to verdict each finding and inspect the fix diff, nothing else.

## The Task

Read the task brief: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-11-brief.md

## The Findings Under Verification

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

## The Fix

Read the implementer's report (fix reports are appended at the end): /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-11-report.md

Fix base: 7a0c209 (the head the previous review saw)
Head: 9dac292
Diff file: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/review-7a0c209..9dac292.diff

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
