# Final fix wave report (milestone 5)

Status: DONE_WITH_CONCERNS

Base: `a10d0f6`. Head: `2d054fe`. 22 commits, none with a co-author or generated-with trailer (`git log a10d0f6..HEAD --format=%B | grep -ciE 'co-authored|generated with'` prints 0).

| # | Commit | Subject |
| --- | --- | --- |
| 1 | `605a38a` | fix(ui): the board keeps Excalidraw's desktop layout at 1280 by 800 |
| 2, 3 | `623723a` | docs(readme): install Playwright's browser and explain a run that ends Idle |
| 4 | `015e596` | fix(ui): proposed shapes shift right past shapes they would cover |
| 5 | `37f5d37` | feat(ui): citation chips show what they cite instead of its id |
| 6, 10 | `aa1bc2e` | fix(server): panel rows say what a tool did instead of ids and raw output |
| 7 | `ab0a3f1` | fix(fake): the scenario's citation resolves on a board the user draws |
| 8 | `1cf3103` | fix(server): a .blueprint/ deleted while the server runs comes back on the next write |
| 8 (follow-up) | `a19905a` | fix(server): close waits for queued sessions.json writes |
| 9 | `da2342a` | fix(fake): a renamed tool registry yields a tool error, not a dead session |
| 11 | `b675ae6` | fix(server): the event mapper forgets a tool once its result arrives |
| 12 | `3601c97` | fix(server): rows drop the session directory only where a path starts |
| 13 | `e432be9` | fix(ui): an other session's late transcript cannot overwrite a newer one |
| 14 | `6b109ee` | fix(ui): the spec view's headings render at their real levels |
| 15, 16 | `b8ffe7d` | docs: the permission dialog offers two or three choices |
| 17 | `84d433b` | test(e2e): the compile flow sees the split start before it ends |
| 18 | `80b769a` | test(ui): a rejected Stop gives the run card's Stop button back |
| 19 | `a3f4afc` | test(server): the compile-skips-a-doc test restores console.warn in finally |
| 20 (follow-up of 1) | `f2244bc` | test(e2e): the plan flow draws right of Excalidraw's properties panel |
| 20 (follow-up of 17) | `6f961da` | test(e2e): the compile flow holds the split until it has seen Splitting… |
| 20 (follow-up of 6) | `18faaba` | fix(server): a proposal's row fits the panel |
| 20 (follow-up of 1) | `e213843` | fix(ui): a proposal out of view scrolls in beside its selection, clear of the properties panel |
| 20 | `2d054fe` | docs: re-record the demo and re-shoot the after screenshots at 1280 by 800 |

## 1. Layout at 1280 by 800

Changed: `src/ui/styles.css` gains `@media (max-width: 1359px)` that sets `--rail-width: 200px` and `--pane-width: 320px`, so the board is 760 px wide at 1280.
`DESIGN.md` has a new Layout section that names 1280 by 800 as the minimum window, gives both widths, and says a window under 1250 px drops to Excalidraw's compact layout.

Focus inset re-check: I served the built app on the fake SDK and opened `#/boards/main?focus=login` at 1280 by 800 with Playwright.
The probe printed `{"main":[200,760],"mobile":false,...["Island App-menu__left",216,200]}`: the board is 760 px, Excalidraw is in its desktop layout, and the properties panel's right edge sits 232 px into the board, which matches `PROPERTIES_PANEL_WIDTH`.
The cited box was centered in the clear area right of the panel.
The same check through a hash change on an open board also centered correctly.

Covering tests: `test/ui/focus.test.ts` (unchanged and still green), plus the e2e compile flow's chip click.
Two follow-ups came out of the evidence pass (see item 20): `f2244bc` moves the plan flow's drawing right of the properties panel, and `e213843` keeps a proposal's scroll clear of the panel.

## 2. Playwright browser in the README

Changed: the Development block in `README.md` adds `pnpm exec playwright install chromium   # once, before the first e2e or demo run` before `pnpm e2e`.
No test; documentation only.

## 3. A run without `gh`

Changed: step 7 of the loop in `README.md` now says that without `gh`, or without a remote, a run ends **Idle** with its work committed.
It also says **Mark done** marks the run finished.
I checked `src/server/runs/gate.ts` before writing the second part: a dependency counts only when its run is done *and* its branch is merged.
So the README says that once you merge the branch, dependents launch without **Launch anyway**, rather than that Mark done alone unblocks them.
No test; documentation only.

## 4. Proposed shapes avoid existing ones

Changed: in `src/ui/board/ghosts.ts`, `placeBeside` takes the live elements.
Beside an anchor, it shifts right past any non-deleted element that would overlap the group's bounds, keeping `GAP_X` (80 px) from the last element it overlapped, and repeats until nothing overlaps.
`applyProposal` passes the elements it is building, so earlier groups and other pending ghosts count too.

Covering test: `test/ui/ghosts.test.ts`, "placement beside the anchor shifts right past shapes it would overlap".
It covers a direct call (two chained blockers, one deleted element and one off the row that must not move it) and a call through `applyProposal`.
"a node with one connecting arrow stays beside its anchor" now expects x 580, because the new node correctly skips the a-to-b arrow and box b in its row.

```
$ pnpm vitest run test/ui/ghosts.test.ts      (before the fix)
 FAIL  ... placement beside the anchor shifts right past shapes it would overlap
AssertionError: expected { x: 180, y: +0 } to deeply equal { x: 520, y: +0 }
      Tests  1 failed | 29 passed (30)
$ pnpm vitest run test/ui                      (after)
 Test Files  25 passed (25)
      Tests  143 passed (143)
```

## 5. Citation chips show labels

Changed:
- `src/export/citations.ts`: `buildCitationIndex` returns `Map<key, label>`.
  The label is a node's or edge's label, or a heading's text; it is `""` when there is none, and a repeated heading slug keeps the first heading.
  `citationKey` is exported, and `dropUnknownCitations` accepts anything with `has`.
- `src/server/files.ts`: `citationIndex()` returns the map.
- `src/server/routes.ts`: `GET /api/spec` returns `labels`, keyed by citation key, for each kept citation that has a non-empty label.
  With no spec it returns `labels: {}`.
- `src/ui/plan/citations.tsx`: `CitationLink` takes an optional `label`.
  The chip shows the label, or `page#id` without one; the tooltip stays the raw citation, which includes the id.
- `src/ui/plan/SpecView.tsx` passes the label.
  `src/ui/plan/TasksView.tsx` loads the labels from the same route, so task source chips use them too; a failed load falls back to ids.
- `e2e/flows.spec.ts`: the compile flow finds the chip by "Login".

Covering tests:
- `test/export/citations.test.ts`: the index maps keys to labels; a repeated slug keeps the first heading.
- `test/server/files.test.ts`: `citationIndex` holds the labels.
- `test/server/routes.test.ts`: "GET /api/spec drops unknown citations, reports them, and labels the rest" (labelled shape, unlabelled shape, doc heading, dropped one), and the null-spec case.
- `test/ui/SpecView.test.tsx`: the chip is named "Login" with the raw citation as its title; "a citation chip without a label shows the cited id".
- `test/ui/TasksView.test.tsx`: the source chip shows "Login", and the doc chip falls back to `notes.md#caching`.

```
(before) Tests  5 failed | 40 passed (45)   [export, files, routes]
(before) Tests  2 failed | 20 passed (22)   [SpecView, TasksView]
(after)  pnpm check -> Test Files 54 passed, Tests 420 passed
```

## 6 and 10. Readable panel rows; parse before truncating

These two touch the same lines, and counting a Read's lines needs the whole result anyway, so they landed as one pair (`aa1bc2e`).
I wrote item 10's test before the implementation so it failed first.

These are the acceptance report's rows and what they read now:

| Row | Before | After |
| --- | --- | --- |
| ToolSearch result | `done` | `loaded the get_selection and propose tools` (names from the `tool_reference` blocks, without the `mcp__server__` prefix) |
| propose result | `proposal p_a57feb3f is on the board` | `drew "Sign-in flow" as ghosts`, or `drew the proposal as ghosts` without a title |
| revise result | same as propose | `redrew "Sign-in flow" as ghosts` |
| Read result | the file's numbered lines | `read 17 lines` |
| A result with no text | `done` | `returned an image`, or `finished with no output` |
| revise tool row | `revising p_1a2b3c4d` | `revising "Sign-in flow"`, or `revising the proposal` |
| Refine chip | `Refining p_797c0ee1 · Sign-in flow` | `Refining Sign-in flow`, or `Refining the proposal` |

The mapper now stores each tool's name and input by tool_use id, so the result rows can use the proposal's title.
For item 10, `resultText` is read whole, `readableResult` parses it (including the proposal id), and only the raw fallback is relativized and cut to 120 characters.
In the evidence pass, the first wording I chose (`"Sign-in flow" is drawn as ghosts for you to accept or reject`) ended in an ellipsis in the 320 px panel.
`18faaba` shortened it to the wording above, which matches the existing rows ("read the board").

Covering tests in `test/server/agent/events.test.ts`:
- "summarizeTool names proposals" (revise by title or "the proposal").
- "a proposal's result row names it by title as ghosts, never by its id".
- "a proposal id past the row's length still marks the result as a proposal" (item 10: the id sits after 200 characters).
- "a tool search's row names the tools it loaded".
- "a Read's row counts the lines it read instead of showing them" (an error keeps its message).
- "another tool's result shows its text, cut short, and one with no text says what came back" (keeps the 120-character cut and replaces "done").
- The scripted-stream test now expects `read 2 lines` and `returned an image`.
- `test/ui/ClaudePanel.test.tsx`: the chip reads "Refining Login flow".

```
(before) Tests  8 failed | 6 passed (14)    [events.test.ts, with item 10's test]
(before) ClaudePanel: Tests 1 failed | 10 passed (11)
(after)  pnpm check -> Tests 425 passed (425)
```

## 7. The fake's citation resolves on a drawn board

Changed:
- `src/server/fake/sdk.ts`: `fillBoards` replaces each `{{board:<name>:first}}` in a write step's content, when the step runs, with the id of that board's first labelled node.
  It reads the board through `FileStore` and `excalidrawToBoardGraph`.
  A board that does not exist keeps its placeholder, so the spec reports the citation as dropped.
  The Write tool_use shows the filled content.
  `src/server/fake/scenario.ts` documents the placeholder.
- `e2e/scenario.json`: the spec cites `[[board:main#{{board:main:first}}]]`.
  The compile reply says it cites the first labelled shape on the main board.
  The run's reply says "Wrote src/login.ts on this branch." instead of claiming a commit.
- `README.md`: the dropped-citation caveat is replaced by "name your board `main` and the spec's citation chip opens that shape".

Covering test: `test/server/fake/sdk.test.ts`, "a write fills {{board:<name>:first}} with that board's first labelled shape at write time".
On a board whose first element is unlabelled, it resolves to the second; it fills a repeated placeholder; and a missing board stays a placeholder.
The e2e compile flow resolves it on its seeded board.

```
(before) Tests  1 failed | 15 passed (16)
(after)  Tests  16 passed (16)
```

## 8. A deleted `.blueprint/`

Reproduced first, end to end: I served a scratch repository on the fake SDK, ran `rm -rf .blueprint`, and called the API:

```
boards 500   docs 500   boards/main 404   docs/notes 404   spec 200   tasks 500
POST /api/boards -> {"error":"ENOENT: ... .blueprint/boards/x.excalidraw.json.tmp-..."} 500
POST /api/docs   -> 500
```

Changed in `src/server/files.ts`:
- `entries()` treats a missing directory as empty, for `list`, `listTasks`, and `replaceTasks`.
- `write()` and `appendProposal()` call `restoreDirs()`, which recreates the whole subdirectory tree when `.blueprint/` is gone; `init` shares `makeDirs()`.

Reads already mapped ENOENT to `NotFoundError` (404).

After, on the rebuilt server:

```
boards 200   docs 200   boards/main 404   docs/notes 404   spec 200   tasks 200
create board 201   create doc 201
.blueprint now holds assets/ boards/ docs/ export/ tasks/ worktrees/
```

Covering tests:
- `test/server/files.test.ts`: "a .blueprint/ deleted while the server runs lists as empty, reads as not found, and comes back on the next write".
- `test/server/routes.test.ts`: "with .blueprint/ deleted, lists are empty, a board or doc is 404, and creating one works".

```
(before) Tests  2 failed | 38 passed (40)
(after)  Tests  240 passed (240)   [test/server]
```

Follow-up, `a19905a`: after this change, the fake-SDK route test ("the plan session, the split, the runs, and the sessions routes all use the fake") failed now and then with `ENOTEMPTY: rmdir '.../repo/.blueprint'`.
- Rates under parallel stress: base `a10d0f6` 0 of 24, head 1 of 24; earlier sequential runs at head 2 of about 22.
- Root cause: `GET /runs` reads the manager's in-memory record, so the test saw "done" before the `sessions.json` write landed, and `server.close()` did not wait for that write.
  `restoreDirs()` adds one more async hop before each write, which widened the window.
- I made it deterministic by slowing `FileStore.prototype.writeSessions` by 50 ms in that test and asserting the saved run is done with its PR URL once `close()` resolves.
  It failed 3 of 3 before the fix.
- Fix: `src/server/index.ts` `close()` awaits `runs.settled()` after the sessions close.
  `manager.close()` is unchanged, because a manager test deliberately holds a write past it.
- After: 3 of 3 passes, then 0 of 45 under three parallel loops.

## 9. `toolsOf` guard

Changed: `src/server/fake/sdk.ts` reads `_registeredTools ?? {}`, typed optional, with a comment.

Covering test: `test/server/fake/sdk.test.ts`, "a server whose private tool registry is gone yields a tool error, not a dead session".
The server is `{ type: "sdk", instance: {} }`.
The tool step reports `no blueprint tool named echo`, and the turn still ends successfully with "still here".

```
(before) TypeError: Cannot read properties of undefined (reading 'echo')   Tests 1 failed | 16 passed (17)
(after)  Tests  17 passed (17)
```

## 11. The mapper deletes a tool on its result

Changed: `src/server/agent/events.ts` deletes the tool_use id from `#tools` when its tool_result is mapped.

Covering test: "the mapper forgets a tool once its result arrives".
A second result for the same id is shown raw, because the tool is gone.

```
(before) Tests  1 failed | 14 passed (15)
(after)  Tests  242 passed (242)   [test/server]
```

## 12. Anchored `relativeTo`

Changed: `relativeTo` builds one regular expression, `(^|[\s"'])(?:root1|root2)`, from the escaped roots, longest first, and replaces it with `$1`.

Covering test: "relativeTo drops the session directory only where a path starts".
It covers the start of the text, after a tab and after a newline, inside double and single quotes, `/other/repo/x.ts` left whole next to `/repo/x.ts` cut, and `a/repo/x.ts` untouched.
The existing both-spellings test (`/var` against `/private/var`) still passes.

```
(before) Tests  1 failed | 15 passed (16)
(after)  Tests  243 passed (243)   [test/server]
```

I amended this commit after the fact: I had committed before reading a Biome error.
The helper's name `escape` shadowed a global, so it is now `escapeRegExp`, and the line is formatted.
`pnpm check` was green before the amend.

## 13. Other-session race

Changed: `OtherSessionRow`'s `toggle` in `src/ui/sessions/SessionsView.tsx` bumps `latest.current` when it closes the row.

Covering test: `test/ui/SessionsView.test.tsx`, "an other session's late transcript, answered after its row closed, cannot overwrite a newer one".
The steps are open, close, `runs.changed`, then the old answer lands; reopening shows "Newer", never "Older", after exactly two requests.

```
(before) Tests  1 failed | 6 passed (7)
(after)  Tests  7 passed (7)
```

## 14. Spec heading levels

Changed:
- `src/ui/markdown.tsx`: `Markdown` takes `headingBase` (default 3, the panel's existing shift), threaded through quotes and nested lists, clamped at h6.
- `SpecView` passes `headingBase={1}`.
- `src/ui/styles.css`: the spec's h1 is `--fs-xl`, h2 is `--fs-lg`, and h3 is `--fs-md`, which are the sizes it showed before as h3, h4, and h5.

A screenshot of a spec with `#`, `##`, and `###` confirmed the sizes.

Covering tests:
- `test/ui/markdown.test.tsx`: "headingBase sets the level a # heading takes, inside quotes too, up to h6".
- `test/ui/SpecView.test.tsx`: "Goals" is a level 2 heading.
- The panel's level 3 and 5 test is unchanged.

```
(before) Tests  2 failed | 30 passed (32)
(after)  Tests  146 passed (146)   [test/ui]
```

## 15 and 16. Permission dialog docs and the `canAlways` comment

Changed:
- `DESIGN.md`: the dialog offers Allow once and Deny, plus Allow always when Claude Code suggested a rule, so two or three choices.
- `src/shared/panel.ts`: `canAlways` is true only when the SDK suggested a rule; without one, the dialog offers no Allow always, and the broker answers a stray "always" as allow once.

I checked this against `PermissionDialog.tsx` and `broker.ts`.
No test; documentation and a comment only.

## 17. The compile flow waits for "Splitting…"

Changed: `e2e/flows.spec.ts` asserts that the "Splitting…" button is disabled before waiting for "Split into tasks" to be enabled.

Follow-up, `6f961da`: under the demo's `slowMo: 500`, the fake split finished before that check ran, and `pnpm demo` failed with `expect(locator).toBeDisabled() failed`.
The flow now holds `**/api/agent/split` with `page.route` until it has seen "Splitting…", then releases it, so the check cannot race.
The server still runs the real split.

## 18. RunCard: a rejected Stop

Added `test/ui/RunCard.test.tsx`, "a rejected Stop shows why and gives the Stop button back".
`onStop` rejects, the alert shows the message, Stop is enabled, and "Stopping…" is gone.
The behaviour already existed, so it passed at once.
To check that the test can fail, I removed `setStopping(false)` from `RunCard.tsx`; the test then failed (`Tests 1 failed | 6 passed`), and I restored the file.

## 19. `console.warn` spy in `finally`

Changed: `test/server/agentRoutes.test.ts`, "compile skips a doc it cannot read…", runs its body in `try` and calls `warn.mockRestore()` in `finally`.
It passes in `pnpm check`.

## 20. Evidence

Order: `pnpm e2e` three times, then `pnpm demo`, then the screenshots.
Each code change found in this pass was followed by a fresh round of three e2e runs before the final recording.

The first e2e run after item 1 failed: "plan, ask, and accept" timed out on `2 selected:`.
With the board in the desktop layout, the properties panel covers the board's left 232 px while a tool is picked, and the flow drew at x 140 under it.
`f2244bc` draws at x 260 and 410, 110 px wide, still left of center so the proposal fits in view.

Final e2e runs, all outside the sandbox:

```
== run 1   ✓ plan, ask, and accept (3.0s)  ✓ compile and split (1.9s)  ✓ launch a run (984ms)   3 passed (9.9s)
== run 2   ✓ plan, ask, and accept (2.8s)  ✓ compile and split (2.0s)  ✓ launch a run (951ms)   3 passed (9.0s)
== run 3   ✓ plan, ask, and accept (2.8s)  ✓ compile and split (2.0s)  ✓ launch a run (954ms)   3 passed (8.5s)
$ pnpm demo
  ✓ [demo] plan, ask, and accept (12.1s)   ✓ [demo] compile and split (5.1s)   ✓ [demo] launch a run (3.6s)   3 passed (23.4s)
```

I checked the end frame and a 2-second contact sheet of each video, and 4 frames a second for the compile video.

What I found, and what I fixed:
- **Proposal row cut off.** The propose row ended in an ellipsis in the 320 px panel; `18faaba` shortened it.
- **Selection hidden under the panel.** In the proposal screenshot, the selected Login box was pushed under the properties panel.
  `applyProposalRequest` scrolled to an out-of-view proposal with plain centering, which ignores the panel.
  `e213843` adds a `centerOn` helper shared with the citation focus, so the ghosts and the selection center together in the clear area at the current zoom.
  The re-shot screenshot shows Login and the ghosts side by side.

What looked odd but needed no fix:
- An apparently blank frame around 2 s in the compile video was a route change; at 4 frames a second the sequence is clean.
- The launch flow's task chips read `main#login` because that flow seeds tasks with no board, which is the intended fallback.

Screenshots: I re-shot all six `docs/design/after-*.png` at 1280 by 800 on the built app and the fake SDK.
I used a copy of Task 3's `screens.mjs`, updated for the "Login" chip, with the scenario's compile, propose, and run rules taken from `e2e/scenario.json`.
I looked at each one: board proposal, panel Markdown with the two-choice ask, spec with the labelled chip, tasks with the launch dialog, sessions, and the doc editor.
File names are unchanged, so the README's image reference and DESIGN.md's table stand.

## Final gates

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 144 files in 111ms. No fixes applied.
 Test Files  54 passed (54)
      Tests  434 passed (434)
check exit=0

$ pnpm build
dist/ui/assets/index-BBqunxhd.js                         2,047.66 kB │ gzip: 667.46 kB
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 1.69s
build exit=0
```

`pnpm check` went from 417 to 434 tests.
The build warns only about the pre-existing chunk size.

## Cleanup

- I stopped the scratch fake-SDK server on port 4955.
- I removed the temporary worktree at `$TMPDIR/base` (used to measure the base flake rate) and `test-results/`.
- `git status` is clean.
- The scratch repository and scripts stay under `$TMPDIR` (`bpcheck/`, `bpscripts/`, `shots/`) for inspection.
- No real Claude session ran, and nothing was pushed.

## Concerns

- Five commits go beyond the twenty items, each forced by them:
  - `a19905a`: a server-close flush, because item 8's extra async hop exposed an existing close race as a flaky test.
  - `f2244bc`: e2e coordinates, because item 1's layout moved the properties panel over the drawing area.
  - `6f961da`: holding the split request, because item 17's assertion raced under slowMo.
  - `18faaba`: a shorter propose row, because item 6's first wording was truncated.
  - `e213843`: the proposal scroll inset, because item 1 asked for the inset re-check and the item 20 screenshot showed the selection under the panel.
- Item 3 is worded so it stays true: Mark done alone does not unblock dependents; the branch must also be merged (`checkGate`).
- Item 5 also labels the tasks view's source chips, since they are the same chips and use the same route; the panel's chips in Claude's replies still show ids.
- Item 6 rows keep the panel's terse lowercase style ("read 3 lines", "drew "Sign-in flow" as ghosts") rather than capitalized sentences, to match the other rows and fit the 320 px panel.
- Two commits were amended locally after a failed gate: `ab0a3f1` (a type error) and `3601c97` (lint).
  Both were amended before any later commit, and nothing was pushed.

## Fix round 2

From the re-review (thread `thr_ebjwcfrme3`). Five commits on `m5-evidence`, none with a co-author or generated-with trailer (`git log 2d054fe..HEAD --format=%B | grep -ciE 'co-authored|generated with'` prints 0).

| # | Commit | Subject |
| --- | --- | --- |
| 1 | `2f252f6` | fix(ui): a heading inside a nested list keeps its level |
| 2 | `f6e70cf` | fix(ui): placement measures arrows and lines by their points |
| 3 | `bc5a897` | fix(ui): the proposals bar centers clear of the properties panel |
| 4 | `363c1ea` | fix(server): a write recreates any .blueprint/ subdirectory it needs |
| 3 (evidence) | `998b7a5` | docs: re-shoot the proposal screenshots and re-record the demo with the bar clear of the panel |

### 1. Shadowed `base` in nested lists (Important)

The list branch's indent is now `indentBase`, so the heading `base` reaches nested lists.
Test: `test/ui/markdown.test.tsx`, "a heading inside a nested list keeps the heading level".
`- a\n  - b\n  # H` renders an h3 by default, and with `headingBase={1}`, `## H` renders an h2.

```
(before) × a heading inside a nested list keeps the heading level   Tests 1 failed | 21 passed (22)
(after)  Tests 22 passed (22)
```

### 2. True bounds for arrows and lines

`ghosts.ts` gains `extent(e)`.
An element with points spans the minimum and maximum of `x + point[0]` and `y + point[1]`; anything else spans `x + width` and `y + height`.
`placeBeside` checks overlaps against these extents, and ghosts.ts still has no Excalidraw import.
Test: the placement test adds a left-pointing arrow at x 330 with points `[0,0]` and `[-150,0]`.
It really spans 180 to 330, so the group lands at 410 instead of on top of it.

```
(before) AssertionError: expected { x: 180, y: +0 } to deeply equal { x: 410, y: +0 }
(after)  Tests 148 passed (148)   [test/ui]
```

### 3. Proposals bar clear of the properties panel

BoardView keeps `inset` state, set on each Excalidraw `onChange` from `leftInset(appState, appState.viewModeEnabled)`, the inset a citation focus uses.
ProposalsBar takes `inset` and sets `--bar-inset`.
The CSS centers the bar at `calc(50% + var(--bar-inset) / 2)`, with `max-width: calc(100% - var(--bar-inset) - var(--space) * 2)`.
At 1280 by 800 the bar spans about x 443 to 950, right of the panel, which ends at 416, and the title is not truncated.
Test: `test/ui/ProposalsBar.test.tsx`, "the bar centers in the board area right of the inset it is given" (`--bar-inset` is `0px` by default and `232px` when given).

```
(before) × the bar centers in the board area right of the inset it is given   Tests 1 failed | 3 passed (4)
(after)  Tests 149 passed (149)   [test/ui]
```

Evidence:
- I re-shot `after-board-proposal.png` and also `after-panel-markdown.png`, which shows the same bar, and looked at both.
- I re-ran `pnpm demo`.
  The frame of `01-plan-ask-accept.webm` with the bar up shows it centered right of the properties panel.

### 4. Missing subdirectories

`restoreDirs(dir)` still rebuilds the whole tree when `.blueprint/` is gone.
It now also runs `mkdir(dir, { recursive: true })` on the directory each write targets.
Test: `test/server/files.test.ts`, "a deleted .blueprint/ subdirectory comes back when a write needs it".
It deletes `boards/` and `tasks/`, then creates and saves a board, reads it back, and writes and lists a task.
My first version used `replaceTasks([])`, which writes no file, so I changed it to write one task.
With the `files.ts` change stashed the test fails; with it, the test passes.
`write()` gained one more async step, so I re-ran the fake-SDK route test in two parallel loops: 0 of 20 failed.

```
(without the change) × a deleted .blueprint/ subdirectory comes back when a write needs it   Tests 1 failed | 25 passed (26)
(with it)            Tests 26 passed (26)
```

### Gates

```
$ pnpm check
Checked 144 files in 88ms. No fixes applied.
      Tests  437 passed (437)
$ pnpm e2e   (three times, outside the sandbox)
== run 1  ✓ plan, ask, and accept (3.0s)  ✓ compile and split (2.0s)  ✓ launch a run (896ms)   3 passed (9.6s)
== run 2  ✓ plan, ask, and accept (2.7s)  ✓ compile and split (1.9s)  ✓ launch a run (908ms)   3 passed (8.1s)
== run 3  ✓ plan, ask, and accept (2.8s)  ✓ compile and split (2.0s)  ✓ launch a run (909ms)   3 passed (9.3s)
$ pnpm demo
  ✓ plan, ask, and accept (11.9s)  ✓ compile and split (4.8s)  ✓ launch a run (3.5s)   3 passed (22.7s)
```

`git status` is clean.
