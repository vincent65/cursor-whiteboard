# Task 7 report: proposals toolbar, refine context, API client

Status: DONE
Commit: `fab1e18 feat(ui): proposals toolbar, refine context, and proposal API calls`

## What I implemented

- `src/ui/board/ProposalsBar.tsx`: `ProposalsBar({ items, onDecide, onRefine })`.
  It returns `null` when `items` is empty.
  It renders one `.proposals-row` per item with the text `Claude proposed <title or "changes"> · <parts>`, where the parts are the non-zero counts (`N added`, `N changed`, `N removed`) joined by `, `.
  Then come the `Accept` (`.button.button-primary`), `Reject`, and `Refine` buttons.
  If every count is zero, the ` · ` separator is left out so the text does not end in a dangling dot.
- `src/ui/panel/refine.tsx`: `RefineProvider` and `useRefine()`, which returns `{ target, setTarget }`.
  Like `selection.tsx`, the value and the setter are in two separate contexts.
- `src/ui/api.ts`:
  - `agentSend(text, selection?, proposalId?)` now accepts an optional `proposalId`, and leaves it out of the body when it is undefined, so the existing two-argument callers still work.
  - `listProposals()` calls `GET /api/agent/proposals`.
  - `decideProposal(id, decision)` calls `POST /api/agent/proposals/:id/decision` with `{ decision }`, and the id is URI-encoded.
- `src/ui/App.tsx`: `RefineProvider` wraps `Shell` inside `SelectionProvider`.
- `src/ui/styles.css`:
  - `.board` is now `position: relative`.
  - `.button-primary` is an accent-filled button that darkens with a brightness filter on hover.
  - `.proposals-bar` is absolute: `bottom: 16px`, `left: 50%`, `translateX(-50%)`, the surface background, a border, an 8px radius, a shadow, `z-index: 10`, and a max-width so it stays inside the board.
  - `.proposals-row` is a flex row, and long titles in `.proposals-text` are cut off with an ellipsis.

## TDD evidence

RED: `pnpm vitest run test/ui/ProposalsBar.test.tsx test/ui/refine.test.tsx`

```
 FAIL  test/ui/ProposalsBar.test.tsx
Error: Failed to resolve import "../../src/ui/board/ProposalsBar" from "test/ui/ProposalsBar.test.tsx". Does the file exist?
 FAIL  test/ui/refine.test.tsx
Error: Failed to resolve import "../../src/ui/panel/refine" from "test/ui/refine.test.tsx". Does the file exist?
 Test Files  2 failed (2)
```

GREEN: the same command gave `Test Files 2 passed (2), Tests 3 passed (3)`.
`pnpm vitest run test/ui` passed.
`pnpm check`: both typechecks were clean, Biome reported `Checked 93 files ... No fixes applied.`, and Vitest gave `Test Files 33 passed (33), Tests 197 passed (197)`.
`pnpm build`: the only warning was the existing chunk-size warning.

## Manual observations

The brief does not ask for any manual check.
The bar is not mounted anywhere yet (BoardView wiring belongs to a later task), so there was nothing to look at in the running app.
Its look should be checked once it is mounted.

## Files changed

- Created: `src/ui/board/ProposalsBar.tsx`, `src/ui/panel/refine.tsx`, `test/ui/ProposalsBar.test.tsx`, `test/ui/refine.test.tsx`
- Modified: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/styles.css`

## Self-review

- Only the files the brief lists were changed, and no dependencies were added.
- The copy says "Claude", not "Claude Code".
- Both new test files start with `// @vitest-environment jsdom`.
- `useRefine` reads both contexts, so its consumers re-render when the target changes.
  The brief asks for that combined shape.
  The setter context is still kept separate, in case a later setter-only hook is wanted.
- I did not add unit tests for the new `api.ts` functions, because the brief does not ask for them.
  The server routes they call already have tests from Task 4.

## Concerns

- `z-index: 10` on the bar is not yet checked against Excalidraw's own overlay layers.
  Check it visually when the bar is mounted in BoardView.
