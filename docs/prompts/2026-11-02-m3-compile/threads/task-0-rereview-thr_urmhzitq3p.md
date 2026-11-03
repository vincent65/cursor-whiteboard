All four findings are addressed, and the fix adds no new Critical or Important problems.

### Finding Verdicts

**1. (Important) The server alone owns the reconcile, with two strikes: ADDRESSED.**
- `src/server/agent/proposals.ts` adds `REMOVAL_GRACE_MS = 3_000` and the `missingSince` map (diff lines 161-179).
- In `reconcile` (diff 222-242):
  - Ghosts present clears the mark.
  - A proposal being revised, or younger than `RECONCILE_GRACE_MS`, is skipped.
  - The first miss marks the proposal; a miss at least 3 s after the mark rejects it.
- `apply()` clears the mark on every new log entry, so revisions and decisions clear it (diff 264-268).
- `src/server/agent/tools.ts` adds a `read()` helper that reconciles first (diff 316-320).
  - `get_board`, `get_selection`, `propose` and `revise` all use it before they read the pending list.
  - `revise` reconciles before it looks the proposal up (diff 449).
  - `revise` still reads the board a second time inside the `beginRevise` bracket for the id check (diff 464).
- `src/ui/board/BoardView.tsx` no longer has `reconcileDrop`, the `drops` and `seen` refs, `decidingNow`, or `droppedProposals` (diff 591-602 and 640-674).
- `droppedProposals` and its test are deleted from `src/ui/board/ghosts.ts` and `test/ui/ghosts.test.ts`. Nothing else uses it.
- Each test the ruling asked for exists:
  - **First miss marks and keeps it pending, rejected 3 s later:** `test/server/agent/proposals.test.ts` (diff 754-758), and at the route level in `test/server/routes.test.ts` (diff 1066-1074).
  - **A check 1 s later keeps it, and ghosts back before the grace clears the mark:** the removal-grace test (diff 784-803). It also checks both sides of the 3 s boundary.
  - **A revision clears the mark:** diff 805-815.
  - **A tool read past the grace rejects it:** `test/server/agent/tools.test.ts` covers all four tools (diff 947-982).

**2. (Minor) A failing append inside the route's reconcile: ADDRESSED.**
- The new test is in `test/server/routes.test.ts` (diff 1081-1096).
- `appendProposal` throws "disk full", and the second save, 3 s later, returns 200 with the saved board.
- The test checks that `console.warn` is called with the message from `src/server/routes.ts:57`.
- The store is rebuilt in `beforeEach` (`routes.test.ts:17-19`), so the spy cannot leak into other tests.

**3. (Minor) The route test depends on today's clock: ADDRESSED.**
- The fixture `at` is `2020-01-01T00:00:00.000Z` (diff 1002).
- The agent's clock is injected through the new `createAgent({ clock })` (diff 120-135 and 1018-1034).

**4. (Minor) `createApp` takes the store twice: ADDRESSED.**
- `src/server/app.ts:50` is now `createApp(store, agent?)`, and it passes `agent?.proposals` to `routes`.
- `src/server/index.ts:36` and every test caller use the two-argument form.

The report names the covering tests and shows the RED/GREEN output (132 server tests passed, `pnpm check` 240 passed). Those claims match the diff, and I did not re-run anything.

### New Breakage in the Fix Diff

None at Critical or Important. Two Minor issues:
- **Minor, `src/server/agent/tools.ts:316-320`:** a failed log append inside a tool's reconcile now fails `get_board`, `get_selection`, `propose` or `revise`. The save route only logs a warning in the same case. The report says this was deliberate. Wrapping the reconcile in `read()` the same way the route does would stop a log problem from blocking a read-only tool.
- **Minor, `get_selection` (diff 389-391):** it now reads the board file even when nothing is selected. If the open board's file is missing on disk, the tool throws "not found" where it used to reply "Nothing is selected". This is unlikely in practice.

### Out-of-Scope Observations

- With the browser timer gone, removing ghosts and then making no further edit leaves the proposal pending until the next tool read or compile reads the board. The browser's list was already correct, and the report notes this. It fits the ruling.
- `test/server/agentRoutes.test.ts` now runs the reconcile on any board save, using the real clock. No test depends on that today.

### Verdict

**Fix round passes:** all four findings are addressed, with no new Critical or Important problems.
