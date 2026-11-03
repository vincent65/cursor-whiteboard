You are implementing Task 7: WebSocket hub, file watcher, and server start, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-7-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Read these before you start: `src/server/files.ts` (`FileStore` with `dir`, `init`, `writeDoc`, `writeBoard`, and `wasWrittenRecently(absPath, withinMs)`), `src/server/app.ts` (`createApp(store): Hono`), and `src/shared/types.ts`. `@hono/node-server`, `@hono/node-ws`, and `chokidar` are installed. Task 8's CLI calls your `startServer`, and Task 9's browser client connects to `/ws` and reads `ServerMessage`, so the names in the brief's Interfaces block are contracts. The UI directory may not exist yet when `startServer` runs in tests; serving it must not crash on a missing directory, it should return 404.

Resolutions of things the brief leaves open:
- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions.
- Use `createNodeWebSocket` from `@hono/node-ws` for `/ws`, `serve` from `@hono/node-server` to listen, and `injectWebSocket` on the returned server; `close()` must resolve after the watcher stops and the HTTP server closes.
- The watcher test must not depend on wall-clock luck: wait for the event with a promise that resolves on the callback and a 1500 ms timeout, and assert that no event arrives within 300 ms after the server's own write.
- The UI content-type map covers html, js, css, map, png, svg, ico, woff2, json; unknown extensions are `application/octet-stream`.
- In `startServer`, register a JSON not-found handler for unmatched `/api/*` paths (`{ error: "not found" }` with 404) before the UI fallback, so the API's error contract holds for every path; the UI fallback serves `index.html` only for non-API paths.
- Follow TDD as the brief's steps say.

## Global constraints that bind this task

- Node 22 or later; TypeScript strict mode; ESM; no new dependencies.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/server/ws.ts`, `src/server/watch.ts`, `src/server/index.ts`, `src/shared/messages.ts`, `test/server/ws.test.ts`, `test/server/watch.test.ts`.

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

Completeness: `WsHub`, `watchPlan`, `startServer`, and `ServerMessage` exist with the stated signatures; all three tests exist and pass. Quality: no leaked timers or watchers after tests. Discipline: no extra files. Testing: pristine output, no open-handle warnings.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-7-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
