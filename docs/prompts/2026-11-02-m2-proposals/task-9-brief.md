### Task 9: Refine from the panel

**Files:**
- Modify: `src/ui/panel/ClaudePanel.tsx`, `src/ui/styles.css`
- Test: `test/ui/ClaudePanel.test.tsx`

**Interfaces:**
- Consumes: `useRefine` (Task 7), `agentSend` with `proposalId` (Task 7).
- Produces: the `Stopped` result row shows its cost as `Stopped · $<cost> total`, matching the Done row (carried from the milestone 1 final review); the regex that strips a `[Selection on board …]` header from user bubbles, and its test, are removed (the server now sends the typed text as the user event, Task 4); while `target` is set the panel shows a chip above the composer, `Refining <id> · <title>` with an `×` button that clears it, focuses the textarea, sends the next message with `proposalId: target.id`, and clears the target after the send resolves. Tool rows for `propose` and `revise` already read `proposing 2 changes` and `revising p_…` through `summarizeTool`.

- [ ] **Step 1: Write the failing tests**

```tsx
test("a refine target shows a chip, sends the proposal id, and clears", async () => {
  // render inside RefineProvider with a test button that calls setTarget({ id: "p_1", title: "Login flow" })
  // chip text "Refining p_1 · Login flow"; typing "tighter" + Enter → agentSend("tighter", <selection or undefined>, "p_1"); chip gone afterwards
});
test("the chip's × clears the target without sending", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/ClaudePanel.test.tsx`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panel/ClaudePanel.tsx src/ui/styles.css test/ui/ClaudePanel.test.tsx
git commit -m "feat(ui): refine a proposal from the panel"
```

---

