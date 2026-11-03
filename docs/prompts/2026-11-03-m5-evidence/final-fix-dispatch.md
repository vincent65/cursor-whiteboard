You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m5-evidence`; milestone 5 (evidence and polish), the last MVP milestone, is complete and reviewed task by task. Read the design at docs/build-plan.md sections 7 to 9, then the findings.

## Findings to address (all twenty)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/final-findings.md
The full review with the reviewer's evidence is beside it: final-review-report.md.

## Context you need

- `pnpm check` (both typechecks, Biome including the rule that forbids `src/ui` importing `src/server`, Vitest) must stay pristine; `pnpm e2e` must pass three times in a row (Playwright runs only outside the sandbox).
- The fake SDK lives in `src/server/fake/` with `e2e/scenario.json`; the flows are in `e2e/`; the design system is `DESIGN.md` and `src/ui/styles.css`; the Markdown renderer is `src/ui/markdown.tsx`; citation chips are in `src/ui/plan/citations.tsx`; ghost placement is `src/ui/board/ghosts.ts`; tool summaries are in `src/server/agent/events.ts`.
- The acceptance report with the list of vague panel rows is task-6-report.md in the workspace.
- Never start a real Claude session and never push anywhere; the fake SDK is the way to see the UI.

## Rules

- Fix all twenty findings exactly as ruled, in the order listed; do not address anything else, including the deferred list.
- Follow TDD where a test is named: write the failing test, run it, implement, run it.
- Make one conventional commit per finding or per closely related pair, each with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/final-fix-report.md

It must contain, per finding: what you changed, the covering tests, the command, and its output; plus the final `pnpm check` and `pnpm build` output.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
