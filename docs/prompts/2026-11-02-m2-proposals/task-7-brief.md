### Task 7: The proposals toolbar, the refine context, and the API client

**Files:**
- Create: `src/ui/board/ProposalsBar.tsx`, `src/ui/panel/refine.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/styles.css`
- Test: `test/ui/ProposalsBar.test.tsx`, `test/ui/refine.test.tsx`

**Interfaces:**
- Consumes: `Counts` (Task 5), `Proposal`, `Decision` (Task 1), routes from Task 4.
- Produces in `src/ui/api.ts`: `agentSend(text, selection?, proposalId?)` posts `{ text, selection, proposalId }`; `listProposals(): Promise<Proposal[]>`; `decideProposal(id: string, decision: Decision): Promise<void>`.
- Produces in `src/ui/panel/refine.tsx`: `RefineProvider`, `useRefine(): { target: { id: string; title: string | null } | null; setTarget(t: { id: string; title: string | null } | null): void }`. `App` wraps the shell in it next to `SelectionProvider`.
- Produces in `src/ui/board/ProposalsBar.tsx`:

```ts
export function ProposalsBar(props: {
  items: { id: string; title: string | null; counts: Counts }[];
  onDecide(id: string, decision: Decision): void;
  onRefine(id: string): void;
}): JSX.Element | null;   // null when items is empty
```

  One row per item: `Claude proposed <title or "changes"> · <parts>` where parts are the non-zero counts as `2 added`, `1 changed`, `1 removed` joined by `, `; then buttons `Accept`, `Reject`, `Refine`. Styles: `.proposals-bar` floats at the bottom center of `.board` (absolute, `bottom: 16px`, `left: 50%`, translated, surface background, border, radius, shadow); `.proposals-row`; `Accept` uses an accent-filled `.button-primary`.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
test("renders a row per proposal with counts and wires the buttons", async () => {
  // items: p_1 "Login flow" {2,0,0}; p_2 null {0,1,1}
  // text "Claude proposed Login flow · 2 added" and "Claude proposed changes · 1 changed, 1 removed" are present
  // clicking Accept in the first row calls onDecide("p_1", "accepted"); Reject in the second calls onDecide("p_2", "rejected"); Refine calls onRefine("p_2")
});
test("renders nothing without proposals", ...);
// refine.test.tsx: useRefine starts null; setTarget updates consumers
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/ProposalsBar.test.tsx test/ui/refine.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/ProposalsBar.tsx src/ui/panel/refine.tsx src/ui/api.ts src/ui/App.tsx src/ui/styles.css test/ui/ProposalsBar.test.tsx test/ui/refine.test.tsx
git commit -m "feat(ui): proposals toolbar, refine context, and proposal API calls"
```

---

