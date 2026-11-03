You are implementing Task 9: The Claude panel UI, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-9-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/ui/api.ts`, `src/ui/server-events.tsx` (Task 3), `src/ui/App.tsx`, `src/ui/board/BoardView.tsx` (the debounced selection handler from Task 4), `src/ui/styles.css` (tokens and the `.notice` and `.button` classes), `src/shared/panel.ts`, `src/shared/messages.ts`, and `src/server/agentRoutes.ts` (Task 8, the exact routes). Tests follow `test/ui/Sidebar.test.tsx` conventions with Testing Library and mocked `api`.

Resolutions of things the brief leaves open:
- The selection context carries `{ board, ids, labels }`; labels come from the selected elements' bound text or own text, in element order, falling back to the element type.
- `agentSend(text, selection)` posts `{ text, selection: { board, ids } }`; the server builds the header.
- Status text mapping: starting → `Starting`, idle → `Idle`, working → `Working`, needs_you → `Needs you`, error → `Error: <message>`, stopped → `Stopped`.
- The composer textarea is disabled while status is `starting`; sending while `working` is allowed (the server queues it).
- Keep rendering simple: assistant text in a `<pre class="msg-assistant">`-like block that preserves line breaks and wraps, no Markdown rendering.
- Carried from earlier reviews (controller ruling, fix here since this task owns the UI shell): add a small `favicon.svg` under `src/ui/public/` and link it from `index.html` so the browser stops logging a 404; and in `connectWs`'s `close()`, when the socket is still CONNECTING set `socket.onopen = () => socket.close()` instead of closing immediately, which removes the StrictMode "WebSocket is closed before the connection is established" warning in dev.
- Carried from the Task 4 re-review (controller ruling): when `BoardView` unmounts it sends a `selection.changed` with `board: ""` and `ids: []`, and `connectWs` treats an empty board name as clearing the remembered selection (nothing re-sent on reconnect); the hub side (`activeBoard`) treats an empty board as null. Add that case to the server-events test and a hub test if you touch `ws.ts`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Follow TDD as the brief says; the manual check runs the built app or `pnpm dev` with your real login.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-9-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
