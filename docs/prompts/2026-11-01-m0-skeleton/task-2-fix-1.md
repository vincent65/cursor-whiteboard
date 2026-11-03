The task review of your Task 2 work found one Important issue. Fix it now, in this thread, on branch `m0-skeleton`.

## Finding to address

- Important #1: The text-to-container binding is read from two different fields, so a one-sided binding either loses text silently or emits it twice (src/export/boardGraph.ts:32-35 vs :59). Suppression of a text element depends on the text's own `containerId`; the container's label depends on the container's `boundElements`. Case A: text has `containerId: "r1"` (live) but `r1` has no `boundElements`: the text is skipped and `r1.label` is "" (text vanishes). Case B: `r1.boundElements` lists `t1` but `t1.containerId` is null: `t1` becomes its own text node and is also `r1`'s label (text appears twice). `boundText` also never checks that the referenced text's `containerId === e.id`, so a stale `boundElements` entry can borrow another container's text. Fix: use one source of truth: build a `containerId -> text` map from live text elements whose `containerId` is live, and use it both for labels and for deciding suppression. Add a test for each case, plus the orphaned-text case (text whose container is deleted or missing stays a standalone text node).

## What to do

- Make the fix in `src/export/boardGraph.ts` and add the tests to `test/export/boardGraph.test.ts`: Case A (text with live containerId but the container lists no boundElements: the container gets the label and the text is not a separate node), Case B (container lists the text in boundElements but the text's containerId is null: the text is a standalone node and the container's label is empty), the stale entry case (a container whose boundElements names a text that belongs to another container does not borrow it), and the orphaned text case (text whose container is deleted or missing stays a standalone text node).
- Run the covering test file, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(export): resolve text-container bindings from one source of truth`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-2-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond this finding.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
