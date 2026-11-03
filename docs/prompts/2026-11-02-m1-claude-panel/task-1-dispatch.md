You are implementing Task 1: SDK dependency, sessions file, and the login spike, for Blueprint, a local-first planning whiteboard that runs beside Claude Code. This is the first task of milestone 1 (the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-1-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`, branched from a complete milestone 0 (CLI, server, file store, export, UI). Read `src/server/files.ts` (the `FileStore` class with its atomic `write` helper and existing Zod usage) and `src/shared/types.ts` before you start. Tests for the store live in `test/server/files.test.ts` and use a fresh temporary directory per test. Server code uses NodeNext resolution: relative imports need explicit `.js` extensions.

Resolutions of things the brief leaves open:
- Validate `SessionsFile` with a Zod schema in `files.ts` on read; a parse failure or JSON syntax error rejects with the underlying error.
- `writeSessions` writes `JSON.stringify(s, null, 2) + "\n"` through the existing atomic `write` helper.
- The spike script `scripts/sdk-check.mjs` imports `query` from `@anthropic-ai/claude-agent-sdk`, uses `process.cwd()` as `cwd`, prints the init message fields and the final result text, and exits 1 if no result arrives within 120 seconds. It runs with the user's own Claude Code login; do not set any API key. If it reports an authentication problem, report BLOCKED with the exact output; do not try to fix authentication.
- Use the exact dependency spec from the brief.

## Global constraints that bind this task

- No API key anywhere; Blueprint never reads, stores, or forwards credentials.
- TypeScript strict; ESM; no dependencies beyond the one the brief adds.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Run the spike and record its complete output.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-1-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the spike's full output, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
