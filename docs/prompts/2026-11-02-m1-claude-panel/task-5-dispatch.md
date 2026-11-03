You are implementing Task 5: Permission broker and SDK event mapping, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-5-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/shared/panel.ts` (the `PanelEvent` union from Task 2; you add the permission types beside it) and look at the SDK types in `node_modules/@anthropic-ai/claude-agent-sdk` (`SDKMessage`, `SDKAssistantMessage`, `SDKUserMessage`, `SDKResultMessage`, `SDKPartialAssistantMessage`, `PermissionResult`, `PermissionUpdate`) to type the mapper and the broker precisely. Task 6 consumes both classes and Task 8 wires the broker to the SDK's `canUseTool`; the names in the brief's Interfaces block are contracts.

Resolutions of things the brief leaves open:
- Both files are pure (no I/O); import SDK types with `import type`.
- The mapper keeps per-block accumulated text keyed by content block index for partial events, and resets that state when a full `assistant` message arrives for the same turn.
- `tool_result` summaries use the text content of the block (joined if an array), trimmed to 120 characters; non-text content yields `(non-text result)`.
- The broker generates the pending entry id from `toolUseID`; `summary` uses `summarizeTool` from events.ts.
- Fixture SDK messages in tests are hand-written minimal objects typed with the SDK types (casts allowed in tests).
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-5-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
