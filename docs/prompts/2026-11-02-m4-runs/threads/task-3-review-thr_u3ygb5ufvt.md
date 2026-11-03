### Spec Compliance
- Spec compliant, with accepted deviations. Every API member in the brief exists with the brief's signatures.
  - `LaunchOptions`, `RunView`, the constructor deps, `start`, `launch`, `message`, `stop`, `resume`, `answerPermission`, `list`, `transcript` and `close` are all present.
  - The three `ServerMessage` variants are in `src/shared/messages.ts:24-27`.
  - Status derivation matches the brief at `src/server/runs/manager.ts:294-328`.
  - Session options match: preset `systemPrompt` with no append, the launch's `permissionMode`, the `PreToolUse` guard, no `mcpServers`, and `canUseTool` from the broker (`manager.ts:236-255`).
- All six tests the brief names exist under its exact names, and each asserts what the brief describes (`test/server/runs/manager.test.ts:132-533`). The fix rounds added two more tests.
- Accepted deviations (from the rulings recorded in the report):
  - Cost is the process cost added to what the run had already spent.
  - `ExistsError` is thrown for a non-interrupted resume.
  - `RunRecord.permissionMode` is persisted.
  - The board-guard deny reason is now a parameter.
- Extra, but justified: `test/server/agent/fakeSdk.ts` is the extraction the brief asks for. `RunPermissionMode` and the `files.ts` schema default come from the fix-round ruling.
- Cannot verify from the diff alone:
  - The cost model assumes the SDK's `total_cost_usd` is cumulative for the life of one streaming `query`. The fake always reports `0.01`, so no test covers two turns in one process. If the value is per turn, cost under-counts.
  - I checked the other risk in `src/server/agent/session.ts:241`: `"starting"` fires only when a new process starts, not on every send. So `costBase` does not double-count across turns.

### Strengths
- The tests use a real `FileStore` and `RunStore` on a temp dir. The fake sits only at the SDK and git boundary.
- The `saved()` helper (`manager.test.ts:109-121`) checks that the in-memory record and the disk record agree once every write lands. That is a real consistency check, not a mock assertion.
- The in-memory `live.record` running ahead of serialized store writes (`manager.ts:38-52`, `:330-336`) avoids reading half-written records. The same record is what the re-check in `resume` (`:149`) relies on.
- The test for concurrent `resume` calls really exercises the race the re-check guards.
- The deny reason for runs is right: the old message pointed at a propose tool that runs do not have.
- Mutation checks are reported for every fix-round change. They partly make up for the fix round being written implementation-first.
- `close()` leaves records alone so the next `start()` reads them as interrupted. `start()` stays quiet when nothing changed.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **`message()` sends bare text to a session that has nothing to resume** (`src/server/runs/manager.ts:125-127`). Ruling 4 fixed this case for `resume()` only (`:139-151`).
   - Scenario A: a run whose CLI failed before init has `sessionId: ""` and status `failed`. The user types "try again" in the sessions view. `#liveFor` → `session.send("try again")` → a fresh Claude session in the worktree that knows nothing about its task.
   - Scenario B: `start()` → `restore()` drops an unreadable saved id (`session.ts:170`). Then a message to a `done` run starts fresh with no task.
   - The brief makes messaging done or failed runs a primary flow.
   - Fix: when `live.session.sessionId` is unset, send `runPrompt(...)` followed by the user's text. Reuse `#promptInput`, the same way `resume` does.
2. **The board guard covers only the worktree's copy of the board** (`manager.ts:248`, `denyBoardWrites(record.worktree, …)`). This is plan-mandated: the brief says `denyBoardWrites(worktree)`.
   - The worktree lives at `<root>/.blueprint/worktrees/<slug>`.
   - A `Write` to `../../boards/main.excalidraw.json` resolves to `<root>/.blueprint/boards/...`, which is the live board the server watches. An absolute path to the same file also gets through.
   - `isProtectedPath(worktree, …)` checks only `<worktree>/.blueprint/{boards,assets}`, so neither path is denied.
   - Fix: deny when the path is protected under either `root` or the worktree.

#### Minor (Nice to Have)
1. **A failed process's spend is lost.**
   - `events.ts:162-164` maps an error result to an `error` event, so the `result` branch at `manager.ts:258-263` never sees its cost.
   - When the session reaches `error`, the next send starts a new process (`session.ts:186-187`). `costBase` then snapshots a total that never included the failed process.
   - Failed runs therefore under-report cost, which works against the stated purpose of the cost deviation.
   - The error test checks status and `endedAt` after the failure, but not cost.
2. **No test pins the cost of a multi-turn process.** Add a fake whose `total_cost_usd` grows across turns in one `query`, and assert the record equals the last total, not the sum.
3. **`INTERRUPTED` names a deny message, not a status** (`manager.ts:23`). It sits beside `RunStatus` `"interrupted"` and is easy to misread; `INTERRUPTED_REASON` would be clearer.
4. **`onEvent` ignores `#closing`** (`manager.ts:255-265`), unlike `onStatus` and the broker. A `result` arriving during `close()` still patches cost and broadcasts. This is harmless today but inconsistent.
5. **`start()` restores every run's transcript up front** (`manager.ts:89-95`). The implementer flagged this too; loading lazily in `transcript()` is the upgrade.

### Assessment
Task quality: Needs fixes

Reasoning: The manager is well-structured and well-tested against real stores and matches the brief. But `message()` repeats the no-session-to-resume defect that the ruling fixed only in `resume()`. The plan-mandated board guard also leaves the live board writable through `../../boards`.
