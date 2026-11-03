### Spec Compliance
- Issues found: the gate decides each dependency by its newest run only (`src/server/runs/gate.ts:23`). The spec says a dependency is satisfied by "a run with status `done` whose branch is an ancestor of `HEAD`". Details are under Important.
- Everything else in the brief is present:
  - `checkGate` and `GateResult` match the brief's signature.
  - All routes are mounted at `/api/runs` and return the codes the brief lists: 201, 409 with `{ error, missing }`, 404, 400, 202 `{ id }`, 204, and 409 for a resume of a run that is not interrupted (`src/server/runRoutes.ts:44-82`).
  - `createApp(store, agent?, runs?)` mounts the routes when a manager is given (`src/server/app.ts:63`).
  - `startServer` builds one shared `RunStore`, builds `RunManager`, calls `start()`, and closes the manager in `close()` (`src/server/index.ts:39-55`, `:106`).
- All three tests the brief names exist.
  - `test/server/runs/gate.test.ts:30` covers no run, a failed run, done but not merged, and done and merged.
  - `test/server/runRoutes.test.ts:99` covers refusal without override and launch with it.
  - `test/server/runRoutes.test.ts:186` covers forwarding of message, stop, resume, permission, and transcript.
  - One extra test covers the "done and merged" path through the routes.
- The third `createApp` parameter is `RunRouteDeps = { manager, isAncestor }`, not a bare `RunManager`. The brief does not spell out the type, and the change keeps the root-dependent git call out of the route. I accept it.
- Cannot verify from the diff alone:
  - That milestone 1's corrupt-file handling still works.
    - `createAgent` still receives `runs` (`index.ts:42`).
    - I checked `RunManager.start()` (`src/server/runs/manager.ts:78-96`): it only reads `runs.runs()` and does not load the store again, so the store is not loaded twice.
    - No test covers a corrupt `sessions.json` with the manager attached. The report's manual run only shows a valid file.
  - The `pnpm check` and `pnpm build` results. I relied on the report and did not re-run them.

### Strengths
- `gate.ts` is small and pure, and `isAncestor` is injected. Git is only called for `done` runs, and the test asserts exactly which branches reached git (`gate.test.ts:62-65`).
- `GateError` maps to 409 in `statusFor`, and `onError` attaches `missing` (`app.ts:20-27`, `:72-74`). The route therefore needs no local try/catch.
- The route tests run real `FileStore` tasks against a fake manager. They cover the edge cases:
  - `override: "yes"` returns 400.
  - An unknown task returns 404 even with `override: true`.
  - A task with no dependencies is not gated.
  - Unknown runs return 404 on every route.
- The existing `sameOrigin` guard now covers the new routes. The report's manual check confirms a cross-origin POST returns 403.
- One `RunStore` is shared by the agent and the manager, so all writes go through one queue (`index.ts:39-48`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The gate looks only at the newest run, which is stricter than the spec** (`src/server/runs/gate.ts:23`).
   - The spec requires "a run with status `done` whose branch is an ancestor of `HEAD`".
   - The code takes `filter(...).at(-1)` and judges only that run.
   - The test treats this as intended: "a later failure hides an older merge" (`gate.test.ts:35-37`, expects `retried-dep: "not done"`).
   - Failure scenario:
     - `base` finishes and is merged into `HEAD`.
     - The user launches a follow-up run of `base`, which is `working` or later `failed`.
     - `top` is now gated as "not done", even though `base`'s merged work is already in `HEAD`.
     - The user is pushed to override a gate that should pass.
   - Fix: pass when any `done` run's branch is an ancestor of `HEAD`. Take the reason from the best run, in this order: merged, then done but not merged, then not done. Update the test to match.

#### Minor (Nice to Have)
1. **The error message names the wrong problem for most cases** (`src/server/runs/gate.ts:9`). It always says "dependencies are not merged", even when the reason is "no run" or "not done". A neutral message such as "dependencies are not ready" would fit, with `missing` carrying the detail.
2. **Two helpers are copied from `agentRoutes.ts`** (`src/server/runRoutes.ts:25-31`). `parse` and `PermissionBody` match `src/server/agentRoutes.ts:15-21`. They could be moved to one shared place so the two permission contracts cannot drift apart.
3. **Spec limitation: some merge styles never satisfy the gate.**
   - `isAncestor` returns false for a deleted branch (`src/server/runs/git.ts:40`).
   - With `merge-base --is-ancestor`, a squash merge or a rebase merge never counts as merged.
   - A GitHub squash-merge flow will therefore always need the override.
   - The spec's ancestor rule mandates this and the override mitigates it. It is worth noting for the plan.
4. **Restored sessions are not closed if `serve()` fails** (`src/server/index.ts:48`). `manager.start()` runs before the server starts listening. If `serve()` then fails, for example because the port is in use, the restored sessions are never closed. The agent already behaves this way, as the report says. No CLI process is left running.

### Assessment
Task quality: Needs fixes
Reasoning: The routes, the wiring, and the tests are solid and follow the brief. The one problem is that the gate checks only each dependency's newest run, which contradicts the spec's "a done run whose branch is an ancestor of `HEAD`". A follow-up run of an already-merged dependency then wrongly blocks launches.
