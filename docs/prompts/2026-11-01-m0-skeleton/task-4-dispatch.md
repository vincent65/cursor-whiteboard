You are implementing Task 4: Citations, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-4-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. The export module under `src/export/` already has `schema.ts` (Zod schemas and types including `BoardGraph` with `nodes`, `edges`, and `loose`, each item carrying an `id`), `boardGraph.ts`, `markdown.ts`, and `index.ts` which re-exports them; read `schema.ts` and `index.ts` before you start. The export module is pure: no I/O, no model calls, no imports from server or UI. The citation grammar you implement is what the compiled spec will use later to point back at board elements and doc headings; the UI resolves it for highlighting.

Resolutions of things the brief leaves open:
- Index keys for a board include every node id, edge id, and loose id from its `BoardGraph`, formatted `board:<name>#<id>`; doc keys are `doc:<file>#<slug>` for every heading slug in the Markdown.
- `headingSlugs` recognizes ATX headings only (one to six `#` followed by a space) at the start of a line.
- Follow TDD as the brief's steps say.

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/export/citations.ts`, `test/export/citations.test.ts`, and the re-export line in `src/export/index.ts`.

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

Completeness: the four tests from the brief exist and pass. Quality: the regex and the slug rule match the brief exactly. Discipline: no extra exports or files. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-4-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
