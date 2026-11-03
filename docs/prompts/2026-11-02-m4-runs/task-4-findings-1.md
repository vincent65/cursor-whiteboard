# Task 4 findings, round 1 (from review thr_suwxsid5yh, with controller rulings)

## Important
1. The gate judges each dependency by its newest run only; the spec says a dependency is satisfied by any run with status `done` whose branch is an ancestor of HEAD. Ruling: pass when any `done` run of the slug has a merged branch; otherwise report the best reason in the order "not merged" (some done run exists) > "not done" (some run exists) > "no run". Update `gate.test.ts` (the "later failure hides an older merge" case now passes).

## Minor (fix in this round)
2. The 409 message says "dependencies are not merged" for every reason. Ruling: `dependencies are not ready`; `missing` carries the detail.
3. `parse` and `PermissionBody` are copied from `agentRoutes.ts`. Ruling: move both to `src/server/http.ts` and import them in both route files.

## Deferred (do not address)
- Squash and rebase merges never satisfy `merge-base --is-ancestor`; the override covers them and the README (milestone 5) will say so.
- Restored sessions are not closed if `serve()` fails (nothing was started).
