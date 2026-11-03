I've read the brief, the report and the diff, and checked the server's 404 and 409 paths. The task is approved with only minor issues; the report follows.

### Spec Compliance
- Spec compliant.
  - `applyProposalRequest` is a named function at `src/ui/board/BoardView.tsx:101`.
  - It renders every `add_diagram` and `add_note` into `rendered` before reading the scene (`:106-110`).
  - With `replace`, it rejects the old ghosts first (`:120`), then calls `applyProposal` with the current selection and the viewport (`:123-126`).
  - The scene update uses `restoreElements(..., { refreshDimensions: true, repairBindings: true })` (`:94-97`) and `CaptureUpdateAction.IMMEDIATELY` (`:131`).
  - `scrollToContent` with `{ animate: true, fitToViewport: false }` runs only when some touched element is outside the view (`:135-136`).
  - It returns `{ elementIds }` (`:137`).
- The apply branch refuses with `board <x> is not open` and `board <name> is still loading` (`:273-276`).
- The decide path follows the brief: local `decideProposal`, `restoreElements` and `updateScene` (`:386-391`), then `api.decideProposal`, with a 404 logged through `console.warn` and the local change kept (`:393-397`).
- The bar data matches the brief:
  - `pendingProposals` is recomputed in `onChange` and memoized on `getSceneVersion` (`:405-413`).
  - The titles are a `Map<string, string | null>` filled by apply requests (`:277`) and by `listProposals` on mount (`:260-269`).
  - `onRefine` calls `setTarget({ id, title })` (`:455`).
- There are three additions beyond the brief. All are justified:
  - `bumpVersion` inside `throughGhosts` (`:90-92`). I checked that `decideProposal` in `ghosts.ts:261-301` copies elements with spreads and never changes `version`. Without the bump, a reject would not change `getSceneVersion`, so `shouldSave` and the bar memo would miss it.
  - Clearing the refine target when that proposal is decided (`:392`).
  - Moving `.proposals-bar` to `bottom: 64px` (`src/ui/styles.css:371`). This fixes an overlap with Excalidraw's footer that the implementer saw in the browser.
- Cannot verify from the diff: the brief's manual step about the arrow turning red dashed. In the report's run, Claude deleted the two boxes instead of the arrow and said it had no id for the arrow. This suggests the board Markdown leaves out edge ids, which is a server-side gap outside this task. The update and delete ghost path for arrows is not checked end to end, so carry it into the final review.
- Cannot verify from the diff: the `pnpm check` and `pnpm build` results. The report shows them clean, with only the existing chunk-size warning, and I did not re-run them.

### Strengths
- Every Mermaid conversion is awaited before `getSceneElementsIncludingDeleted()` is called (`:106-115`). A conversion error therefore leaves the board untouched, and two apply requests at once cannot work from a stale scene.
- `throughGhosts` is one boundary for both apply and decide. It decides what to bump by object identity, so untouched elements keep their versions and are not saved again.
- `setPending` keeps the previous array when the list is unchanged (`:410-412`), so ordinary edits do not re-render the board.
- When titles from `listProposals` are merged in, titles already in state win (`:264-266`). A fresh apply title is not overwritten by a slower mount fetch.
- The report is thorough: three scenarios on a real login, a reload check, the 404 path, and a UI overlap found and fixed.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **A 409 leaves the board and the server out of sync** (`src/ui/board/BoardView.tsx:386-397`).
   - The server answers 409 (`ProposalBusyError`) while a revise is being drawn in the browser.
   - Scenario: the user clicks Accept during that window. The ghosts become real locally, and the 409 shows `Decision failed: …`, but the server still has the proposal pending.
   - The revise then arrives with `replace=true`. Its reject step finds no ghosts, because the accepted elements no longer carry the ghost data. New ghosts are added next to the accepted copies, so the content appears twice.
   - The window is short and the order (local first, then the server) is the brief's, so this is not blocking. A fix would be to undo the local change on 409, or to send to the server first for that case.
2. **The 404 is detected by matching message text** (`:395`).
   - `err.message.endsWith("is not pending")` depends on server strings at `src/server/agent/proposals.ts:106`, `src/server/agent/index.ts:177` and `src/server/agent/tools.ts:201`.
   - All three match today, including the unknown-id case.
   - `api.ts` should throw an error that carries the HTTP status. The report already names this.
3. **The `titles` map is never pruned** (`:260-278`). Decided proposals' titles stay in state for the whole session. The growth is small, but deleting the entry in `decide` would fix it.
4. **Undo is not synced with the server.**
   - Undo after a decision brings the ghosts back. Deciding again then hits the 404 path and only warns (the report notes this).
   - The reverse also happens: undo right after an apply removes the ghosts, but the server keeps the proposal pending, and `listProposals` still returns it.
   - Neither is in this task's brief, but both should be tracked for the final review.
5. **Apply ignores the disk-conflict state** (`:271-279`). Ghosts are drawn while the conflict banner is up and are saved only after "Keep mine". The brief does not require a check, but the behaviour is surprising.

### Assessment
Task quality: Approved
Reasoning: Every requirement in the brief is wired as specified, and the version bump beyond the brief is correct and needed for saves, undo and the bar to see the change. The remaining issues are a narrow 409 race, a brittle 404 text match and undo not syncing with the server, none of which blocks this task.
