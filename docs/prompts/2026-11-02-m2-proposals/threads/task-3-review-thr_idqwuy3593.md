### Spec Compliance
- **Spec compliant.** All three files the brief lists were changed. `ServerMessage` has the `proposal.apply` request variant (`src/shared/messages.ts:453-459`).
- `createBoardTools` registers four tools (`src/server/agent/tools.ts:423`).
- `propose` follows the brief's steps in order (`tools.ts:378-391`):
  - it requires an open board;
  - it checks ids against the non-deleted elements of the stored board;
  - it mints an id and uses `title ?? null`;
  - it sends the `apply` request with `replace: false` and a 30-second timeout;
  - only after the browser answers does it log the proposal and return the proposal id.
- `revise` reuses the pending record's `id`, `board` and `title`, sends `replace: true`, and logs `revised` only after the browser answers (`tools.ts:398-417`). An unknown id gives `NotFoundError("proposal <id> is not pending")`.
- `get_board` and `get_selection` drop elements with `customData.ghost === "add"` and add the "Pending proposals" line (`tools.ts:262-287`, `324`, `349`, `367`).
- `summarizeTool` returns the singular and plural "proposing" texts and the "revising" text (`src/server/agent/events.ts:127-132`).
- Every test the brief lists exists and asserts what the brief asks:
  - `tools.test.ts:658`, `681`, `702`, `712`, `760`, `771`;
  - `events.test.ts:480`.
- One deviation, accepted: fixtures use board `flow`/`ghosted` instead of `main`. The assertions are the same.
- One reordering, accepted: `revise` looks up the pending record and checks its board before it validates ids (`tools.ts:400-408`). The brief lists id validation first. The record decides which board the ids must be on, so this order is correct. The only visible effect is which error wins when two apply.
- Extra, justified: `revise` refuses a proposal whose board is not the open one (`tools.ts:404-407`). This stops ghosts from being redrawn on the wrong board. The report cites a Task 2 review ruling, which I could not see.
- Extra, needed: a change to `src/server/agent/index.ts:181-188`, a file outside the brief's list. Without it, the required `proposals` dependency breaks typecheck. The report says so openly. It also updates the `canUseTool` comment to match what the tools now do (`index.ts:199-201`).
- **Cannot verify from diff:**
  - The report's `pnpm check` and `pnpm build` results. I did not re-run them. The TDD evidence in the report is complete and shows no stray stderr or warnings.
  - The Task 2 review ruling the `revise` board check cites.
  - The browser side of `proposal.apply`, which lands in Task 8.

### Strengths
- **Write order is right.** The browser draws first and the log is written second (`tools.ts:388-389`, `414-415`). So a Mermaid parse error, or any other browser rejection, leaves no record. A test covers this for `propose` (`tools.test.ts:702`) and for `revise` keeping its old ops (`tools.test.ts:749`).
- **Tests use a real store.** They run a real `ProposalStore` backed by an in-memory log (`tools.test.ts:594-600`). They assert on the log entries, not on mocks.
- **Edge cases go beyond the brief:**
  - ids of deleted elements (`:671`);
  - a missing title becoming `null` (`:696-699`);
  - the 30-second timeout value (`:692`);
  - no pending line when nothing is pending (`:773-778`);
  - `revise` also failing fast with no open board (`:765`).
- **Small, clear helpers.** `openBoard`, `checkIds`, `apply` and `answer` remove repetition between the two tools without adding an abstraction.
- **Using `Propose.shape` is safe.** I checked `src/shared/proposals.ts:26-33` for the risk that `.shape` drops object-level refinements. Both schemas are plain `z.object`, and `.min(1)` sits on the field, so nothing is lost.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **`index.ts` builds an empty proposal store** (`src/server/agent/index.ts:181-186`).
   - It calls `new ProposalStore(store)` without `load()`.
   - Until Task 4 lands, a server restart forgets pending proposals.
   - `newId`'s set of used ids (`seen`) is also empty, so a new id could in principle match one from an earlier session. With 32 random bits this is very unlikely.
   - The code has a `ponytail:` comment and the report flags it, so this is fine as a temporary state. Task 4 must replace it with the loaded store.
2. **Ghosts can be left behind with no record** (`tools.ts:388-389`, `414-415`).
   - If the browser draws the ghosts but its answer comes after the 30-second timeout, the tool fails and nothing is logged. The same happens if appending to the log fails after the draw.
   - Either way, ghosts carrying a `proposalId` stay on the board with no pending record.
   - The brief mandates this order. Task 8 or later should clean up ghosts whose proposal is not pending.
3. **A decision during a revise round trip** (`tools.ts:414-415` with `proposals.ts` `revised` → `pendingOrThrow`).
   - If the user accepts or rejects the proposal while `revise` waits for the browser, the browser has already redrawn the ghosts.
   - `revised()` then throws "not pending", leaving redrawn ghosts for a proposal that is already decided.
   - The window is small, and the accept/reject routes arrive in Task 4. Worth handling there.
4. **Ghost ids pass id validation** (`tools.ts:294-301`).
   - `checkIds` counts add ghosts as valid ids, even though both board reads hide them.
   - Claude can still learn ghost ids by reading the `.excalidraw` file with `Read`, because the guard only blocks writes.
   - An op could then target another proposal's ghost, or the proposal's own ghosts that `replace: true` is about to delete.
   - Leaving add ghosts out of `live` would match what the board reads show.
5. **The pending line lists every board's proposals** (`tools.ts:280-287`).
   - It does not filter by the board being read, and it does not name the board.
   - The brief literally says "when `proposals.pending()` is not empty", so this follows the plan. Naming each proposal's board would avoid misleading Claude.
6. **A test leaks a fixture if it fails** (`test/server/agent/tools.test.ts:672-678`).
   - It changes the module-level `boards` map and removes `boards.gone` only on success.
   - A failed assertion leaves the fixture in place for later tests. A `try/finally`, or a fixture built up front like `ghosted`, would avoid this.
7. **No guard for a missing `proposalId`** (`events.ts:132`).
   - If `proposalId` is missing, the summary reads `revising undefined`.
   - This matches how the `Edit` and `Write` cases already handle missing input, so it is consistent, just unguarded.

### Assessment
Task quality: Approved

Reasoning: The task meets the brief. The extras are justified and stated openly, and the tests check real store and log behavior. The remaining items are later-task concerns (restoring the store, orphan ghosts, the revise/decide race) and small test or text polish.
