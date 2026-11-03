You are re-reviewing one task's fix round. A previous review produced findings; the implementer has attempted to fix them. Your job is to verdict each finding and inspect the fix diff, nothing else.

## The Task

Read the task brief: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-final-brief.md

## The Findings Under Verification

# Milestone 3 final review findings and controller rulings (review thread thr_6nhe4yvysi)

Full review: final-review-report.md in this directory. Fix every numbered item below in this wave; leave the "deferred" list alone.

## Important
1. Compile reads `.blueprint/export/boards/*.md`, which only a board save regenerates (missing on a fresh clone, stale after a pull or an outside edit). Ruling: `Agent.compile()` regenerates `boards/<name>.md` for every board through `listBoards`, `readBoard`, the export functions, and `writeExport` before it sends the instruction; a board that fails to parse is skipped with `console.warn`. Test in `agentRoutes.test.ts`: with no export files on disk, compile writes them before the send.
2. The heading-slug rule in the instruction does not match the index. Ruling: the instruction lists each doc's citable headings the way exports list element ids: `compile()` appends a "Doc headings you may cite:" block with one line per doc, `<file>: <slug>, <slug>, …` from `headingSlugs`, and the slug sentence becomes "use only the heading slugs listed below". Update the prompt test.
3. A split in flight is invisible to a view that mounts later. Ruling: `agent.state()` gains `splitting: boolean`; `SpecView` seeds its splitting state from `agentState()` on mount. Tests on both sides.
4. A failed reconcile fails a read-only tool. Ruling: `read()` in `tools.ts` wraps `proposals.reconcile` in a catch that logs `console.warn` and continues, like the save route. Test with a store whose append throws.

## Fix before merge (from the triage and earlier deferrals)
5. The compile instruction adds: "Read files with the Read and Glob tools, not Bash."
6. The dropped-citations line dedupes by `raw` and pluralizes ("1 citation", "2 citations").
7. `dropUnknownCitations` also removes one adjacent separator, so "See A, B, [[x]], [[y]]." becomes "See A, B." and "(see [[x]])" becomes "" (no empty parentheses). Test cases in `test/export/citations.test.ts`.
8. The split is fed the cleaned spec: `SPLIT_PROMPT(dropUnknownCitations(spec, index).text)`, so task sources never cite deleted elements.
9. `TasksView` keys acceptance and source items by index.
10. `SpecView` clears a split or load error on any `split.status` and on a successful reload, like `TasksView`.
11. `src/server/watch.ts` also reports `unlink` for boards, docs, the spec, and task files.
12. A restored transcript shows `Compile the plan into spec.md` for a saved prompt equal to `COMPILE_INSTRUCTION` (compare on the instruction's first line, since the appended headings block varies).
13. `compiling` is cleared only when `compiling === p`.
14. The panel placeholder reads `Ask Claude about this board` only on board routes and `Ask Claude` elsewhere (carried since milestone 1).
15. The split error for a subtype with no `errors` reads as a sentence: `error_max_turns` → "the split ran out of turns", `error_max_structured_output_retries` → "Claude did not return a valid task list", `error_max_budget_usd` → "the split hit its budget", `error_during_execution` → "the split failed while running".

## Deferred (do not address)
- Everything in the review's "Can wait" list, including the "N tasks written" feedback, aborting a split in close(), and the shared editor module.

## The Fix

Read the implementer's report (fix reports are appended at the end): /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-final-report.md

Fix base: 45b3c1e (the head the previous review saw)
Head: 42e28f4
Diff file: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/review-45b3c1e..42e28f4.diff

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
