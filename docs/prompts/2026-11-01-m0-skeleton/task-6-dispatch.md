You are implementing Task 6: HTTP routes, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-6-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Read these before you start: `src/server/files.ts` (the `FileStore` class and the error classes `InvalidNameError`, `NotFoundError`, `ExistsError`, `InvalidSceneError`), `src/shared/types.ts` (`IncomingScene`, `IncomingFile`), and `src/export/index.ts` (`excalidrawToBoardGraph`, `boardGraphToMarkdown`, `BoardFile`). Hono and `@hono/node-server` are installed. Task 7 wraps your `createApp` with the HTTP server, the WebSocket, and the UI static route, so `createApp` must not listen on a port or serve static files.

Resolutions of things the brief leaves open:
- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions.
- Tests call `app.request(path, init)` on a Hono app built over a `FileStore` rooted in a fresh temporary directory (after `store.init()`); no sockets are opened.
- For the `.md` suffix route, match `/api/export/boards/:name{[a-z0-9-]+}.md` or strip the suffix after a looser match; either is fine as long as `GET /api/export/boards/main.md` works and `main.txt` returns 404.
- Asset content types: png `image/png`, jpg `image/jpeg`, gif `image/gif`, svg `image/svg+xml`, webp `image/webp`.
- The PNG upload route accepts the raw request body as bytes and does not validate that it is a PNG.
- A corrupt board file makes `readBoard` throw a ZodError or SyntaxError; the `onError` handler maps any error that is not one of the four classes to 500 with `{ error }` so a request never crashes the server.
- Follow TDD as the brief's steps say.

## Global constraints that bind this task

- Node 22 or later; TypeScript strict mode; ESM; no new dependencies.
- Board and doc names are slugs matching `^[a-z0-9][a-z0-9-]*$`; invalid names are rejected before any filesystem access.
- The server is the only writer of `.blueprint/`.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/server/routes.ts`, `src/server/app.ts`, `test/server/routes.test.ts`.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; its output must be pristine.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Self-Review Before Reporting

Completeness: every route in the brief's table exists with the stated status codes; all eight tests exist and pass. Quality: one error mapping, no duplicated handlers. Discipline: no extra routes or files. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-6-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
