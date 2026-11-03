### Task 3: The run manager

**Files:**
- Create: `src/server/runs/manager.ts`
- Modify: `src/shared/messages.ts`
- Test: `test/server/runs/manager.test.ts`

**Interfaces:**
- Consumes: `RunStore`, `createWorktree` (Task 1), `runPrompt`, `prUrlIn` (Task 2), `PlanSession`, `PermissionBroker`, `denyBoardWrites`, `FileStore.listTasks/readSpec`, `WsHub.broadcast`.
- Produces in `src/shared/messages.ts`, added to `ServerMessage`:

```ts
| { type: "run.event"; runId: string; event: PanelEvent }
| { type: "run.status"; runId: string; status: RunStatus; message?: string }
| { type: "runs.changed" }   // a record was added or patched; clients refetch GET /api/runs
```

- Produces in `src/server/runs/manager.ts`:

```ts
export type LaunchOptions = { taskSlug: string; permissionMode: "acceptEdits" | "default" | "bypassPermissions" };
export type RunView = RunRecord & { pending: PendingPermission[]; lastText: string | null };
export class RunManager {
  constructor(deps: { store: FileStore; runs: RunStore; hub: WsHub; root: string; sdk: Pick<typeof claudeSdk, "query" | "getSessionMessages">; git?: { createWorktree: typeof createWorktree } });
  start(): Promise<void>;                                   // marks records that were working or needs_you as interrupted and broadcasts runs.changed
  launch(opts: LaunchOptions): Promise<RunRecord>;          // throws NotFoundError for an unknown task; creates the worktree, the record (status working), starts the session, sends the run prompt
  message(runId: string, text: string): Promise<string>;    // throws NotFoundError; a done or failed run accepts it (the session resumes)
  stop(runId: string): Promise<void>;                        // cancels asks, interrupts; status follows the session
  resume(runId: string): Promise<void>;                      // only for interrupted runs: starts a session with resume in the worktree and sends the continue message
  answerPermission(runId: string, id: string, d: PermissionDecision): boolean;
  list(): RunView[];
  transcript(runId: string): PanelEvent[];
  close(): Promise<void>;                                    // closes every session; records keep their last status (they read interrupted on the next start)
}
```

  Status derivation per run: session `starting`/`working` → `working`; broker pending → `needs_you`; session `idle` → `done` if the last assistant text of the turn had a PR URL (also sets `prUrl`, `endedAt`), else `idle`; session `error` → `failed` with the message, `endedAt`; session `stopped` → `idle`. Each `result` event updates `costUsd` from the event. Every derived change patches the record and broadcasts `run.status`; every event broadcasts `run.event` with the run id. Run sessions use `systemPrompt: { type: "preset", preset: "claude_code" }` with no append, `permissionMode` from the launch, `hooks` with `denyBoardWrites(worktree)`, no `mcpServers`, and the broker's `canUseTool`.

- [ ] **Step 1: Write the failing tests**

```ts
// with a fake sdk whose query scripts turns (reuse the fake from test/server/agent/session.test.ts by extracting it to test/server/agent/fakeSdk.ts) and a fake git that records createWorktree calls
test("launch creates a worktree, a working record, and sends the run prompt", ...);
test("a turn ending with a PR URL makes the run done with prUrl and cost; without one it is idle", ...);
test("an error result fails the run with the message", ...);
test("permission asks mark the run needs_you and stop cancels them", ...);
test("events and statuses carry the run id for two concurrent runs", ...);
test("start marks active records interrupted and resume continues the saved session id in the worktree", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/runs/manager.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/server/runs/manager.ts src/shared/messages.ts test/server/runs/manager.test.ts test/server/agent/fakeSdk.ts test/server/agent/session.test.ts
git commit -m "feat(runs): the run manager drives one session per task in its worktree"
```

---

