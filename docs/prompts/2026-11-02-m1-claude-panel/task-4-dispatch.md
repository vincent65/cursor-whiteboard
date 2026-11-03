You are implementing Task 4: Selection reporting and browser responders, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-4-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/ui/board/BoardView.tsx` (its `latest` ref holds the current scene; `onChange` fires on selection changes too), `src/ui/server-events.tsx` (`useServerEvent`, `useSendToServer` from Task 3), `src/shared/messages.ts` (the `request` and `response` and `selection.changed` message shapes), and `src/ui/board/scene.ts`. Task 7 on the server will call `hub.request({ kind: "selection.snapshot" })` and `{ kind: "board.png", board }` and expects exactly the payloads the brief names; Task 9 adds selection chips on top of the same debounced handler.

Resolutions of things the brief leaves open:
- Build the selected-elements PNG with `exportToBlob({ elements: <selected non-deleted elements>, appState, files, mimeType: "image/png", exportPadding: 16 })` and convert with `blobToDataUrl`.
- Answer every request with a `response` carrying the request id; wrap export failures as `ok: false` with the error message.
- `test/ui/snapshot.test.ts` is pure and runs in Node; it must not import Excalidraw. Keep `snapshot.ts` free of Excalidraw imports except types.
- Carried from the Task 3 review (controller ruling, fix them here since this task adds traffic on the same socket): in `src/ui/server-events.tsx` wrap each subscriber call in try/catch with `console.error` so one throwing handler does not block the others; in `src/ui/api.ts` make `send` check `socket.readyState === WebSocket.OPEN` (give the test's fake socket a `readyState`) so frames in the closing window queue instead of being dropped; and on reconnect drop queued `response` frames and keep only the latest `selection.changed`. Extend the existing server-events test for the queue rule.
- Follow TDD as the brief says; the manual check uses `pnpm dev` and the browser devtools WS frames.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-4-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
