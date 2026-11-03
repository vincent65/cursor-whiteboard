You are implementing Task 12: Milestone acceptance, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-12-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel` with Tasks 1 to 11 complete. Follow the brief's acceptance script on a fresh scratch repository using the built CLI and your real Claude Code login. Drive the browser with the Playwright MCP tools if they are available to you, otherwise with gstack's browse tool; if neither can start, say so and describe what you could verify with curl. Note the time from the first send to the first streamed text, since the plan session loads the user's Claude Code settings. If a step fails, fix the smallest thing that makes it pass within the plan's file structure, keep `pnpm check` green, and commit with a conventional message and no trailer; otherwise make no commit. Stop any server you started. Revert any file a browser tool adds to the repository (for example a `.gstack/` line in `.gitignore`).

Known defect to fix before the run (found in Task 9's real-login check, flagged in Task 6): clicking Stop ends the turn with status `Error: [ede_diagnostic] ...` instead of `Idle`. The SDK answers an interrupt with a result whose subtype is not `success` (an `error_during_execution` with an `[ede_diagnostic]` message). Ruling: when a result arrives after `interrupt()` was called on that run, `PlanSession` treats it as a normal end: status `idle`, a `result` event with subtype `interrupted`, no `error` event or error status. Fix test-first in `src/server/agent/session.ts` (and `events.ts` only if the mapper must carry the subtype) with a test in `test/server/agent/session.test.ts` whose fake query yields an error result after `interrupt`. Commit it separately before the acceptance run.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies unless the brief adds one.
- No API key anywhere; the SDK runs on the user's Claude Code login.
- No "Claude Code" branding in UI copy; the panel is titled "Claude".
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists, plus the files the known-defect fix above names (`src/server/agent/session.ts`, `src/server/agent/events.ts`, `test/server/agent/session.test.ts`) and whatever the acceptance run proves must change; the UI may show an interrupted result row as `Stopped` if `src/ui/panel/ClaudePanel.tsx` needs a one-line change for that.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Do any manual verification the brief names and record what you observed.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-12-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
