The task review of your Task 0 work found one Important issue and three minors. Fix them now, in this thread, on branch `m3-compile`.

Read /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-0-findings-1.md and apply the rulings exactly. Leave the deferred items alone.

Files: `src/server/agent/proposals.ts`, `src/server/agent/tools.ts`, `src/server/routes.ts`, `src/server/app.ts`, `src/server/index.ts`, `src/ui/board/BoardView.tsx`, `src/ui/board/ghosts.ts`, and the covering tests (`test/server/agent/proposals.test.ts`, `test/server/agent/tools.test.ts`, `test/server/routes.test.ts`, `test/ui/ghosts.test.ts`). Use the injected clock for every time-dependent test; never sleep.

Follow TDD for each finding. Run `pnpm check` once; output must be pristine. Commit with conventional messages and NO co-author or generated-with trailer, for example `fix(proposals): the server owns the reconcile with a removal grace period`. Append a "Fix round 1" section to your report. Do not spawn subagents or reviewers. End your turn with ONLY the short status contract: Status, commits, one-line test summary, concerns, report path.
