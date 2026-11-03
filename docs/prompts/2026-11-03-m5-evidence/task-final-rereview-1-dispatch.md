You are re-reviewing one task's fix round. A previous review produced findings; the implementer has attempted to fix them. Your job is to verdict each finding and inspect the fix diff, nothing else.

## The Task

Read the task brief: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-final-brief.md

## The Findings Under Verification

# Milestone 5 final review findings and controller rulings (review thread thr_ehwydx4rqw)

Full review: final-review-report.md in this directory. Fix every numbered item below in this wave, in this order; the evidence refresh (item 20) is last because the other items change what it shows.

## Layout and setup
1. At 1280 by 800 the board is 680 px wide, so Excalidraw drops into its phone layout. Add a media query below 1360 px that narrows the rail to 200 px and the panel to 320 px (board 760 px at 1280); name the minimum window the layout is built for in DESIGN.md. Re-check the focus inset from 901f9e1 against the desktop layout.
2. The README's Development section adds `pnpm exec playwright install chromium` before `pnpm e2e`/`pnpm demo`.
3. The README's loop says what happens without `gh`: the run ends Idle, and **Mark done** on its card marks it finished so its dependents can launch.

## Behaviour
4. Proposed shapes can land on top of existing ones. Placement beside the anchor shifts right past any non-deleted element that would overlap the placed group's bounds (keep the 80 px gap from the last overlapping element); test it in `ghosts.test.ts`.
5. Citation chips show the cited shape's label (or the doc heading's text) instead of the raw id, with the id in the tooltip. The spec route's response gains a `labels` map from citation key to label (from the board graph and doc headings); chips fall back to the id when a label is missing. Test the route and the chip.
6. Panel rows that are vague or show internal ids (from the acceptance report): every row Blueprint writes reads as a sentence and never shows a proposal or element id where a label exists. Use the acceptance report's list and fix each with a test.
7. The fake scenario's citation resolves on a board the user draws: `write` steps replace `{{board:<name>:first}}` with the id of that board's first labelled node at write time; `e2e/scenario.json` uses it; the README drops its caveat. The scenario's run message stops claiming a commit the fake does not make.
8. If `.blueprint/` is deleted while the server runs, `FileStore` recreates the directory tree on the next write and reads report a missing board or doc as not found (404), not a 500. Test it.
9. `toolsOf` guards the private registry with `?? {}` so a renamed field yields a tool error, not a crashed session.
10. Tool results are parsed for a proposal id before they are truncated.
11. The event mapper deletes a tool's name from its map when the tool's result arrives.
12. `relativeTo` anchors the session directory at the start of a path token (start of text or after whitespace or a quote), so `/other/repo/x.ts` is untouched.
13. The other-session row bumps its load counter on close, so a late answer cannot overwrite a newer list.
14. The spec view's headings render at their real levels (an optional `headingBase` prop on `Markdown`; the panel keeps its shift).

## Docs and tests
15. DESIGN.md's permission dialog section says it offers two or three choices depending on whether Claude Code suggested a rule.
16. `src/shared/panel.ts`'s `canAlways` comment describes the current behaviour (no rule means no Always choice).
17. The compile flow waits for "Splitting…" before waiting for "Split into tasks" to return.
18. A RunCard test covers a rejected Stop returning the button.
19. The compile-skips-a-doc test restores its `console.warn` spy in a `finally`.

## Evidence (last)
20. Run `pnpm e2e` three times, then `pnpm demo`, and re-shoot every `docs/design/after-*.png` at 1280 by 800; look at each end frame and screenshot and fix anything that looks off before committing. Update the README screenshot reference if a file name changes.

## Deferred (do not address)
- Markdown tables, the chip kind label, blank white video openings, the fake's say-step order, the duplicated return type, a unit test for the font wait.

## The Fix

Read the implementer's report (fix reports are appended at the end): /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-final-report.md

Fix base: a10d0f6 (the head the previous review saw)
Head: 2d054fe
Diff file: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/review-a10d0f6..2d054fe.diff

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
