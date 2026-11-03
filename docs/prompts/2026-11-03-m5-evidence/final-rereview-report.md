### Finding Verdicts

1. **ADDRESSED.** `src/ui/styles.css` adds `@media (max-width: 1359px)` with `--rail-width: 200px` and `--pane-width: 320px` (diff 1801-1808). `DESIGN.md` gains a Layout section that names 1280 by 800 as the minimum window (diff 90-96). The focus inset was re-checked, and `centerOn` now shares the inset with the proposal scroll (`src/ui/board/BoardView.tsx`, diff 1194-1216). All six screenshots measure 1280×800, and `after-board-proposal.png` shows the desktop toolbar and properties panel.
2. **ADDRESSED.** `README.md` Development block, diff line 191.
3. **ADDRESSED.** `README.md` diff 145-146. The wording deliberately differs from the ruling: it says dependents launch freely once the branch is merged, not on Mark done alone. That matches `checkGate`, and acceptance item 6 in `task-6-report.md:122` records the same behaviour.
4. **ADDRESSED.** `src/ui/board/ghosts.ts` `placeBeside`, diff 1338-1365, and `applyProposal` passes `out` (diff 1383). The loop ends because each pass moves `x` at least `GAP_X` further right. Covered in `test/ui/ghosts.test.ts`, diff 3157-3188.
5. **ADDRESSED.** The route builds a `labels` map (`src/server/routes.ts`, diff 1102-1116). `buildCitationIndex` returns a Map (diff 411-434). The chip shows the label, falls back to the id, and keeps the raw citation as its tooltip (`src/ui/plan/citations.tsx`, diff 1740-1752). Tests cover the route (diff 2575-2631) and the chip (SpecView diff 2841-2858, TasksView diff 3107-3112).
6. **ADDRESSED.** All three rows on the acceptance list in `task-6-report.md:115-118` are fixed:
   - ToolSearch's "done" is now `loaded the … tools`.
   - The propose result no longer shows the proposal id.
   - Read no longer dumps the file; it says `read N lines`.

   The revise tool row and the Refine chip no longer show ids either. Code is in `src/server/agent/events.ts`, diff 528 and 565-615, and `src/ui/panel/ClaudePanel.tsx`, diff 1557. Each row has a test (diff 2063-2162, 2684).
7. **ADDRESSED.** `fillBoards` in `src/server/fake/sdk.ts` (diff 792-806) runs at write time (diff 827-842). `e2e/scenario.json` uses the placeholder (diff 321), and the run message no longer claims a commit (diff 349). The README caveat is replaced (diff 169). Test at diff 2396-2451.
8. **ADDRESSED.** In `src/server/files.ts`, `entries()` treats ENOENT as empty (diff 868-873), and `restoreDirs()` runs in `write()` and `appendProposal()` (diff 981 and 1021-1028). Tests: `files.test.ts` diff 2533-2558 and `routes.test.ts` diff 2650-2667. The close race this exposed is fixed in `src/server/index.ts:1056`, with a deterministic test (diff 2474-2506).
9. **ADDRESSED.** `src/server/fake/sdk.ts`, diff 784-789. Test at diff 2343-2373.
10. **ADDRESSED.** `src/server/agent/events.ts`, diff 677-684: the result is read whole and parsed, and only the fallback is cut. Test at diff 2086-2093.
11. **ADDRESSED.** `events.ts`, diff 681. Test at diff 2095-2102.
12. **ADDRESSED.** `relativeTo` is anchored by `(^|[\s"'])` (diff 501-505). Test at diff 2214-2226 covers `/other/repo/x.ts` and `a/repo/x.ts`.
13. **ADDRESSED.** `src/ui/sessions/SessionsView.tsx`, diff 1773-1776. Test at diff 2758-2793.
14. **ADDRESSED** for what the finding asked: top-level spec headings now render at their real levels, via `headingBase={1}` (`SpecView.tsx`, diff 1597) and the prop in `src/ui/markdown.tsx` (diff 1521-1534). Tests at diff 3239-3252 and 2836-2838. The same change introduced a regression for headings inside nested lists; see New Breakage.
15. **ADDRESSED.** `DESIGN.md`, diff 117-119.
16. **ADDRESSED.** `src/shared/panel.ts`, diff 1142-1143. This matches `src/server/agent/broker.ts:52,69` and `PermissionDialog.tsx:20`.
17. **ADDRESSED.** `e2e/flows.spec.ts`, diff 284-299. Holding the split route means the "Splitting…" check cannot race.
18. **ADDRESSED.** `test/ui/RunCard.test.tsx`, diff 2719-2730. The report says the test failed when `setStopping(false)` was removed, which shows it can catch the bug.
19. **ADDRESSED.** `test/server/agentRoutes.test.ts`, diff 2261-2295.
20. **ADDRESSED.**
    - The three videos and six screenshots were re-recorded (diff 198-223), and all six PNGs are 1280×800.
    - The report shows three green e2e runs and a green `pnpm demo`.
    - File names are unchanged, so `README.md:7` and the `DESIGN.md:158-165` references still hold.

### New Breakage in the Fix Diff

- **Important: `src/ui/markdown.tsx:150`, `:174`.** A heading inside a nested list item renders at the wrong level, as low as `<h0>`.
  - Cause: the fix added a `base` parameter to `blocks()` for the heading level, but the list branch still declares its own `const base = indent(line)`, which hides it. `listItem(item, base, cite)` at line 174 therefore passes the list's indent (usually 0) as the heading level.
  - Verified with a scratch render:
    - `"- a\n  - b\n  # H"` with the default `headingBase` renders `<h0>H</h0>`. It should be `<h3>`.
    - `"- a\n  - b\n  ## H"` with `headingBase={1}` renders `<h1>`. It should be `<h2>`.
  - Before this diff, nested blocks used a fixed `+2` and rendered correctly.
  - Where it shows: Claude's panel replies, run transcripts and the spec.
  - The report says `headingBase` is "threaded through quotes and nested lists", but only quotes have a test.
  - Fix: rename the local to `indentBase` (or similar) and add a nested-list case to the `headingBase` test.
- **Minor: `src/ui/board/ghosts.ts`, diff 1349-1356.** The overlap check treats every element's box as `x..x+width`, `y..y+height`.
  - For an Excalidraw arrow or line, `x`/`y` is the first point, and its points can run left or up from there.
  - Example: an arrow from (300, 0) to (200, 0) is checked as covering 300-400, though it covers 200-300.
  - Effect: a ghost can still land on a left- or up-pointing arrow.
  - Fix: use Excalidraw's element bounds, such as `getElementAbsoluteCoords`, for linear elements.
- **Minor (visual): `docs/design/after-board-proposal.png`.** With the 760 px board from item 1, the centered proposals bar (x ≈ 327-833) sits on top of the bottom of Excalidraw's properties panel (which ends at x ≈ 416) and hides its "Text align" row. One way to fix it is to center the bar in the area right of the properties panel, using the same `leftInset` as focus.

### Out-of-Scope Observations

- `FileStore.restoreDirs()` only recreates the tree when `.blueprint/` itself is missing. If only one subdirectory is deleted, such as `.blueprint/boards/`, writes still fail with ENOENT (500). This is outside the ruling, which named `.blueprint/` only.
- `test/ui/ghosts.test.ts`'s "a node with one connecting arrow stays beside its anchor" now expects x 580, past b. A comment explains this, but the test's title no longer quite describes it.

### Verdict

Findings remain open. All 20 numbered findings are addressed, but the fix diff introduced one Important regression: a heading inside a nested list renders at the wrong level, as low as `<h0>` (`src/ui/markdown.tsx:150`/`:174`). It is a one-word rename plus a test case. Two Minor issues come with it: the arrow bounds in `placeBeside` and the proposals bar sitting over the properties panel at 1280.
