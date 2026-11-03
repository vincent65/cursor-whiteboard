The task review of your Task 5 work found two Important issues and two minors worth fixing in the same pass. Fix them now, in this thread, on branch `m2-proposals`.

## Findings to address

Read /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-5-findings-1.md and apply the rulings exactly. Leave the deferred minors alone.

## What to do

- Files: `src/ui/board/ghosts.ts` and `test/ui/ghosts.test.ts` only.
- Follow TDD for each finding: write the failing test, run it, implement, run it.
- Run `pnpm vitest run test/ui/ghosts.test.ts`, then `pnpm check` once; output must be pristine.
- Commit with a conventional message and NO co-author or generated-with trailer, for example `fix(ui): refuse cross-proposal targets and snapshot original label text`.
- Append a "Fix round 1" section to your report file /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-5-report.md with: what you changed, the covering tests, the command, and its output.
- Do not spawn subagents or reviewers. Do not address other observations beyond these findings.

End your turn with ONLY the short status contract: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
