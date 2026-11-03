### Task 7: Spec view and tasks view

**Files:**
- Create: `src/ui/plan/SpecView.tsx`, `src/ui/plan/citations.ts`, `src/ui/plan/TasksView.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/styles.css`
- Test: `test/ui/citations.test.ts`, `test/ui/TasksView.test.tsx`

**Interfaces:**
- Produces in `src/ui/plan/citations.ts`: `citationHash(c: Citation): string` (`#/boards/<page>?focus=<id>` or `#/docs/<page>?focus=<id>`), and `citationMarks(text: string): { from: number; to: number; hash: string }[]` (one per citation, using `parseCitations`).
- `SpecView`: loads `getSpec()`; when `text` is null shows `No spec yet. Press Compile in the Claude panel.`; otherwise a read-only CodeMirror editor (`EditorState.readOnly`, Markdown mode, line wrapping) with a `Decoration.mark({ class: "cite" })` on every citation and a click handler on `.cite` that sets `location.hash` to the mark's hash; a `Split into tasks` button that calls `agentSplit()` and shows `Splitting…` until a `split.status` message with `done` or `error` arrives (`error` shows the message); a warning line `Dropped <n> citations that no longer resolve: …` when `dropped` is not empty; reloads on `file-changed` for `spec`.
- `TasksView`: loads `listTasks()` and reloads on `split.status done`; one card per task with the file name, title, `Depends on: a, b`, the acceptance list, and the sources as links built with `citationHash`; `No tasks yet. Split the spec first.` when empty; the split cost as `Split cost $<n>` when the last `split.status done` carried one.
- `src/server/watch.ts` must report `spec` and `task` changes for these reloads: extend `Change.kind` with `"spec" | "task"` and the watched paths with `spec.md` and `tasks/` (a small server change allowed in this task; add the case to `test/server/watch.test.ts` if one exists, else to `ws.test.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
test("citationMarks finds every citation with its hash", ...);
test("TasksView renders cards with dependencies and source links, and the empty state", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/citations.test.ts test/ui/TasksView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**, then verify by hand with `pnpm dev`: a spec with a valid citation shows it underlined; clicking it opens the board with the element selected.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/ui/plan src/ui/App.tsx src/ui/styles.css src/server/watch.ts test/ui/citations.test.ts test/ui/TasksView.test.tsx test/server
git commit -m "feat(ui): spec view with clickable citations and the tasks view"
```

---

