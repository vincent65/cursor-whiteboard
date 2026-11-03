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
