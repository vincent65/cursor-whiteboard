You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m4-runs`; milestone 4 (runs and the sessions view) is complete and reviewed task by task. Read the design at docs/build-plan.md section 6.7, then the findings.

## Findings to address (all twelve)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/final-findings.md
The full review with the reviewer's evidence is beside it: final-review-report.md.

## Context you need

- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions. `pnpm check` runs both typechecks, Biome (which also forbids `src/ui` from importing `src/server`), and Vitest; it must stay pristine.
- Runs: `src/server/runs/{manager,prompt,git,gate,store}.ts`, `src/server/runRoutes.ts`, `src/server/sessions.ts`, `src/server/app.ts` (`statusFor`), `src/shared/runs.ts`, `src/shared/types.ts`; tests under `test/server/runs/`, `test/server/runRoutes.test.ts`, and `test/server/agent/fakeSdk.ts`.
- UI: `src/ui/sessions/{SessionsView,RunCard}.tsx`, `src/ui/plan/{TasksView,LaunchDialog}.tsx`, `src/ui/panel/TranscriptList.tsx`, `src/ui/api.ts`; tests under `test/ui/` (jsdom).
- Never start a real Claude session and never push anywhere; the unit tests are the verification, plus `pnpm build`.

## Rules

- Fix all twelve findings exactly as ruled; do not address anything else, including the deferred list.
- Follow TDD where a test is named: write the failing test, run it, implement, run it.
- Make one conventional commit per finding or per closely related pair, each with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/final-fix-report.md

It must contain, per finding: what you changed, the covering tests, the command, and its output; plus the final `pnpm check` and `pnpm build` output.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
