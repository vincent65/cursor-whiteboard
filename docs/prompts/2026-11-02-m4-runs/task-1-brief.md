### Task 1: Run store and git helpers

**Files:**
- Create: `src/server/runs/store.ts`, `src/server/runs/git.ts`
- Modify: `src/server/agent/index.ts` (plan session id write goes through the store)
- Test: `test/server/runs/store.test.ts`, `test/server/runs/git.test.ts`

**Interfaces:**
- Produces in `src/server/runs/store.ts`:

```ts
export class RunStore {
  constructor(files: Pick<FileStore, "readSessions" | "writeSessions">);
  load(): Promise<SessionsFile>;                       // reads once; a corrupt file throws (the caller decides)
  runs(): RunRecord[];                                 // in-memory copy, newest last
  run(id: string): RunRecord | undefined;
  setPlanSession(sessionId: string): Promise<void>;    // updates plan.{sessionId, updatedAt}
  upsertRun(record: RunRecord): Promise<void>;
  patchRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord>;   // throws NotFoundError
  newRunId(): string;                                  // "run_" + 6 lowercase hex chars, unique among known runs
}
```

  Every write goes through one promise chain, so overlapping writers cannot lose an update.

- Produces in `src/server/runs/git.ts`:

```ts
export async function createWorktree(root: string, slug: string): Promise<{ worktree: string; branch: string }>;
   // runs `git worktree add <root>/.blueprint/worktrees/<slug> -b blueprint/<slug> HEAD`; throws Error("worktree <path> already exists") or Error("branch blueprint/<slug> already exists") before running git when either exists
export async function isAncestor(root: string, branch: string): Promise<boolean>;   // `git merge-base --is-ancestor <branch> HEAD`; false when the branch does not exist
export async function head(root: string): Promise<string>;
```

- `createAgent`'s `onSessionId` uses `RunStore.setPlanSession` (the store is built in `startServer` and passed in; the existing wiring test adapts).

- [ ] **Step 1: Write the failing tests**

```ts
// store.test.ts
test("writes are serialized: two overlapping patches both land", async () => {
  // upsertRun(a); upsertRun(b); await Promise.all([patchRun(a.id, { status: "done" }), patchRun(b.id, { costUsd: 1 })]);
  // readSessions() shows both patches; plan untouched
});
test("setPlanSession preserves runs and newRunId never repeats", ...);
// git.test.ts, on a temp repo with one commit
test("createWorktree makes the branch and directory from HEAD and refuses a second time", async () => {
  const { worktree, branch } = await createWorktree(repo, "auth");
  expect(branch).toBe("blueprint/auth"); expect(existsSync(join(worktree, ".git"))).toBe(true);
  await expect(createWorktree(repo, "auth")).rejects.toThrow("already exists");
});
test("isAncestor is false for a missing branch, true after merging it", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/runs`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

Use `execFile("git", [...], { cwd: root })` from `node:child_process` promisified; never `exec` with a shell.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/server/runs/store.ts src/server/runs/git.ts src/server/agent/index.ts test/server/runs test/server/agentRoutes.test.ts
git commit -m "feat(runs): serialized run store and git worktree helpers"
```

---

