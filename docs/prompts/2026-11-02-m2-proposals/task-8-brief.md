### Task 8: Board integration

**Files:**
- Modify: `src/ui/board/BoardView.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5, 6, and 7; `useRefine`; `CaptureUpdateAction`, `restoreElements`, `ExcalidrawImperativeAPI.updateScene`, `scrollToContent`.
- Produces: `BoardView` answers `proposal.apply` requests and renders `ProposalsBar`.

  Applying a request: refuse when `proposal.board !== name` (`board <x> is not open`) or the scene is still loading; for each `add_diagram` op `await renderMermaid(op.mermaid)` and for each `add_note` op `renderNote(op.text)` into the `rendered` map, so every conversion error happens before any mutation; then `elements = ex.getSceneElementsIncludingDeleted()`, with `replace` first `decideProposal(elements, id, "rejected")`; `applyProposal(...)` with the current selection ids and the viewport from `appState`; run the result through `restoreElements(next, null, { refreshDimensions: true, repairBindings: true })` so changed labels are re-measured; `ex.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY })`; `ex.scrollToContent(touched, { animate: true, fitToViewport: false })` only when some touched element lies outside the viewport; respond `{ elementIds }`.

  Deciding: `decideProposal` + `restoreElements` + `updateScene` as above, then `api.decideProposal(id, decision)`; a 404 (the server lost the record) is logged with `console.warn` and the local change stands.

  The bar's items come from `pendingProposals(latest.current.elements)` recomputed in `onChange` (memoized on scene version), with titles from a `Map<string, string | null>` filled by apply requests and by `api.listProposals()` on mount. `onRefine(id)` calls `setTarget({ id, title })`.

- [ ] **Step 1: Implement the wiring**

No new unit test: `BoardView` is not rendered in jsdom (Excalidraw needs a real canvas) and its logic lives in Tasks 5 to 7. Keep the request handling in a named `applyProposalRequest` function inside the file for readability.

- [ ] **Step 2: Build and verify by hand**

Run: `pnpm check && pnpm build && pnpm dev`
Then, with your real login and a board with two labeled boxes joined by an arrow: select all three and ask `Add a cache between these two`. Expected: a `proposing N changes` row, the arrow turns red dashed, a dashed diagram appears 80 pixels to the right of the selection, the bar reads `Claude proposed ... · 2 added, 1 removed` (counts as Claude chose), `Reject` restores the arrow and removes the ghosts, and `proposals.jsonl` has `proposed` and `rejected` lines. Then ask `Draw the login flow as a flowchart` with nothing selected: ghosts land right of all content; `Accept` makes them solid; reload the page before accepting another one to confirm the bar is rebuilt from the scene. Record every observation in the report.

- [ ] **Step 3: Commit**

```bash
git add src/ui/board/BoardView.tsx
git commit -m "feat(ui): the board applies proposals as ghosts and decides them"
```

---

