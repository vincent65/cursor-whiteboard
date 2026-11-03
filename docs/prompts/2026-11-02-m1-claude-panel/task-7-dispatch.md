You are implementing Task 7: Board tools, system prompt, and the board-write hook, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-7-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/server/ws.ts` (`WsHub.request` from Task 2; you add `activeBoard`), `src/server/files.ts` (`FileStore.readBoard`, `listBoards`), `src/export/index.ts` (`excalidrawToBoardGraph`, `boardGraphToMarkdown`, `BoardGraph`), `src/server/agent/events.ts` (Task 5), and the SDK's `tool`, `createSdkMcpServer`, `HookCallback`, and `HookInput` types in `node_modules/@anthropic-ai/claude-agent-sdk`. Task 8 passes your server config into `mcpServers`, your hook into `hooks`, and your prompt text into `systemPrompt.append`.

Resolutions of things the brief leaves open:
- MCP tool results are `{ content: [{ type: "text", text }, { type: "image", data: <base64>, mimeType: "image/png" }] }`; split the browser's data URL on the first comma to get the base64 payload.
- `hub.activeBoard` is `string | null`, updated whenever a `selection.changed` arrives (the board it names).
- `isProtectedPath` uses `path.resolve(cwd, filePath)` and checks the prefix against `resolve(cwd, ".blueprint/boards") + sep` and the assets equivalent.
- `denyBoardWrites` returns `{}` for events other than `PreToolUse` and for tools not in the list; the deny reason is `Blueprint boards are edited only through proposals; use the propose tool in a later milestone, or ask the user to draw it.`
- Tests use a fake hub `{ request: vi.fn() }` and a fake store with `readBoard`/`listBoards` stubs over a small in-memory board.
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-7-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
