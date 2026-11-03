You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m3-compile`; milestone 3 (compile and tasks) is complete and reviewed task by task. Read the design at docs/build-plan.md sections 6.3 and 6.6, then the findings.

## Findings to address (all fifteen)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/final-findings.md
The full review is beside it: final-review-report.md.

## Context you need

- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions. `pnpm check` runs both typechecks, Biome, and Vitest; it must stay pristine.
- Compile and split: `src/server/agent/index.ts` (`compile`, `split`, `state`, `compiling`), `src/server/agent/prompt.ts` (`COMPILE_INSTRUCTION`), `src/server/agent/split.ts`, `src/server/agent/session.ts` (`savedPrompt`, `restore`), `src/server/agent/tools.ts` (`read`), `src/server/files.ts` (`writeExport`, `listBoards`, `readBoard`, `listDocs`, `readDoc`, `citationIndex`), `src/export/citations.ts`, `src/server/watch.ts`; tests under `test/server/` and `test/export/`.
- UI: `src/ui/plan/SpecView.tsx`, `src/ui/plan/TasksView.tsx`, `src/ui/panel/ClaudePanel.tsx`, `src/ui/api.ts`; tests under `test/ui/` (jsdom).
- Never start a real Claude session; every real turn spends the user's plan allowance. The unit tests are the verification, plus `pnpm build`.

## Rules

- Fix all fifteen findings exactly as ruled; do not address anything else.
- Follow TDD where a test is named.
- Make one conventional commit per finding or per closely related group, each with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/final-fix-report.md with, per finding: what changed, the covering tests, the command, and its output; plus the final `pnpm check` and `pnpm build` output.

End your turn with ONLY: Status, commits (short SHA + subject), one-line test summary, concerns, report path.
