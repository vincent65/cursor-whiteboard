# Task 6 report: Focus on boards and docs

Commit: `ebbc428 feat(ui): focus cited elements and headings from the route` (no trailer).

## What I implemented

- `src/ui/board/focus.ts`: `focusTargets(elements, focus)` returns the focused ids that exist and are not deleted, in `focus` order, and `[]` when `focus` is undefined or nothing matches.
- `BoardView` takes `focus?: string[]`.
  An effect on `[loaded, focus]` reads the live scene, computes `focusTargets`, and returns early on an empty list.
  Otherwise it runs `updateScene({ appState: { selectedElementIds }, captureUpdate: CaptureUpdateAction.NEVER })` and then `scrollToContent(targets, { fitToViewport: true, animate: true })`.
- `DocView` takes `focus?: string[]`.
  An effect on `[loaded, focus]` walks the doc's lines and finds the first one where `headingSlugs(line.text)[0] === focus[0]`.
  It then dispatches `{ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "start" }) }`.
  A missing slug changes nothing.
- `App.tsx` passes `focus={route.focus}` to both views (2 lines).

### The "scene is loaded" gate

The resolution said to run once `initial` is set and the API ref exists.
That is not enough in Excalidraw 0.18.1.
`excalidrawAPI` is called from the `App` constructor, and `initializeScene` runs from `componentDidMount` after an `await this.props.initialData`.
It then replaces the whole appState (selection and scroll) with `syncActionResult(..., NEVER)`.
So an effect gated only on `initial` and the ref races that microtask, and its selection and scroll can be overwritten.
Excalidraw calls `onChange` only when `!state.isLoading`, so its first call means the scene is in the editor.
`BoardView` therefore keeps `const [loaded, setLoaded] = useState(false)`, sets it to `true` in `onChange`, and gates the effect on it.
React skips the re-render when the state value is unchanged.
`DocView` uses the same `loaded` flag, set right after the `EditorView` is created, because the editor is built in an async `getDoc` callback.

## TDD evidence

RED: `pnpm vitest run test/ui/focus.test.ts`

```
 FAIL  test/ui/focus.test.ts [ test/ui/focus.test.ts ]
Error: Cannot find module '../../src/ui/board/focus' imported from .../test/ui/focus.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `pnpm vitest run test/ui/focus.test.ts`

```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

`pnpm vitest run test/ui`: all UI test files pass.

`pnpm check`: exit 0.
Both `tsc` runs are clean, `biome check .` reports no issues, and vitest reports 38 files and 266 tests passed.
The log contains no warnings and no stderr.
The first `pnpm check` run flagged import order in `BoardView.tsx`, and `biome check --write` fixed it.

## Manual observations

Setup: a scratch project in `$TMPDIR/focus-proj`.
Its board `main` has rectangles `near` (100,100), `far` (3000,2000), and a deleted `gone`, and its doc `notes` has `## Open questions` at line 243.
The server ran with `node --import tsx` because the sandbox blocks tsx's IPC pipe, and Vite ran on port 5179.
I drove Chromium at 1400x850 with Playwright.
Screenshots are in `.superpowers/sdd/2026-11-02-m3-compile/task-6-shots/`.

- `#/boards/main?focus=far` on a fresh load: `far` is selected and centered, the panel shows "1 selected: rectangle", and undo stays disabled (`focus-board-far.png`).
  The board file's appState stayed `{}`, so focusing does not trigger a save.
- `#/boards/main?focus=gone,zz` on a fresh reload: the board opens at its saved view with nothing selected and no error (`focus-board-stale.png`).
- A hash change in place to `?focus=near,far`: both are selected ("2 selected: rectangle, rectangle"), and the view zooms to 20% to fit both (`focus-board-two.png`).
- `#/docs/notes?focus=open-questions`: line 243 `## Open questions` is the first visible line, and its active-line highlight shows the cursor there (`focus-doc.png`).
- `#/docs/notes?focus=no-such-heading` on a fresh load: the doc opens normally with no error.
  A hash change in place to `?focus=notes` then moves the cursor to `# Notes`.
- Console: 0 errors and 0 warnings across the session.

## Files changed

- `src/ui/board/focus.ts` (new)
- `src/ui/board/BoardView.tsx`
- `src/ui/docs/DocView.tsx`
- `src/ui/App.tsx` (not in the brief's list, see Concerns)
- `test/ui/focus.test.ts` (new)

## Self-review

- `focusTargets` uses a Set of live ids, so it ignores deleted elements and keeps the `focus` order.
- `scrollToContent` gets `elements.filter((e) => ids.includes(e.id))`.
  The ids are unique and non-deleted, so this list is exactly the targets.
  The filter avoids a non-null assertion.
- The selection uses `CaptureUpdateAction.NEVER`, and in the browser undo stayed disabled after focusing.
- `route` is React state and changes only on `hashchange`, so `focus` keeps the same identity between renders and the effects do not re-run on unrelated renders.
- `headingSlugs` is imported from `src/export/citations.ts`, which brings in only a type import from `schema.js`.
  The UI already imports types from `src/export/`.

## Concerns

1. `App.tsx` was not in the brief's file list.
   Without `focus={route.focus}` the feature cannot be reached, and the manual check the brief asks for could not pass.
   The dispatch also pointed at "passing route fields to the views", so I made the 2-line change and included it in the commit.
2. With `fitToViewport: true`, a single 200x100 element zooms to 400% and fills the canvas.
   That is heavy for a citation jump.
   With several targets, a target near the left edge sits under Excalidraw's floating properties panel, because the panel opens on selection and the fit ignores it.
   Both follow the brief's exact options.
   One option is `fitToViewport: false` (scroll to center at the current zoom), or `viewportZoomFactor` with a lower cap.
   Worth a look in Task 7's manual pass.
3. Navigating to the same citation hash a second time fires no `hashchange`.
   So if the user deselects and clicks the same citation again, nothing happens.
   That is acceptable now, and Task 7's click handler could force it if needed.
4. Out of scope: on a doc route, the panel's input still reads "Ask Claude about this board".
   This copy problem existed before this task.

## Fix round 0

Commit: `b456a73 fix(ui): focus centers without zooming in` (no trailer).

Ruling: never zoom in to focus.
If the targets fit at the current zoom, center them without changing the zoom.
If they do not fit, fit them with `viewportZoomFactor: 0.8`.
In both cases, keep the targets out from under the properties panel.

### What changed

- `src/ui/board/focus.ts`: new pure helper `fitsInView(box, view, zoom)`.
  It returns `box.width * zoom <= view.width && box.height * zoom <= view.height`.
- `BoardView` computes the targets' box with Excalidraw's exported `getCommonBounds`.
  It passes `{ width: appState.width - left, height: appState.height }` as the view, so the fit check excludes the panel.
  - If the box fits: `scrollToContent(targets, { fitToViewport: true, animate: true, canvasOffsets: { left }, minZoom: z, maxZoom: z })`, where `z` is the current zoom.
  - If it does not fit: `scrollToContent(targets, { fitToViewport: true, animate: true, canvasOffsets: { left }, viewportZoomFactor: 0.8 })`.
- Panel offset: a fixed `PROPERTIES_PANEL_WIDTH = 232` (CSS px), applied whenever `!viewModeEnabled`.
  Excalidraw's `showSelectedShapeActions` opens the panel whenever something is selected outside view mode, and focus has just selected the targets.
  The value matches the screenshot: the canvas starts at x=240, the panel's right edge is at about 456 (216 px), plus a 16 px gap.
  A `ponytail:` comment names the limit: the phone layout puts the panel at the bottom.

### Where this differs from the ruling's literal call

For the "fits" case, I did not use the literal `fitToViewport: false`.
In 0.18.1, `scrollToContent` without a fit option goes through `calculateScrollCenter(targets, state)`, and that path ignores `canvasOffsets`.
Only the `zoomToFit` path reads them (see `zoomToFitBounds` in the dev bundle).
So `fitToViewport: false` would center the target under the panel, which breaks the ruling's other requirement.
Pinning `minZoom = maxZoom = current zoom` under `fitToViewport: true` keeps the zoom exactly and centers within the offset viewport.
The result is the same as the ruling's intent: the view is centered and the zoom does not change.

### TDD evidence

RED: `pnpm vitest run test/ui/focus.test.ts`

```
 FAIL  test/ui/focus.test.ts > fitsInView compares the box at the current zoom with the viewport
TypeError: fitsInView is not a function
      Tests  1 failed | 1 passed (2)
```

GREEN: the same command reports `Tests  2 passed (2)`.
The test covers the ruling's two cases: 100x50 in 1200x800 at zoom 1 fits, and 3000x200 does not.
It adds a third case: 1000x50 at zoom 2 does not fit.

`pnpm check`: exit 0.
Both `tsc` runs are clean, biome reports "Checked 102 files ... No fixes applied.", and vitest reports 38 files and 267 tests passed.
There are no warnings.
The first run failed only because a stray `.playwright-mcp/*.yml` snapshot was still on disk.
I deleted it and the rerun was clean.

### Manual re-check

I used the same scratch project and a 1400x850 Chromium window.
Screenshots are in `task-6-shots/`.

- `#/boards/main?focus=far` on a fresh load: `far` is selected, the zoom stays at 100%, and the rectangle is centered at x≈756 in the area right of the panel (240 + 232 + 568/2 = 756) (`fix0-single.png`).
- A hash change in place to `?focus=near,far` (3100x2000 scene units): this does not fit, so the view zooms out to 10%.
  Excalidraw floors to its 0.1 zoom step.
  Both rectangles are fully visible right of the panel (`fix0-wide.png`).
- Console: no errors from these loads.
  The session log holds 14 WebSocket `ERR_CONNECTION_REFUSED` entries from the earlier tab retrying while the servers were down between rounds.

### Remaining concerns

- The panel width is a fixed number.
  If Excalidraw's panel changes width in an upgrade, the offset drifts, which is cosmetic only.
- The phone layout puts the panel at the bottom, and the left offset is not right there.
  Blueprint's three-column shell is desktop-only today.
