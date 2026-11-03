You are implementing Task 5: FileStore, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-5-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. The export module under `src/export/` provides the Zod schemas `BoardFile` and `BoardFileAsset` (read `src/export/schema.ts` before you start); `src/shared/types.ts` currently exports only `APP_NAME`. You are building the server's file layer: the only writer of the `.blueprint/` directory inside a user's repository. Task 6 builds HTTP routes on top of your `FileStore` and maps your error classes to status codes, and Task 7's watcher relies on `wasWrittenRecently` to ignore the server's own writes, so the names in the brief's Interfaces block are contracts.

Resolutions of things the brief leaves open:
- Server code is compiled with NodeNext resolution: relative imports need explicit `.js` extensions (for example `from "../export/index.js"`); `pnpm check` typechecks it.
- Use `node:fs/promises`, `node:path`, and `node:crypto` only.
- `listBoards` and `listDocs` return entries sorted by name; `updatedAt` is the file's mtime as an ISO string.
- `writeBoard` validates the incoming scene's `elements` and `appState` by parsing the final stored object with the `BoardFile` schema before writing; a parse failure is an `InvalidSceneError`.
- A dataURL must match `^data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$`; anything else is an `InvalidSceneError`, raised before any file is written.
- `createDoc` writes an empty file; `createBoard` and `createDoc` throw `ExistsError` on duplicates.
- Follow TDD as the brief's steps say; each test uses a fresh temporary directory from `mkdtemp` under `os.tmpdir()`.

## Global constraints that bind this task

- Node 22 or later; TypeScript strict mode; ESM; no new dependencies.
- The server is the only writer of `.blueprint/`; writes are atomic (temp file then rename).
- Excalidraw element IDs are never regenerated or rewritten.
- Board files hold no embedded image data; images are extracted to `.blueprint/assets/<sha256>.<ext>` and referenced by relative path.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/server/files.ts`, `src/shared/types.ts`, `test/server/files.test.ts`.

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

Completeness: all ten tests from the brief exist and pass; every method in the Interfaces block exists with the stated signature. Quality: errors are specific classes; no half-written files are possible. Discipline: no extra methods or files. Testing: tests run against real temporary directories; pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-5-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
