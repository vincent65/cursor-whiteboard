You are implementing Task 6: PlanSession on the Agent SDK, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-6-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/server/agent/events.ts` and `src/server/agent/broker.ts` (Task 5), `src/shared/panel.ts`, `src/shared/messages.ts` (`AgentStatus`), and the SDK's `query` and `Options` types in `node_modules/@anthropic-ai/claude-agent-sdk` (streaming input takes an `AsyncIterable<SDKUserMessage>` as `prompt`; the returned `Query` is an async iterable of `SDKMessage` with an `interrupt()` method). Task 8 builds `SessionDeps` for you, so its shape is a contract.

Resolutions of things the brief leaves open:
- The input generator is a promise-based queue: `send` pushes an `SDKUserMessage` and resolves a waiting consumer; `close` ends the generator.
- One `query()` call lives as long as the session; the consumer loop maps every message through `SdkEventMapper`, forwards events via `onEvent`, and updates status: `working` when a user message is dequeued, `idle` on each `result`. If the loop throws, status becomes `error` with the error message, an `error` event is emitted, and the next `send` starts a new `query` with `resume: this.sessionId` when known.
- `restore` maps each saved SDK message through a fresh mapper into the transcript buffer (capped at 500) and sets status `idle` without starting the query.
- Pass `includePartialMessages: true`, `cwd`, and spread `deps.options` into the query options; `resume` is added when a session id is known.
- Fake `query` in tests: an async generator factory that consumes the prompt iterable in the background and yields scripted messages per user message; expose `interrupt` as a `vi.fn()`.
- From the Task 5 review: the mapper's final-text id scheme assumes that with partial messages on, the SDK emits one `assistant` message per finished content block after that block's deltas; your fake `query` must follow that order, and your report must state it so Task 12's acceptance can confirm it against the real SDK. Messages with `parent_tool_use_id` set (subagents) are forwarded to the mapper unchanged in this milestone.
- Follow TDD as the brief says.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies unless the brief adds one.
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-6-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
