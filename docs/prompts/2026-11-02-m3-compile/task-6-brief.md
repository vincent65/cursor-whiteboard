### Task 6: Focus on boards and docs

**Files:**
- Create: `src/ui/board/focus.ts`
- Modify: `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx`
- Test: `test/ui/focus.test.ts`

**Interfaces:**
- Produces in `src/ui/board/focus.ts`: `focusTargets(elements: readonly { id: string; isDeleted?: boolean }[], focus: string[] | undefined): string[]` (the ids that exist and are not deleted, in `focus` order; `[]` when none).
- `BoardView` takes `focus?: string[]`; after the scene is loaded, and whenever `focus` changes, it selects `focusTargets(...)` via `updateScene({ appState: { selectedElementIds } })` and calls `scrollToContent(targets, { fitToViewport: true, animate: true })`; an empty target list changes nothing.
- `DocView` takes `focus?: string[]`; it scrolls the editor to the first heading whose slug (per `headingSlugs`) equals `focus[0]` and places the cursor there; a missing slug changes nothing.

- [ ] **Step 1: Write the failing tests**

```ts
test("focusTargets keeps existing, non-deleted ids in focus order", () => {
  expect(focusTargets([{ id: "a" }, { id: "b", isDeleted: true }, { id: "c" }], ["c", "b", "zz", "a"])).toEqual(["c", "a"]);
  expect(focusTargets([{ id: "a" }], undefined)).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run test/ui/focus.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement, then verify by hand** with `pnpm dev`: open `#/boards/main?focus=<an id from the export>` and see the element selected and centered; open `#/docs/<doc>?focus=<slug>` and see the heading at the top.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/focus.ts src/ui/board/BoardView.tsx src/ui/docs/DocView.tsx test/ui/focus.test.ts
git commit -m "feat(ui): focus cited elements and headings from the route"
```

---

