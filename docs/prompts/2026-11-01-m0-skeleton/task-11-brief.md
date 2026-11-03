### Task 11: Board view

**Files:**
- Create: `src/ui/board/BoardView.tsx`, `src/ui/board/scene.ts`
- Test: `test/ui/scene.test.ts`

**Interfaces:**
- Consumes: `getBoard`, `saveBoard`, `uploadBoardPng`, `assetUrl`, `connectWs` from Task 9; `useDebounced` from Task 10.
- Produces (`src/ui/board/scene.ts`): `toSaveBody(elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, { id: string; mimeType: string; created: number; dataURL: string }>): IncomingScene` and `filesWithDataUrls(stored: BoardFile, fetchAsset: (asset: string) => Promise<Blob>): Promise<Record<string, { id: string; mimeType: string; created: number; dataURL: string }>>`.

- [ ] **Step 1: Write the failing tests**

```ts
test("toSaveBody keeps elements and files and reduces appState to the persisted subset", () => {
  const body = toSaveBody([{ id: "r1" }], { viewBackgroundColor: "#fff", collaborators: new Map(), selectedElementIds: { r1: true } }, {});
  expect(body.elements).toEqual([{ id: "r1" }]);
  expect(body.appState).toEqual({ viewBackgroundColor: "#fff" });
});
test("filesWithDataUrls fetches each asset and builds a data URL", async () => {
  const emptyBoard: BoardFile = { type: "excalidraw", version: 2, elements: [], appState: {}, files: {} };
  const stored = { ...emptyBoard, files: { f1: { id: "f1", mimeType: "image/png", created: 1, asset: "assets/x.png" } } };
  const files = await filesWithDataUrls(stored, async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
  expect(files.f1.dataURL).toBe("data:image/png;base64,AQID");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/scene.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the board view**

`toSaveBody` keeps only these appState keys: `viewBackgroundColor`, `gridSize`, `gridModeEnabled`, `zoom`, `scrollX`, `scrollY`.
`filesWithDataUrls` builds each data URL from `await blob.arrayBuffer()` and `btoa`, not `FileReader`, so it runs in the browser and in Node tests alike.
`BoardView` loads the board and its asset data URLs, renders `<Excalidraw initialData={{ elements, appState, files }} onChange excalidrawAPI />` with the Excalidraw CSS imported once, saves 500 ms after the last change only when `getSceneVersion(elements)` changed since the last save, and 2 s after the last change exports a PNG with `exportToBlob({ elements, appState, files, mimeType: "image/png", exportPadding: 16 })` and uploads it.
On a `file-changed` message for this board: if the scene version equals the last saved version, reload the board into the editor with `updateScene` and `addFiles`; otherwise show a notice `Board changed on disk. Reload to see it.` with a reload button.

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui/scene.test.ts && pnpm dev`
Then: create a board, draw two boxes and an arrow, paste an image, and confirm within three seconds that `.blueprint/boards/<name>.excalidraw.json` has no `dataURL`, `.blueprint/assets/` has the image, and `.blueprint/export/boards/<name>.md` and `.png` exist; reload the page and confirm the drawing and image come back.
Expected: tests PASS and the manual checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board test/ui/scene.test.ts
git commit -m "feat(ui): Excalidraw board view with autosave, asset extraction and PNG export"
```

---

