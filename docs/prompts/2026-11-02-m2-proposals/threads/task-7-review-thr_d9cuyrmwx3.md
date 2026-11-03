Review of `fab1e18` against the Task 7 brief: approved, with minor notes only.

### Spec Compliance
- Spec compliant. Every file the brief lists was created or changed, and nothing else was.
- `ProposalsBar` has the signature the brief asks for and returns `null` for an empty list (`src/ui/board/ProposalsBar.tsx:20`).
  - Each row reads `Claude proposed <title ?? "changes"> · <parts>`, listing only the non-zero counts as `added`/`changed`/`removed`, joined by `, ` (`ProposalsBar.tsx:5-13,26-28`).
  - The buttons are Accept (`.button.button-primary`), Reject and Refine (`:30-50`).
- `useRefine()` returns `{ target, setTarget }`, which starts as null (`src/ui/panel/refine.tsx:20-22`). `App` wraps `Shell` in `RefineProvider` inside `SelectionProvider` (`src/ui/App.tsx:15-19`).
- `api.ts`:
  - `agentSend` takes an optional third `proposalId` and leaves it out of the body when it is undefined (`src/ui/api.ts:90-101`).
  - `listProposals` and `decideProposal` are added (`api.ts:115-126`).
  - Check run: the route paths match the server: `src/server/agentRoutes.ts:48-49` (`/proposals`, `/proposals/:id/decision`), and `agentRoutes.ts:10` accepts `proposalId`.
- Check run: the `Counts` field names (`added`/`updated`/`deleted`) match `src/ui/board/ghosts.ts:44`.
- The styles match the brief. `.proposals-bar` is absolute with `bottom: 16px`, `left: 50%`, `translateX(-50%)`, the surface background, a border, a radius and a shadow. `.board` gets `position: relative` so the bar can sit inside it, and `.button-primary` is accent-filled (`src/ui/styles.css:139,178-188,368-399`).
- Tests match the brief:
  - Both files start with `// @vitest-environment jsdom`.
  - The row test checks both strings exactly, Accept on p_1, Reject on p_2 and Refine on p_2, and that `onDecide` was called exactly twice (`test/ui/ProposalsBar.test.tsx:15-37`).
  - The empty-list test is present (`:39-43`).
  - The refine test checks that the target starts null, can be set, and resets to null (`test/ui/refine.test.tsx:17-28`).
- The copy says "Claude", not "Claude Code".
- Cannot verify from the diff: how the bar looks and stacks against Excalidraw's own overlays (`z-index: 10`). The bar is not mounted in `BoardView` yet; the report says that is a later task, so this cannot be checked visually now.

### Strengths
- The changes are small and tightly scoped, with no new abstractions and no new dependencies.
- `refine.tsx` keeps the value and the setter in separate contexts, the same way `selection.tsx` does.
- The ` · ` separator is skipped when every count is zero, so the text never ends in a stray dot.
- The proposal id is URI-encoded in the decision URL.
- The tests drive real clicks through user-event, and each click is checked within its own row, so a button from the wrong row cannot make a test pass.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- `src/ui/api.ts:115-126`: the new `listProposals` and `decideProposal`, and the `proposalId` field in `agentSend`, have no tests. A wrong path or body shape would only surface once the UI calls them. The brief does not ask for these tests, and the server side is covered by the Task 4 route tests.
- `src/ui/panel/refine.tsx:8`: the setter context defaults to a no-op, so calling `useRefine` outside the provider silently does nothing. This copies the selection pattern, so it is consistent, but a missing provider would be hard to spot.
- `src/ui/styles.css:183-186`: `.button-primary:hover` uses `filter: brightness(0.92)`, which barely changes the button. The keyboard focus outline comes from `.button:focus-visible` and is unaffected, so this is a visual detail only. Check it once the bar is mounted.

### Assessment
Task quality: Approved
Reasoning: Everything the brief asks for is implemented exactly, the tests check the specified behavior, and the API paths match the server routes. The remaining items are minor and can wait for the task that mounts the bar.
