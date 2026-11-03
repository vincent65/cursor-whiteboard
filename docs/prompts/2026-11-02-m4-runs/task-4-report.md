# Task 4 report: Gating, run routes, and server wiring

Status: DONE_WITH_CONCERNS (one signature deviation, explained below).
Commit: `23909ed feat(server): dependency gate, run routes, and run manager wiring`

## What I implemented

- `src/server/runs/gate.ts`
  - `GateResult` and `checkGate({ task, runs, isAncestor })`, matching the brief.
  - Each `dependsOn` slug is judged by its newest run (the last record for that slug, since `RunStore` appends new runs).
  - Reasons: no run gives `"no run"`, a status other than `done` gives `"not done"`, and a done run whose branch is not an ancestor of `HEAD` gives `"not merged"`.
  - `isAncestor` is called only for `done` runs.
  - `GateError` (message `"dependencies are not merged"`, carries `missing`).
- `src/server/runRoutes.ts`, mounted at `/api/runs`:
  - `GET /` returns `manager.list()`.
  - `GET /gate/:slug` returns the `GateResult`, or 404 for an unknown task.
  - `POST /` takes `{ taskSlug, permissionMode, override? }` (Zod).
    It returns 400 for a bad body, 404 for an unknown task, and 409 `{ error, missing }` when the gate fails and `override` is not true.
    Otherwise it returns 201 with the `RunRecord`.
    `override: true` skips the gate entirely, and `launch` still 404s an unknown task.
  - `POST /:id/message { text }` returns 202 `{ id }`, 400 for empty text, and 404 for an unknown run.
  - `POST /:id/stop` returns 204.
  - `POST /:id/resume` returns 204, or 409 through the manager's `ExistsError` when the run is not interrupted.
  - `POST /:id/permission { id, behavior, message? }` returns 204, 404 when the ask is unknown, and 400 for a bad body.
  - `GET /:id/transcript` returns `PanelEvent[]`.
  - Unknown runs return 404 through `NotFoundError`.
  - The gate's dependency runs come from `manager.list()`, whose live records are ahead of the store.
- `src/server/app.ts`
  - `createApp(store, agent?, runs?)` mounts the run routes when `runs` is given.
  - `statusFor` maps `GateError` to 409.
  - `onError` adds `missing` to the body for a `GateError`, so the route has no local try/catch.
- `src/server/index.ts`
  - The `RunStore` is now one variable, shared by `createAgent` (which loads it and keeps the milestone 1 corrupt-file handling: the agent reports the error and runs start empty) and the new `RunManager`.
  - It builds `RunManager` with the real SDK and calls `start()`.
  - It passes `{ manager, isAncestor: (b) => isAncestor(opts.root, b) }` to `createApp`.
  - `close()` closes the agent and the manager together, inside the existing try/finally.

### Deviation: the shape of `createApp`'s third parameter

The brief and the controller say `runs?: RunManager`.
The gate needs `isAncestor`, which needs the repository root.
`FileStore.root` is private, and `RunManager` (Task 3) does not expose its root or a gate method.
Neither file is on this task's list.
So the third parameter is `runs?: RunRouteDeps = { manager: RunManager; isAncestor(branch): Promise<boolean> }`.
This also lets route tests inject a fake `isAncestor`.
If you want the exact `runs?: RunManager` signature, there are two options:
- expose `readonly root` on `FileStore`;
- or give `RunManager` an `isAncestor`/`gate` method.
Either option is a small follow-up outside this task's file list.

### patchRun and undefined values

This task builds no `patchRun` patches.
The routes only call manager methods, so I left `patchRun` unchanged.

## TDD evidence

RED (`pnpm vitest run test/server/runs/gate.test.ts test/server/runRoutes.test.ts`, before any implementation):

```
 FAIL  test/server/runs/gate.test.ts [ test/server/runs/gate.test.ts ]
Error: Cannot find module '../../../src/server/runs/gate.js' imported from .../test/server/runs/gate.test.ts
 FAIL  test/server/runRoutes.test.ts > POST /api/runs refuses a gated task without override and launches with it
AssertionError: expected 404 to be 200 // Object.is equality
 FAIL  test/server/runRoutes.test.ts > the gate passes a dependency whose newest run is done and merged
AssertionError: expected { error: 'not found' } to deeply equal { ok: true, missing: [] }
 FAIL  test/server/runRoutes.test.ts > run routes forward message, stop, resume, permission, and transcript with the right codes
AssertionError: expected 404 to be 200 // Object.is equality
      Tests  3 failed (3)
```

GREEN (same command, after implementation):

```
      Tests  4 passed (4)
```

`pnpm check` (tsc for both configs, biome, vitest) was pristine:

```
Checked 121 files in 76ms. No fixes applied.
 Test Files  47 passed (47)
      Tests  321 passed (321)
```

A grep of the full `pnpm check` output for `stderr|warn|error` found nothing.
`pnpm build` warned only about the existing chunk size (`Some chunks are larger than 500 kB`).

The first `pnpm check` failed on `findLast`, because the lib target is below ES2023, and on a widened `reason` type.
I fixed both by using `filter(...).at(-1)` and an explicit `Missing | null` return type.
Biome then wanted formatting fixes and flagged two comma operators in the test fakes; I fixed both.

## Manual verification

I ran the built CLI (`node dist/cli/index.js --port 47321 --no-open`) in a scratch git repository.
The repository had two task files (`top` depends on `base`) and a `sessions.json` holding one `working` run for `base`.

- `GET /api/runs` returned the run with status `interrupted`.
  This shows that `RunManager.start()` ran on the same store the agent loaded, and `sessions.json` on disk was rewritten to `interrupted`.
- `GET /api/runs/gate/top` returned `{"ok":false,"missing":[{"slug":"base","reason":"not done"}]}` with 200.
- `GET /api/runs/gate/nope` returned 404 `{"error":"task nope not found"}`.
- `GET /api/runs/run_aaaaaa/transcript` returned `[]` with 200, and `run_zzz` returned 404.
- `POST /api/runs {top, acceptEdits}` returned 409 `{"error":"dependencies are not merged","missing":[{"slug":"base","reason":"not done"}]}`.
- `POST /api/runs {top}` (no permissionMode) returned 400 with the Zod message.
- `POST /api/runs/run_aaaaaa/stop` returned 204, and the permission route with an unknown ask returned 404.
- A cross-origin POST returned 403, so the existing `sameOrigin` guard covers the new routes.
- I created `blueprint/base` at HEAD, set the run to `done`, added a later commit on main, and restarted.
  The gate then returned `{"ok":true,"missing":[]}`.
- I then added a commit on `blueprint/base` only.
  The gate returned `{"ok":false,"missing":[{"slug":"base","reason":"not merged"}]}`.
- I did not exercise a real launch, because it would start a real Claude session on the user's login.
  Launch forwarding is covered by the route tests, and the launch itself by the Task 3 manager tests.

I deleted the scratch repository afterward.

## Files changed

- Created: `src/server/runs/gate.ts`, `src/server/runRoutes.ts`, `test/server/runs/gate.test.ts`, `test/server/runRoutes.test.ts`
- Modified: `src/server/app.ts`, `src/server/index.ts`

## Self-review

- The routes follow `agentRoutes.ts`: the same `parse` helper and the same error mapping through `app.onError`.
  The permission body is the same shape as the agent's.
- `override` must be a boolean; `"yes"` returns 400 (tested).
- The gate checks dependencies in parallel; `missing` keeps `dependsOn` order because `Promise.all` keeps order.
- `close()` uses `Promise.all([agent.close(), manager.close()])`.
  If one rejects, the other keeps running in the background while the `finally` still frees clients and the port.

## Concerns

1. The `createApp` third-parameter shape differs from the brief, as explained above.
2. This is a pre-existing pattern, not new: if `serve()` fails (for example, the port is in use) after `manager.start()`, the restored sessions are not closed.
   They were restored but never started, so no CLI process is left behind.
   The agent has the same behaviour.

## Fix round 1

These changes apply the rulings in `task-4-findings-1.md`.

Commits:
- `0dc0f5e fix(runs): any done and merged run satisfies a dependency, and the gate says not ready`
- `b4031df refactor(server): agent and run routes share one body parser and permission schema`

### 1 (Important): the gate checks any done run, not the newest one

`checkGate` now checks every `done` run of a dependency with `isAncestor`.
The dependency passes when any of those branches is merged.
Otherwise it reports the best reason: "not merged" when a done run exists, then "not done" when any run exists, then "no run".
Only done runs reach git.

TDD:
- I updated `test/server/runs/gate.test.ts` first.
  - The `retried-dep` case (a done, merged run followed by a failed one) now passes.
  - The new `mixed-dep` case (a done, unmerged run followed by a failed one) expects "not merged".
  - The `isAncestor` call list now includes both of these done runs.
- RED, from `pnpm vitest run test/server/runs/gate.test.ts`:

  ```
   FAIL  test/server/runs/gate.test.ts > checkGate reports each missing dependency with its reason
  -       "reason": "not merged",
  +       "reason": "not done",
  +       "slug": "retried-dep",
  +     },
  +     {
  +       "reason": "not done",
          "slug": "mixed-dep",
  ```

- GREEN: the test passes after the change (see the `pnpm check` output below).

### 2 (Minor): the 409 message

The `GateError` message is now `dependencies are not ready`.
The 409 body still carries `missing`.
`test/server/runRoutes.test.ts` now expects the new message.

### 3 (Minor): shared parser and permission schema

`parse` and `PermissionBody` are now in the new `src/server/http.ts`.
Both `agentRoutes.ts` and `runRoutes.ts` import them, and the copies are removed.

### Verification

`pnpm check` was pristine:

```
 Test Files  47 passed (47)
      Tests  321 passed (321)
```

A grep of the output for `stderr|warn|error|fail` found nothing.

The two deferred items (squash and rebase merges, and sessions not closed when `serve()` fails) are not addressed, per the ruling.
