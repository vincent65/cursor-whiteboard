The task review of your Task 4 work found one Important issue and three minors worth fixing in the same pass. Fix them now, in this thread, on branch `m2-proposals`.

## Findings to address

Read /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-4-findings-1.md and apply the rulings exactly. Leave the deferred minors alone.

## What to do

- Files: `src/server/files.ts`, `src/server/agent/proposals.ts`, `src/server/agent/tools.ts`, `src/server/agent/session.ts` (comment only), `src/server/app.ts`, `src/server/agentRoutes.ts`, and the covering tests (`test/server/files.test.ts`, `test/server/agent/proposals.test.ts`, `test/server/agent/tools.test.ts`, `test/server/agentRoutes.test.ts`).
- Follow TDD for findings 1 and 2: write the failing test, run it, implement, run it.
- Run `pnpm check` once; output must be pristine.
- Commit with conventional messages and NO co-author or generated-with trailer, for example `fix(proposals): survive a torn log tail and close the revise/decide window`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-4-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond these findings.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
