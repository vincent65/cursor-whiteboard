### Task 4: Selection reporting and browser responders

**Files:**
- Create: `src/ui/board/snapshot.ts`
- Modify: `src/ui/board/BoardView.tsx`
- Test: `test/ui/snapshot.test.ts`

**Interfaces:**
- Produces in `src/ui/board/snapshot.ts`:

```ts
export function selectedIds(appState: { selectedElementIds: Record<string, boolean> }, elements: readonly { id: string; isDeleted?: boolean }[]): string[];  // ids in element order, non-deleted only
export function blobToDataUrl(blob: Blob): Promise<string>;   // arrayBuffer + btoa, never FileReader
export function sameIds(a: string[], b: string[]): boolean;
```

- `BoardView` sends `selection.changed` (debounced 150 ms, only when the id list changed) and answers server requests: `board.png` with `{ png: dataUrl }` of the whole board, `selection.snapshot` with `{ ids, png: dataUrl | null }` where the PNG covers only the selected elements (export padding 16) and is null when nothing is selected.

- [ ] **Step 1: Write the failing tests**

```ts
test("selectedIds keeps element order and drops deleted elements", () => {
  expect(selectedIds({ selectedElementIds: { b: true, a: true, z: true } }, [{ id: "a" }, { id: "b" }, { id: "z", isDeleted: true }])).toEqual(["a", "b"]);
});
test("blobToDataUrl encodes bytes", async () => {
  expect(await blobToDataUrl(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }))).toBe("data:image/png;base64,AQID");
});
test("sameIds compares as ordered lists", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/snapshot.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helpers and wire the board view**

The responders live in a `useServerEvent` handler in `BoardView` that answers only requests for its own board (`board.png` with a different board name is answered with `ok: false` and the error `board <name> is not open`); `selection.snapshot` uses the latest scene from the `latest` ref.

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui/snapshot.test.ts && pnpm dev`
Then: select shapes and confirm in the browser devtools network tab (WS frames) that `selection.changed` is sent once per change.
Expected: tests PASS and the check holds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/snapshot.ts src/ui/board/BoardView.tsx test/ui/snapshot.test.ts
git commit -m "feat(ui): report the board selection and answer snapshot requests"
```

---

