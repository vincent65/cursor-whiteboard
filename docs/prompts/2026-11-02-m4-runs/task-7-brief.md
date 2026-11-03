### Task 7: Launch from the tasks view

**Files:**
- Create: `src/ui/plan/LaunchDialog.tsx`
- Modify: `src/ui/plan/TasksView.tsx`, `src/ui/styles.css`
- Test: `test/ui/LaunchDialog.test.tsx`, `test/ui/TasksView.test.tsx`

**Interfaces:**
- Each task card gets a `Launch` button (label `Launched` and disabled when a run for the slug is `working` or `needs_you`). Clicking opens `LaunchDialog` with the gate result from `gate(slug)`: a list of missing dependencies with reasons (`no run`, `run not done`, `branch not merged into HEAD`), a permission mode select defaulting to `acceptEdits`, an `Launch anyway` checkbox shown only when the gate fails, `Launch` (disabled while the gate fails and the checkbox is off), and `Cancel`. On success it navigates to `#/sessions`.

- [ ] **Step 1: Write the failing tests**

```tsx
test("LaunchDialog explains missing dependencies and needs the override to launch", ...);
test("TasksView opens the dialog and launches with the chosen mode", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/ui/plan/LaunchDialog.tsx src/ui/plan/TasksView.tsx src/ui/styles.css test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx
git commit -m "feat(ui): launch a task into a run from the tasks view"
```

---

