# untitled (thr_ridqi82i22)

### Spec Compliance
- Issues found. All brief items are present: `toSaveBody`, `filesWithDataUrls`, both tests, CSS imported once, 500 ms version-gated save, 2 s PNG export, and the `file-changed` apply/notice logic.
  - But the notice branch does not work in practice (Important 1).
  - The `sent` echo set is not in the brief, and it suppresses some real disk changes that the brief's rule would have applied (Important 2).
- Extras: a `SceneFile` type export, `vite/client` added to `tsconfig.json` `types`, and the new `.board/.notice/.button` styles. The report calls these controller rulings. They are harmless.
- Interfaces: `toSaveBody` and `filesWithDataUrls` have the signatures the brief requires. `SceneFile` is the same shape as the brief's inline type (`src/ui/board/scene.ts:4-9,21-25,42-45`).
- Tests: `test/ui/scene.test.ts:4-42` is the brief's two tests, with only formatting changed.
- Cannot verify from the diff:
  - The manual Step 4 results, including file contents and mtimes. The report covers them, but the brief says to use `pnpm dev`, and the implementer used a non-watch substitute.
  - Fonts, PNG export and the whole board view in the production build that `blueprint serve` serves. The report checked only the Vite dev build (`dist/dev/fonts`).
- Checks I ran:
  - `src/ui/App.tsx:66` renders `<BoardView key={route.name}>`, so switching boards remounts the view. A stale-closure save cannot write board A into board B.
  - `useDebounced` flushes a pending call on unmount, as the report says.
  - I read the font loader in `@excalidraw/excalidraw@0.18.1` `dist/prod`, and grepped `src`, `vite.config.ts` and `index.html` for `EXCALIDRAW_ASSET_PATH`. It is not set anywhere.

### Strengths
- `scene.ts` is pure and easy to test. The appState allow-list is explicit. The base64 conversion works in chunks, so a large image cannot overflow the call stack.
- Saves run one at a time through a promise queue. The elements are deep-cloned when the save fires, so Excalidraw's in-place mutation cannot corrupt a queued save.
- Debounced work reads `latest` when it fires, and loading, applying an external change and Reload all set `lastSaved`. So none of them writes back to disk.
- The WebSocket handler uses `CaptureUpdateAction.NEVER`, so undo cannot bring back a scene the disk replaced. The load effect guards against a response arriving after unmount.
- The report is honest: it shows the overwrite race it found during manual testing rather than hiding it.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The "Board changed on disk" notice cannot deliver what it promises.**
   - `src/ui/board/BoardView.tsx:153` sets `stale` only when the editor's version differs from `lastSaved`. That condition means a debounced save is already pending. `onChange` (`:173-175`) schedules a save whenever the version differs.
   - Nothing cancels or holds that save while `stale` is true (`save` at `:73-96` never checks `stale`). So within 500 ms the local scene overwrites the external change on disk.
   - The echo of that write is then ignored, because its version is in `sent`. The notice stays up, and Reload (`:158-162`) loads the user's own version.
   - Result: every time the notice appears, the external change is lost and the notice text is false. The report saw this in its step 6.
   - Fix: block saves while `stale` is true, and make Reload mean "take theirs" (DocView-style Keep mine / Take theirs). The notice is visible, so held saves are not silent, which answers the report's objection.
2. **The `sent` echo set never forgets, so a reverted board can be overwritten.**
   - `BoardView.tsx:68,79,147` adds every saved version to `sent` and treats any disk version found there as an echo of the view's own save.
   - Concrete scenario: draw, `git commit`, keep drawing, then `git restore .blueprint/boards/x.excalidraw.json`. The restored version is one this view saved earlier and is still in `sent`. The change is ignored and the editor keeps showing newer content. The next edit then overwrites the restore without warning.
   - The brief's rule (compare against the editor's last saved version) would have applied the change.
   - Fix: remove a version from `sent` when its echo arrives, or track only saves still in flight.
3. **The production build likely loads Excalidraw fonts from esm.sh. The production path is not tested.**
   - In `@excalidraw/excalidraw@0.18.1` `dist/prod`, the font loader builds URLs from `window.EXCALIDRAW_ASSET_PATH`, then always adds `ASSETS_FALLBACK_URL = https://esm.sh/@excalidraw/excalidraw@.../dist/prod/`.
   - The repo never sets `EXCALIDRAW_ASSET_PATH`, so the served build's only font source would be the CDN. Offline, the hand-drawn fonts would fail on the canvas and in exported PNGs.
   - This breaks the local-first constraint ("calls no API", `docs/build-plan.md:22`). The report's "fonts load locally" claim covers only the dev build.
   - Fix: copy or serve `dist/prod/fonts`, set `window.EXCALIDRAW_ASSET_PATH` to a local path, and check the result in the built app.
4. **AppState-only changes are never saved (plan-mandated).**
   - `onChange` (`BoardView.tsx:173`) and `save` (`:77`) gate on the element scene version, as the brief requires.
   - So changing only the background colour or grid, or panning or zooming, is never saved, even though `toSaveBody` deliberately keeps those keys (`scene.ts:12-19`). Those changes are lost on reload.
   - `apply` (`:132-135`) also does not pass `appState` to `updateScene`, so an external background change is not shown either.

#### Minor (Nice to Have)
- `BoardView.tsx:90`: a successful save calls `setError(null)`, which also clears unrelated PNG-export and load errors.
- `BoardView.tsx:94-109`: the PNG is exported only after local edits. After an external change is applied, `export/boards/<name>.png` stays out of date (the report's concern 5).
- `BoardView.tsx:148-155` race: if an external write lands while this view's queued PUT is still in flight, the view applies the external scene. The PUT then writes the older local scene, and its echo is ignored. The editor and disk then disagree without any notice.
- `scene.ts:30` sends every entry in `files`, including images that no element uses any more. The server then extracts unused assets. Also, every save uploads every image's data URL again.
- Type safety: `as unknown as` casts at `BoardView.tsx:36,49,83` hide any mismatch between the loose board schema and Excalidraw's types. One checked adapter would be safer.
- Test gap: neither test checks that `fetchAsset` receives `f.asset`, or that the output keys and `id`/`created` come through. Nothing tests the multi-file or empty-files paths.
- The report notes a pre-existing chunk-size warning from `vite build`, which Excalidraw makes worse. It should be fixed or given a ruling (for example, lazy-load the views).

### Assessment
Task quality: Needs fixes

Reasoning: The pure helpers and the save pipeline are solid. But the external-change handling loses data in two realistic cases: the notice always ends with the disk change overwritten, and the never-cleared `sent` set ignores git reverts. The production build probably loads fonts from a CDN, which breaks local-first.
