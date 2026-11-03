You are implementing Task 2: Bidirectional WebSocket protocol and hub requests, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-2-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/server/ws.ts` (the one-way `WsHub`), `src/shared/messages.ts`, `src/server/index.ts` (the `/ws` upgrade handler), and `test/server/ws.test.ts` before you start. The browser (Task 3) will send `ClientMessage`s and answer `request` messages; the board tools (Task 7) will call `hub.request`. Server code uses NodeNext resolution: relative imports need explicit `.js` extensions, including the type re-export from `./panel.js` in `messages.ts`.

Resolutions of things the brief leaves open:
- The "active socket" is the socket that most recently sent `selection.changed`; with none, the most recently added socket. Removing the active socket falls back to the most recently added remaining socket.
- A `response` whose id matches no pending request is ignored. Malformed JSON and messages without a recognized `type` are ignored.
- `request` resolves with `payload` typed as `T` without validation; callers validate.
- Keep the existing `broadcast` and `size` behavior and tests intact.
- Follow TDD as the brief's steps say; use `vi.useFakeTimers()` for the timeout test.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-2-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
