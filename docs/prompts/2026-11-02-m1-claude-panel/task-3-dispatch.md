You are implementing Task 3: Server events context in the UI and sidebar refresh, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-3-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/ui/api.ts` (the current `connectWs`), `src/ui/App.tsx`, `src/ui/board/BoardView.tsx` and `src/ui/docs/DocView.tsx` (each opens its own socket today), `src/shared/messages.ts` (the `ServerMessage` and `ClientMessage` unions from Task 2), and `test/ui/Sidebar.test.tsx` for the UI test conventions. Task 4 adds selection reporting and request responders on top of your `useServerEvent` and `useSendToServer`, and Task 9 adds the Claude panel, so the hook names and semantics in the brief are contracts.

Resolutions of things the brief leaves open:
- `useServerEvent` stores the handler in a ref so re-renders do not resubscribe; subscription happens once per mount.
- The provider reconnects with the same backoff as today's `connectWs` (500 ms doubling to 10 s, reset on open).
- "A name it does not know" means a `file-changed` whose `name` is absent from the current boards or docs list; then both lists are refreshed. Known names do nothing at the App level (the open view handles them).
- The fake `WebSocket` in tests is a small class on `globalThis` with `send`, `close`, and settable `onopen`, `onmessage`, `onclose`, recording sent frames and exposing the last instance.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Follow TDD as the brief's steps say; the manual check uses `pnpm dev` and is described in the report.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Do the manual verification from the brief and record what you observed.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-3-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
