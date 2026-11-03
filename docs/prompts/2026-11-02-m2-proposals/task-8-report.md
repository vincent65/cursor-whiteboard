# Task 8 report: Board integration

Status: DONE_WITH_CONCERNS
Commit: `a8d2db0 feat(ui): the board applies proposals as ghosts and decides them`

## What I implemented

All changes are in `src/ui/board/BoardView.tsx`, plus a one-line position fix in `src/ui/styles.css`.

- `throughGhosts(elements, change)` is the single boundary helper.
  It runs a ghosts.ts transform, casts the result back to `ExcalidrawElement[]`, bumps the version of every element the transform replaced, then runs `restoreElements(next, null, { refreshDimensions: true, repairBindings: true })`.
  `ExcalidrawElement` is structurally assignable to `El`, so the Excalidraw-to-`El` direction needs no cast, and `El` is not widened.
  - Bumping versions was not in the brief, but without it the change goes unnoticed.
    ghosts.ts spreads elements without bumping `version`.
    A reject that only restores styles, or that sets `isDeleted`, would leave `getSceneVersion` unchanged.
    `shouldSave` would then skip the save, the bar memo would not recompute, and Excalidraw's undo store would not see the change.
    Only replaced elements are bumped, detected by identity: ghosts.ts copies only the elements it changes.
- `applyProposalRequest(ex, proposal, replace)` is a module-level named function.
  1. It renders every `add_diagram` and `add_note` into the `rendered` map first, so any conversion error leaves the scene untouched.
  2. It reads `getAppState()` and `getSceneElementsIncludingDeleted()`.
  3. When `replace` is set, it first runs `decideProposal(..., "rejected")`.
  4. It calls `applyProposal` with the current selection ids and the viewport.
     The viewport comes from `getVisibleSceneBounds(appState)`, which uses the same formula as the brief.
  5. It calls `updateScene` with `CaptureUpdateAction.IMMEDIATELY`.
  6. It calls `scrollToContent(touched, { animate: true, fitToViewport: false })` only when some touched element fails `isElementInsideBBox` against the visible bounds.
  7. It returns `{ elementIds }`.
- In `answer()`, the `proposal.apply` branch refuses with `board <x> is not open` or `board <name> is still loading`.
  It records the title in the titles map, then delegates to `applyProposalRequest`.
- `decide(id, decision)` updates the scene locally through `throughGhosts(decideProposal)`, then calls `api.decideProposal`.
  On a 404, it logs with `console.warn` and the local change stands.
  Other failures show `Decision failed: …` in the board's existing error line.
  It also clears the refine target if it pointed at the decided proposal, so the panel cannot send a refine for a proposal that no longer exists.
  This is a small addition beyond the brief.
- The bar's data:
  - `pending` state is recomputed in `onChange` when `getSceneVersion` changes.
    `setPending` keeps the previous array when nothing changed, so ordinary edits do not re-render `BoardView`.
  - `titles` is a `Map<string, string | null>` in state, filled by apply requests and by `api.listProposals()` on mount.
  - `onRefine` calls `setTarget({ id, title })`.
- `.proposals-bar` moved from `bottom: 16px` to `bottom: 64px` (details below).

## TDD evidence

The brief says no new unit test: `BoardView` cannot render in jsdom because Excalidraw needs a real canvas, and the logic it wires is covered by the tests from Tasks 5 to 7.
Verification was typecheck, the full suite, and a manual end-to-end run with Claude on a real login.

```
$ pnpm check
tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 93 files in 46ms. No fixes applied.
 Test Files  33 passed (33)
      Tests  197 passed (197)

$ pnpm build
(!) Some chunks are larger than 500 kB after minification.   <- pre-existing, only warning
✓ built in 945ms
```

## Manual observations

Setup:
- I built the server and ran it from a scratch project (`$TMPDIR/bp-t8`), using `node dist/cli/index.js`.
  `tsx watch` cannot open its IPC socket inside the sandbox.
- vite ran from the repo, and I drove it with the Playwright MCP browser at 1440x900.
  gstack `/browse` could not launch Chromium inside the sandbox (mach-port permission denied).
- The board was `main`: two labeled rectangles, API and Database, joined by a bound arrow.

### Scenario 1: "Add a cache between these two", all three selected

- The panel showed `proposing 3 changes`.
- **Claude's choice:** delete `api` and `db`, plus an `add_diagram` of API → Cache → Database with `near: [api, db]`.
  Claude did not touch the arrow.
  It said in chat that it "didn't get an id for the old API-to-Database arrow".
  So the expected "arrow turns red dashed" did not happen; Claude deleted the two boxes instead.
- The two deleted boxes rendered red (`#e03131`), dashed, at opacity 40.
  Their bound labels faded to opacity 40.
- The diagram landed at x=760, which is the Database box's right edge (680) plus 80.
  It is top-aligned at y=200, dashed, at opacity 40, with groupIds `[p_…]`.
- The view scrolled with animation, because the new ghosts were outside the viewport.
- The bar read `Claude proposed Insert cache between API and Database · 5 added, 2 removed`.
- Saved versions were bumped (v1 to v3), and the ghosts were persisted to the board file.
- **Bar overlap found and fixed:** at `bottom: 16px` the bar (x 285 to 1035, y 835 to 884) covered the zoom and undo/redo controls and touched the help button.
  Excalidraw's footer spans y 848 to 884, which is 16px to 52px from the bottom.
  At `bottom: 64px` the bar ends at y=836, 12px above the footer, and all footer controls are clear and clickable.
- I reloaded with the proposal still pending.
  The bar was rebuilt from the scene, and the title came back via `listProposals`.
- **Reject:** both boxes went back to solid `#1e1e1e` at opacity 100, and the original `customData` (none) was restored.
  The ghost diagram was removed (saved as `isDeleted`), and the bar disappeared.
- `proposals.jsonl` had a `proposed` line and a `rejected` line.

### Scenario 2: "Draw the login flow as a flowchart", nothing selected

- The panel showed `proposing 1 change`.
- The ghosts landed right of all content, at x=760 and y=200, and the view scrolled to them.
- The bar read `Claude proposed Login flow · 24 added`.
- **Accept:** all 44 live elements became solid at opacity 100 with `customData {origin: "ai", proposalId}`, and the proposal group was kept.
  The bar disappeared, and the log had an `accepted` line.

### Scenario 3: reload, then the 404 path

- Claude proposed a note, `Rate limiting TODO · 1 added`.
  It landed right of all content, at x=1714 and y=200.
- I reloaded the page, and the bar was rebuilt with its title.
- I stopped the server, appended a `rejected` line for that proposal to the log, and restarted the server, so the server no longer had it pending.
- I clicked **Accept**.
  The console showed `warning: proposal p_23f09afc is not pending`, the error banner stayed hidden, and the bar went away.
  The note was saved solid with real `customData`, so the local change stands.

There were no app console errors.
The only errors were WebSocket-refused messages while I restarted vite, and the browser's own network log line for the deliberate 404.

## Files changed

- `src/ui/board/BoardView.tsx`
- `src/ui/styles.css` (`.proposals-bar` `bottom: 64px` and a comment; allowed by the dispatch for this purpose only)

## Self-review findings

- The 404 is detected by its message (`endsWith("is not pending")`), because `api.request` throws a plain `Error` without the status.
  Changing `api.ts` was outside my file list.
  If the server's text changes, a 404 would show up as a `Decision failed:` banner instead of a warning.
  A better long-term fix is a status-carrying error in `api.ts`.
- `scrollToContent` centers all touched elements without zooming (`fitToViewport: false`, per the brief).
  When the deleted originals and the new diagram together are wider than the canvas, part of the new diagram stays off-screen (seen in scenario 1).
  This works as specified, but the view is not ideal.
- Undo after Accept or Reject brings the ghosts back locally, but the server has already logged the decision.
  The bar then shows the proposal again, and deciding it again hits the 404 path, so it only warns.
  This leaves no broken state, but undoing a decision is not synced.
- The apply branch does not check the disk-conflict state.
  Ghosts are drawn, and they save once the conflict is resolved with "Keep mine".

## Concerns

1. **Server, outside this task:** Claude reported it "didn't get an id for the old API-to-Database arrow".
   The board Markdown from `get_board` / `selection.snapshot` seems to omit ids for edges, so Claude cannot delete or update an arrow, and the planned "arrow turns red dashed" step cannot happen.
   This is worth a look in the final wave.
2. The 404 detection depends on the server's message text (see above).
3. The `throughGhosts` version bump goes beyond the brief, but saves, undo, and the bar memo depend on it.
   Reviewers should confirm this is the intended boundary.
