### Task 10: Robustness carried from milestone 0

**Files:**
- Modify: `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx`
- Test: `test/ui/docReload.test.ts`

**Interfaces:**
- Produces in `src/ui/docs/DocView.tsx` (exported for the test): `replaceFromDisk(view: EditorView, text: string): void` which replaces the document without adding to undo history (`Transaction.addToHistory.of(false)` plus the remote annotation) and keeps the cursor at the same offset clamped to the new length.
- `BoardView`: a `file-changed` for the open board that arrives while a save is in flight is handled after the save queue settles, so the comparison uses the settled state.

- [ ] **Step 1: Write the failing test** (jsdom)

```ts
test("replaceFromDisk keeps the cursor, adds no undo step, and does not mark the doc dirty", () => {
  // build an EditorView with history(); place cursor at 3; replaceFromDisk with longer text; undoDepth(state) stays 0; selection.main.head is 3
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run test/ui/docReload.test.ts`
Expected: FAIL, `replaceFromDisk` not exported.

- [ ] **Step 3: Implement both changes**

For the board, wrap the watcher handler body in `queue.current.then(...)` so it runs after pending saves.

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui && pnpm dev`
Then: edit a doc externally while clean and confirm Ctrl+Z does not resurrect the old text; edit the board file externally right after a stroke and confirm no spurious conflict banner.
Expected: tests PASS and both checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/BoardView.tsx src/ui/docs/DocView.tsx test/ui/docReload.test.ts
git commit -m "fix(ui): settle saves before comparing disk changes and reload docs without undo steps"
```

---

