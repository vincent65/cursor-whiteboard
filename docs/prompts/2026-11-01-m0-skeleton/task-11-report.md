# Task 11 report: Board view

Status: DONE_WITH_CONCERNS

Commit: `2aac341 feat(ui): Excalidraw board view with autosave, asset extraction and PNG export`

## What I implemented

### `src/ui/board/scene.ts` (pure, no Excalidraw imports)

- `toSaveBody(elements, appState, files): IncomingScene` copies the elements, passes the files through, and keeps only these appState keys: `viewBackgroundColor`, `gridSize`, `gridModeEnabled`, `zoom`, `scrollX`, `scrollY`.
- `filesWithDataUrls(stored, fetchAsset)` fetches every stored asset in parallel and builds `data:<mime>;base64,...` from `await blob.arrayBuffer()` and `btoa`.
  The bytes go through `String.fromCharCode` in 32 KiB chunks, so a large image cannot overflow the call stack.
- Exports a `SceneFile` type for the `{ id, mimeType, created, dataURL }` shape from the brief.

### `src/ui/board/BoardView.tsx`

- Imports `@excalidraw/excalidraw/index.css` once.
- Loads the board with `getBoard`, rebuilds data URLs with `filesWithDataUrls` (fetching `assetUrl(asset)`), runs the elements through `restoreElements`, and mounts `<Excalidraw initialData onChange excalidrawAPI />` only after the load finishes.
- `onChange` stores the latest scene in a ref.
  It schedules the debounced save (500 ms) and PNG export (2 s) only when `getSceneVersion(elements)` differs from the last saved version, so selection and scroll changes schedule nothing.
- The debounced save reads the latest scene when it fires and checks the version again.
  It records the version as saved and as "sent", deep-clones the elements (Excalidraw mutates elements in place), and queues `saveBoard` so saves run one at a time and in order.
- The debounced PNG export calls `exportToBlob({ elements: getNonDeletedElements(...), appState, files, mimeType: "image/png", exportPadding: 16 })`, then `uploadBoardPng`.
- `file-changed` for this board: fetch the board.
  If its scene version is one this view sent, it is the watcher echoing our own save, so ignore it.
  Otherwise, if the editor's scene version equals the last saved version, `addFiles` and `updateScene` (with `CaptureUpdateAction.NEVER`, so undo cannot bring back the replaced scene).
  If the editor has unsaved edits, show `Board changed on disk. Reload to see it.` with a `Reload` button.
  `Reload` fetches and applies the board the same way and hides the notice.
- Save, PNG and load errors show in a `role="alert"` line, the same way DocView does it.

### Other files (controller rulings)

- `tsconfig.json`: added `"vite/client"` to `types` so the CSS import typechecks.
- `src/ui/styles.css`: `.board`, `.board-canvas`, `.notice`, `.notice-text`, and `.button` (with hover and focus-visible states), using only the existing tokens.

## TDD evidence

RED, before `scene.ts` existed:

```
$ pnpm vitest run test/ui/scene.test.ts
 ❯ test/ui/scene.test.ts:2:1
      1| import type { BoardFile } from "../../src/export/schema";
      2| import { filesWithDataUrls, toSaveBody } from "../../src/ui/board/scen…
       | ^
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN:

```
$ pnpm vitest run test/ui/scene.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

The tests are the two from the brief, with only formatting changed by biome.

Full check before the commit:

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 47 files in 13ms. No fixes applied.
 Test Files  13 passed (13)
      Tests  56 passed (56)
```

`pnpm vite build`: builds successfully (`✓ built in 832ms`), with one warning: `(!) Some chunks are larger than 500 kB after minification.`
This warning exists before this task too: building the previous commit with my changes stashed prints the same warning, because CodeMirror already pushes a chunk past 500 kB.
Excalidraw adds a second large chunk (`index-*.js` 1.9 MB, `chunk-*.js` 1.8 MB).
See Concerns.

## Manual verification (Step 4)

Environment notes:

- `pnpm dev` failed inside this agent's sandbox: `tsx watch` could not listen on its IPC Unix socket (`listen EPERM ... tsx-501/....pipe`).
  The permission check refused running it outside the sandbox, so I ran the same two processes without the watcher: `pnpm exec concurrently -n server,ui "node --import tsx src/cli/index.ts --no-open" "vite"`.
  Same server entry point, same Vite dev server and proxy, only without file watching.
- I drove the UI with gstack `browse` (headless Chromium) at 1440x900.
  Mouse drags were synthetic `PointerEvent`s sent one per animation frame, tool keys were real key presses, and the image paste was a synthetic `ClipboardEvent` carrying a 120x80 PNG `File`.
- I used a board named `t11-manual` in the repo's `.blueprint/` and deleted its board, export, and asset files afterwards.

What I did and observed:

1. Clicked `New board` and entered `t11-manual`.
   The route changed to `#/boards/t11-manual`, and Excalidraw filled the center column between the sidebar and the right pane with no layout problems.
   Fonts load from the local package (`/@fs/.../excalidraw/dist/dev/fonts/...`), not a CDN.
2. Drew two rectangles and an arrow between them, finishing at 23:12:38.
   Excalidraw bound the arrow to both rectangles.
   At 23:12:45 (within the 3 s window):
   - `.blueprint/boards/t11-manual.excalidraw.json` was written at 23:12:38 (5291 B) and contains no `dataURL`.
   - `.blueprint/export/boards/t11-manual.md` was written at 23:12:38 and holds a Mermaid `n1 --> n2` flowchart with the original Excalidraw IDs in the ids comment.
   - `.blueprint/export/boards/t11-manual.png` was written at 23:12:40 (2 s after the last edit), a 532x132 RGBA PNG.
     I opened it: both boxes and the arrow render correctly.
3. Pasted an image at 23:12:56.
   At 23:12:59:
   - The board JSON was rewritten at 23:12:56, `grep -c dataURL` returns `0`, and `files` holds `{ id, mimeType, created, asset: "assets/72c5...cf8c.png" }`.
   - `.blueprint/assets/72c54328...cf8c.png` exists (1800 B, written 23:12:56).
   - The Markdown lists `[image] assets/72c5...png (bvzqKcG6QHsk7-RCX6Izs)`, and the PNG was re-exported at 23:12:58.
4. Reloaded the page.
   Both rectangles, the bound arrow, and the image came back with the same element IDs, and the image was drawn from the rebuilt data URL.
   The board file's mtime did not change, so loading did not trigger a save.
5. External edit with a clean editor: a Node script moved one rectangle in the board file (y 250 to 450, version bumped).
   The editor updated in place, with no notice.
6. External edit with unsaved local edits: drew an ellipse, then immediately ran the same script (y to 350).
   The notice `Board changed on disk. Reload to see it.` appeared with a `Reload` button, styled like the DocView banner, with the canvas reflowing below it.
   Clicking `Reload` hid the notice.
   Observed problem: autosave keeps running while the notice is up, so the pending local save (500 ms) overwrote the external edit (disk ended at y 450, not 350).
   See Concerns.
7. Network log for the session: one `PUT` per edit and one PNG `POST` per burst of edits.
   No `PUT` on load, on an applied external change, or on `Reload`.
   No notice appeared during normal drawing, so echo suppression works.
8. Console: no errors from this view.
   The one 404 was from my own debug `import()` of a wrong module path.
   The `WebSocket is closed before the connection is established` warning at page load comes from StrictMode mounting effects twice in dev, which closes the first socket while it is still connecting.
   This is pre-existing `connectWs` behavior that DocView shares.

Side effect I reverted: gstack `browse` appended `.gstack/` to the repo's `.gitignore` and created a `.gstack/` directory.
I reverted `.gitignore` and removed the directory, so the working tree is clean apart from the committed files.

Debugging note: my first drag attempt sent every pointer move in the same frame.
Excalidraw throttles pointer moves to animation frames, so it created zero-size elements, and the exported PNG was a correct but empty 32x32 image (padding only).
After I sent one move per frame, the elements had real sizes and the PNG was correct.
This was a test-harness issue, not a product bug.

## Files changed

- `src/ui/board/BoardView.tsx` (replaces the stub)
- `src/ui/board/scene.ts` (new)
- `test/ui/scene.test.ts` (new)
- `src/ui/styles.css` (board and notice styles, controller ruling)
- `tsconfig.json` (`vite/client` in `types`, controller ruling)

No new dependencies.

## Self-review

- Completeness: `toSaveBody` and `filesWithDataUrls` exist with the brief's signatures, both tests pass, and autosave, PNG export, and the notice behave as specified (manual steps 2 to 7).
- No redundant saves: saves are gated on scene version both when scheduling and when firing.
  Loading, applying an external change, and `Reload` all set the last saved version, so none of them saves back (confirmed in the network log).
- No leaked timers: both debounces use `useDebounced`, which clears its timer on unmount and flushes a pending call.
  The flush reads the scene ref captured at the last `onChange`, not the unmounted editor, so leaving the board saves the last edit instead of an empty scene.
  The WebSocket closes on unmount, and the load effect ignores a response that arrives after unmount.
- A save scheduled before an external reload cannot write the old scene back: debounced work reads the latest scene when it fires, and after the reload that scene's version equals the last saved version.
- Element IDs are never rewritten: `restoreElements` keeps IDs, and step 4 showed the same IDs after a reload.
- Board files hold no image data: the UI sends data URLs and the server extracts them (step 3).

## Concerns

1. Autosave continues while the notice is shown, so an external edit that arrives while local edits are still unsaved gets overwritten within 500 ms (observed in step 6).
   After that, `Reload` shows the user's own version, so the notice text is misleading in that case.
   The brief only says to show the notice with a reload button.
   I did not pause autosave because then, if the user ignores the notice, their later work would silently stop saving, which is worse.
   Suggested follow-up: "Keep mine / Take theirs" like DocView, with autosave paused until the user chooses.
2. `pnpm vite build` prints the 500 kB chunk-size warning.
   It existed before this task (CodeMirror), and Excalidraw adds a second large chunk.
   Fixing it means `build.chunkSizeWarningLimit` or manual chunking in `vite.config.ts`, or lazy-loading the views in `App.tsx`, all outside this task's file list.
3. `pnpm dev` (tsx watch) cannot start inside the agent sandbox because of its IPC socket.
   I verified with the same processes without the watcher.
   This does not affect real users.
4. Echo detection compares `getSceneVersion`, which is a sum of element versions.
   An external edit whose sum happens to equal a version this view already sent would be ignored.
   This is marked with a `ponytail:` comment; `hashElementsVersion` is the upgrade path.
5. The PNG export is triggered only by local edits.
   After an external change is applied, `export/boards/<name>.png` stays stale until the next local edit (the Markdown export is server-side and stays current).

## Fix round 1

Commit: `d260d75 fix(ui): hold saves behind the disk-change notice, track in-flight echoes, serve fonts locally, save appState changes`

### Changes per finding

Important #1 (the notice could not deliver what it promised):

- The notice is now `Board changed on disk.` with `Keep mine` and `Take theirs` (controller ruling), reusing the existing `.button` style.
- While the notice is up, the debounced save and PNG export both return early, so the local scene cannot overwrite the disk change.
- `Keep mine` hides the notice, saves the latest local scene right away (no gate), and schedules a PNG export.
- `Take theirs` fetches the board and applies it.
- Applying a disk scene (from `Take theirs` or a clean-editor reload) now clears the latest-scene ref.
  A debounced save still pending from before therefore finds nothing to save and cannot write the old scene back.

Important #2 (the echo set never forgot):

- `sent` is replaced by `inFlight`, which holds the save states of PUTs not yet answered.
  Each entry is removed in the save's `finally`.
- A `file-changed` event counts as an echo only if the disk state matches the last saved state or a save still in flight.
  Any older version, such as a `git restore` to something this view saved earlier, is handled as a real disk change.
- The server already skips its own writes for 1 s (`wasWrittenRecently`), so echoes are rare.
  The in-flight check covers a late echo of a save that is still in progress.

Important #3 (fonts came from esm.sh):

- New `scripts/copy-excalidraw-assets.mjs` resolves `@excalidraw/excalidraw` with `import.meta.resolve` and copies its `dist/prod/fonts` to `src/ui/public/fonts`, replacing any previous copy.
  The dev and prod font file lists are identical.
- `package.json` runs the script in `dev` (before `concurrently`) and in `build` (before `vite build`).
  Vite copies `src/ui/public` to `dist/ui`.
- `src/ui/index.html` sets `window.EXCALIDRAW_ASSET_PATH = "/"` in an inline script before the app module loads.
  Excalidraw tries this base first and only falls back to esm.sh if the local fetch fails.
- `.gitignore` has a new `src/ui/public/` entry, because that directory is generated.

Important #4 (appState-only changes were never saved):

- `scene.ts` has a new `shouldSave(prev, next)` over `SaveState = { version, appState }`.
  It returns true when the element scene version changed or any of `viewBackgroundColor`, `gridSize`, `gridModeEnabled` changed.
  Zoom and scroll never trigger a save, but `toSaveBody` still includes them in the body.
- `onChange`, the debounced save, echo detection, and the dirty check all use `shouldSave`.
- Loaded appState now goes through `restoreAppState`.
  This fills in Excalidraw's defaults, so the editor's first `onChange` matches the load and does not count as an edit.
- `apply` passes the persisted appState subset (`persistedAppState`, newly exported from `scene.ts`, which `toSaveBody` now uses) to `updateScene`.

### Covering tests

- New `shouldSave triggers on scene version and saved appState, not on zoom or scroll` in `test/ui/scene.test.ts`.
  It covers no change, zoom and scroll only (false), a version bump, `viewBackgroundColor`, `gridSize`, and `gridModeEnabled` (true).
- RED: `pnpm vitest run test/ui/scene.test.ts` gave `TypeError: shouldSave is not a function`, `Tests 1 failed | 2 passed (3)`.
- GREEN: the same command gave `Tests 3 passed (3)`.
- I kept the in-flight echo tracking inline (a `Set` plus one `.some`), so it has no separate unit test.
  The `git restore` manual check below covers it.

### Commands and output

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
 Test Files  13 passed (13)
      Tests  57 passed (57)

$ pnpm build
> tsc -p tsconfig.server.json && node scripts/copy-excalidraw-assets.mjs && vite build
✓ 2328 modules transformed.
dist/ui/index.html  0.67 kB │ gzip: 0.41 kB
(!) Some chunks are larger than 500 kB after minification. ...   <- pre-existing warning
✓ built in 842ms
```

After the build, `dist/ui/fonts` holds all 234 font files.

### Manual observations

I ran the built app with `node dist/cli/index.js --no-open` in a scratch git repository under `/tmp/claude/t11-scratch`, drove it with gstack `browse` at 1440x900, and created a board named `fonts`.

1. Fonts: I drew a rectangle and typed a text element.
   The network log shows `GET http://localhost:4242/fonts/Excalifont/Excalifont-Regular-a88b...woff2 → 200` and zero requests matching `esm.sh`, both in that session and after a page reload.
   The text renders in the hand-drawn Excalifont on the canvas and in `.blueprint/export/boards/fonts.png`.
   The console had no errors.
2. Background color: I picked `#fffce8` from the main menu's canvas background swatches.
   The board file was rewritten and its `appState.viewBackgroundColor` became `#fffce8`.
   After a page reload the canvas was still that color, and the board file was not rewritten on load.
3. External appState change with a clean editor: I set `viewBackgroundColor` to `#f5faff` in the file.
   The editor switched to it within about 1.5 s, with no notice.
4. Conflict, `Keep mine`: I drew an ellipse and immediately moved the rectangle in the file (y 250 to 450).
   The notice `Board changed on disk.` appeared with `Keep mine` and `Take theirs`.
   2.5 s later the disk still held the external edit (rectangle at 450, no ellipse), so the save was held.
   Clicking `Keep mine` hid the notice and wrote the local scene (rectangle at 250, plus the ellipse).
5. Conflict, `Take theirs`: I drew a small rectangle and immediately moved the rectangle in the file (y to 150).
   The notice appeared and the disk kept the external edit.
   Clicking `Take theirs` hid the notice and showed the disk scene (rectangle at 150, my small rectangle gone).
   The board file's mtime did not change afterwards, so nothing was saved back.
6. Restore to a version this view saved: I committed the board file as the view had saved it, drew a diamond (saved), then ran `git restore` on the file.
   The editor reloaded without the diamond, and the next edit (a new rectangle) saved without bringing the diamond back.
7. I stopped the server and the browse daemon and deleted the scratch repository.
   gstack's `.gstack/` stayed inside the scratch repository, so the project tree has nothing extra.

### Concerns

- Saves are held while the notice is up.
  If the user leaves the board without choosing, the unmount flush is held too, so those local edits are dropped.
  DocView behaves the same way during its conflict.
- The 500 kB chunk-size warning is still printed by the build (pre-existing).
- After `Take theirs` or an applied external change, `export/boards/<name>.png` is stale until the next local edit (unchanged from round 0).
