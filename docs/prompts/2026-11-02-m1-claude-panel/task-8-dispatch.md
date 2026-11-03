You are implementing Task 8: Agent routes and server wiring, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-8-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/server/agent/session.ts` (Task 6), `src/server/agent/broker.ts` and `events.ts` (Task 5), `src/server/agent/tools.ts`, `prompt.ts`, `hooks.ts` (Task 7), `src/server/app.ts`, `src/server/index.ts`, `src/server/ws.ts`, `src/server/files.ts` (`readSessions`/`writeSessions`), and `src/shared/{messages,panel,types}.ts`. Task 9 calls your routes from the browser, so the paths, bodies, and status codes in the brief are contracts.

Resolutions of things the brief leaves open:
- `createAgent` is lazy about the SDK: nothing is spawned until the first `send`; `state()` before that reports `idle` with the restored transcript (or an empty one).
- The broker's `onChange` broadcasts `agent.status` with `needs_you` while asks are pending and the session's own status otherwise; each new ask also broadcasts an `agent.event` of kind `permission`.
- `canUseTool` is `(toolName, input, { signal, suggestions, toolUseID }) => broker.ask({ toolUseID, tool: toolName, input, suggestions, signal })`.
- `onSessionId` writes `sessions.json` with `plan: { sessionId, updatedAt: new Date().toISOString() }` preserving `runs`.
- The `createAgent` wiring test uses a fake sdk whose `query` awaits `options.canUseTool` for a scripted `Bash` call, so you can assert that `interrupt()` resolves the ask as deny and then calls `query.interrupt`.
- `startServer` passes `cwd: opts.root`.
- Task 7 ruling: `denyBoardWrites` is a factory, `denyBoardWrites(root: string): HookCallback`; register it as `hooks: { PreToolUse: [{ matcher: "Write|Edit|MultiEdit|NotebookEdit", hooks: [denyBoardWrites(cwd)] }] }` with the `cwd` that `createAgent` receives.
- Task 7 shipped `createBoardTools({ store, hub })` where `hub` is `Pick<WsHub, "request" | "activeBoard">`; the real `WsHub` satisfies it.
- Follow TDD as the brief says.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies unless the brief adds one.
- No API key anywhere; the SDK runs on the user's Claude Code login.
- No "Claude Code" branding in UI copy; the panel is titled "Claude".
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-8-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
