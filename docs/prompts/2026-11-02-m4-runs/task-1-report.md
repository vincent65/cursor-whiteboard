# Task 1 report: Run store and git helpers

Status: DONE_WITH_CONCERNS (two small deviations from the file list and wording, explained below).

Commit: `dce9eed feat(runs): serialized run store and git worktree helpers`

## What I implemented

### `src/server/runs/store.ts` - `RunStore`
- Keeps `sessions.json` in memory and rewrites the whole file on every change.
- Every write (`setPlanSession`, `upsertRun`, `patchRun`) goes through one promise chain (`write()`, modeled on `ProposalStore.serial`).
- Each write computes the next state from the state the previous write left, so overlapping writers cannot lose an update.
- Memory moves to the next state only after `writeSessions` succeeds, so a failed write leaves memory equal to what is on disk.
- A failed write does not break the chain.
- `load()` reads once and returns a copy; a corrupt file throws and the store stays empty, so the first write replaces the corrupt file (same behavior as milestone 1).
- `runs()` / `run()` return copies, newest last; `upsertRun` replaces an existing id in place or appends.
- `patchRun` throws `NotFoundError` inside the chain before writing; the `id` cannot be changed by a patch.
- `newRunId()` returns `run_` + `randomBytes(3)` hex (6 lowercase hex chars), retrying while the id is in the known runs or was already issued by this store.

### `src/server/runs/git.ts`
- `git()` = promisified `execFile("git", args, { cwd: root })`, no shell.
- `createWorktree(root, slug)`: `assertSlug(slug)` first (guards path traversal and option-like names), then refuses with `Error("worktree <path> already exists")` when `access(path)` succeeds, or `Error("branch blueprint/<slug> already exists")` when `git show-ref --verify --quiet refs/heads/blueprint/<slug>` succeeds; then runs `git worktree add <root>/.blueprint/worktrees/<slug> -b blueprint/<slug> HEAD`.
- `isAncestor(root, branch)`: false when the branch does not exist (show-ref); otherwise `git merge-base --is-ancestor <branch> HEAD`, where exit 1 is false and any other failure is rethrown.
- `head(root)`: `git rev-parse HEAD`, trimmed.

### Wiring
- `createAgent` takes a required `runs: RunStore`; it calls `runs.load()` in place of `store.readSessions()` (load errors still become the agent's startup error and it starts empty).
- `onSessionId` calls `runs.setPlanSession(sessionId)`; the old unserialized read-modify-write and its `ponytail:` note are gone.
- `startServer` constructs `new RunStore(store)` and passes it in.

## TDD evidence

RED: `pnpm vitest run test/server/runs`
```
 FAIL  test/server/runs/store.test.ts [ test/server/runs/store.test.ts ]
Error: Cannot find module '../../../src/server/runs/store.js' imported from .../test/server/runs/store.test.ts
 Test Files  2 failed (2)
      Tests  no tests
```

GREEN: `pnpm vitest run test/server/runs`
```
 Test Files  2 passed (2)
      Tests  5 passed (5)
```

Wiring test proof: with `src/server/agent/index.ts` stashed back to the old version, the extended resume test fails:
```
 × createAgent resumes the saved plan session and composes the selection header
      Tests  1 failed | 21 passed (22)
```
With the change restored it passes (22/22).

`pnpm check` (tsc x2, biome, vitest):
```
Checked 112 files in 55ms. No fixes applied.
 Test Files  43 passed (43)
      Tests  299 passed (299)
```
No stderr, warnings, or errors in the vitest output.

## Tests added
- `store.test.ts`: overlapping `patchRun`s both land and the plan stays untouched; upsert replaces in place; an unknown `patchRun` throws `NotFoundError` and writes nothing; handed-out records are copies; `setPlanSession` keeps runs; 5000 `newRunId`s all match `^run_[0-9a-f]{6}$`, are unique, and avoid known ids (about half of runs exercise the retry); a failed write leaves memory unchanged.
- `git.test.ts` (temp repo, `git init -q`, local `user.name`/`user.email`, `commit.gpgsign false`, one commit): worktree path, branch name, `.git` present, worktree `HEAD` equals repo `HEAD`; second call refuses on the worktree; after deleting the worktree and pruning it, refuses on the branch alone; `../escape` is rejected as an invalid name. `isAncestor` is false for a missing branch, true for the fresh branch, false after a commit on it, true after merging it.
- `agentRoutes.test.ts`: the resume test now saves a run alongside the plan, spies on `setPlanSession`, and checks that the new plan id `s1` lands while the run survives on disk and in memory.

## Manual verification
The brief names none beyond `pnpm check`.

## Files changed
- Created: `src/server/runs/store.ts`, `src/server/runs/git.ts`, `test/server/runs/store.test.ts`, `test/server/runs/git.test.ts`
- Modified: `src/server/agent/index.ts`, `src/server/index.ts`, `test/server/agentRoutes.test.ts`, `test/server/routes.test.ts`

## Self-review findings
- The `patchRun` result uses a `patched as RunRecord` cast after the write; it is always set when the write resolves (the callback throws otherwise). That is acceptable.
- `issued` grows by one id per `newRunId` call for the life of the process. This is negligible.
- In-memory state is now authoritative. A hand edit to `sessions.json` while the server runs is overwritten by the next write. Before, the plan-id write re-read the file first. This is required for serialization to mean anything, and the server already owns the file.

## Concerns / deviations
1. **Two files outside the brief's list.** `src/server/index.ts` needed to construct the store, which is what the brief asks for in prose. `test/server/routes.test.ts` has one `createAgent` call that needed the new required `runs` dependency. I kept `runs` required rather than adding a default, because a silently created second `RunStore` would defeat the serialization. Both files are in the commit.
2. **Where `load()` runs.** The resolution says the store is "loaded once in `startServer`". `createAgent` needs `load()`'s returned plan to resume, and it must report a load failure as its startup error. So `createAgent` calls `runs.load()`, and `startServer` calls `createAgent` exactly once. The store is still built in `startServer` and shared from there. If later tasks build a run manager before `createAgent`, they should rely on this ordering or move the load.
3. `assertSlug` in `createWorktree` is an addition the brief did not name. It rejects anything other than `^[a-z0-9][a-z0-9-]*$` before touching the filesystem or git.
