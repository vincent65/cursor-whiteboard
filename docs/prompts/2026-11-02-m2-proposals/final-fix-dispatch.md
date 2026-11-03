You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`; milestone 2 (ghost proposals) is complete and reviewed task by task. Read the design at docs/build-plan.md sections 4 (steps 4 to 7), 6.1, and 6.5, then the findings.

## Findings to address (all ten)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/final-findings.md
The full review with the reviewer's evidence is beside it: final-review-report.md.

## Context you need

- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions. `pnpm check` runs both typechecks, Biome, and Vitest; it must stay pristine.
- The export module: `src/export/boardGraph.ts` (`excalidrawToBoardGraph`), `src/export/markdown.ts`, tests under `test/export/` with the golden `basic.md`.
- The server side: `src/server/agent/tools.ts` (`withoutAddGhosts`, the pending line), `src/server/agent/index.ts` (`createAgent`, `send`, notes), `src/server/agent/session.ts` (`PlanSession`, `#notSent`, held sends), `src/server/agent/proposals.ts` (`takeNotes`), with tests under `test/server/agent/` and `test/server/agentRoutes.test.ts` (fake sdk).
- The browser side: `src/ui/board/ghosts.ts` (pure functions, `El`, `listBoundArrows`, `pendingProposals`), `src/ui/board/BoardView.tsx` (`throughGhosts`, `decide`, the pending list memo in `onChange`), `src/ui/board/ProposalsBar.tsx`, `src/ui/panel/refine.tsx`, `src/ui/panel/ClaudePanel.tsx`, `src/ui/board/mermaid.ts`, with tests under `test/ui/` (jsdom; `mermaid.test.ts` shows the canvas and FontFace stubs; `vitest.config.ts` inlines Excalidraw).
- Never start a real Claude session to verify; every real turn spends the user's plan allowance. The unit tests are the verification, plus `pnpm build`.

## Rules

- Fix all ten findings exactly as ruled; do not address anything else, including the deferred list.
- Follow TDD where a test is named: write the failing test, run it, implement, run it.
- Make one conventional commit per finding or per closely related pair, each with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/final-fix-report.md

It must contain, per finding: what you changed, the covering tests, the command, and its output; plus the final `pnpm check` and `pnpm build` output.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
