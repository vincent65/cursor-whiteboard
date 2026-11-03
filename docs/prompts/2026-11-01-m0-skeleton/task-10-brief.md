### Task 10: Doc view

**Files:**
- Create: `src/ui/docs/DocView.tsx`, `src/ui/docs/reconcile.ts`, `src/ui/hooks/useDebounced.ts`
- Test: `test/ui/reconcile.test.ts`, `test/ui/useDebounced.test.ts`

**Interfaces:**
- Consumes: `getDoc`, `saveDoc`, `connectWs` from Task 9.
- Produces: `reconcileExternalChange(input: { dirty: boolean; localText: string; diskText: string }): "reload" | "banner" | "noop"`; `useDebounced<T>(fn: (v: T) => void, ms: number): (v: T) => void`; `DocView({ name }: { name: string })`.

- [ ] **Step 1: Write the failing tests**

```ts
test("clean editor reloads, dirty editor with a different disk text gets a banner, identical text is a noop", () => {
  expect(reconcileExternalChange({ dirty: false, localText: "a", diskText: "b" })).toBe("reload");
  expect(reconcileExternalChange({ dirty: true, localText: "a", diskText: "b" })).toBe("banner");
  expect(reconcileExternalChange({ dirty: true, localText: "a", diskText: "a" })).toBe("noop");
});
test("useDebounced calls once with the last value after the delay", ...);   // renderHook with fake timers, three calls within 500ms -> one call with the third value
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/reconcile.test.ts test/ui/useDebounced.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the doc view**

CodeMirror: `EditorView` with `basicSetup`, `markdown()`, and an update listener that marks the doc dirty and calls the debounced save (500 ms); a successful save clears dirty when the saved text equals the current text.
On a `file-changed` message for this doc, fetch the disk text and apply `reconcileExternalChange`: `reload` replaces the editor content; `banner` shows two buttons, `Keep mine` (saves local text) and `Take theirs` (replaces content).

- [ ] **Step 4: Run the tests and verify by hand**

Run: `pnpm vitest run test/ui && pnpm dev`
Then: create a doc in the browser, type, confirm `.blueprint/docs/<name>.md` updates within a second; edit the file in another editor and confirm the banner appears when the editor is dirty and a silent reload when it is clean.
Expected: tests PASS and both manual checks hold.

- [ ] **Step 5: Commit**

```bash
git add src/ui/docs src/ui/hooks test/ui/reconcile.test.ts test/ui/useDebounced.test.ts
git commit -m "feat(ui): markdown doc view with autosave and external-change banner"
```

---

