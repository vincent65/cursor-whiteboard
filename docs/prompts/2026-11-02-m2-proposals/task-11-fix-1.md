The task review of your Task 11 work found one Important issue and four minors worth fixing in the same pass. Fix them now, in this thread, on branch `m2-proposals`.

## Findings to address

Read /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-11-findings-1.md and apply the rulings exactly. Leave the deferred item alone.

## What to do

- Files: `src/shared/proposals.ts`, `src/shared/refs.ts` (new), `src/ui/board/ghosts.ts`, `src/ui/board/BoardView.tsx`, and the covering tests (`test/shared/proposals.test.ts`, `test/ui/ghosts.test.ts`).
- Follow TDD for each finding: write the failing test, run it, implement, run it.
- Run `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(ui): test and guard the bound-arrow listing and arrow ends`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-11-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond these findings. No real-login turn is needed.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
