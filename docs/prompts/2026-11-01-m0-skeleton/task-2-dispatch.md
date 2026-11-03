You are implementing Task 2: Export schema and BoardGraph, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-2-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton` with three commits: the package bootstrap and two follow-ups (pnpm, TypeScript strict ESM, Vitest with globals and a `test/setup.ts`, Biome). Dependencies are installed; Zod 4 is available as `zod`. The export module you are creating is pure: no I/O, no model calls, no imports from the server or UI. Task 3 builds the Markdown renderer on top of your `BoardGraph`, and Task 5 consumes your `BoardFile` and `BoardFileAsset` schemas, so the names and shapes in the brief are a contract: use them exactly.

Resolutions of things the brief leaves open:
- Zod 4 API: `z.object({...}).loose()` for objects that keep unknown keys, and `z.record(z.string(), z.unknown())` with two arguments.
- Export inferred TypeScript types alongside each schema with the same name (`export type BoardGraph = z.infer<typeof BoardGraph>` and so on).
- The test helper `el(overrides)` lives in the test file and returns an element with `x`, `y`, `width`, `height` set to 0, `isDeleted` false, and the overrides applied; `board(elements, files?)` wraps elements in a `BoardFile` with `type: "excalidraw"` and `version: 2`.
- Follow TDD as the brief's steps say: write the failing tests, run them and record the failure, implement, run them and record the pass.

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies.
- Excalidraw element IDs are never regenerated or rewritten: the graph carries the element IDs as they are.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/export/schema.ts`, `src/export/boardGraph.ts`, `src/export/index.ts`, `test/export/boardGraph.test.ts`.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; its output must be pristine.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer. A reviewer is dispatched separately after you report.

## Self-Review Before Reporting

Completeness: all eight tests from the brief exist and pass; every rule in the brief's implementation step is honored. Quality: clear names, no logic the tests do not need. Discipline: no extra files, no extra exports beyond the brief, no dependencies. Testing: tests verify behavior on real element data, and the output is pristine. Fix anything you find before reporting.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-2-report.md

It must contain: what you implemented, TDD evidence (the RED command and failing output, the GREEN command and passing output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines; the detail lives in the report file):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path

If BLOCKED or NEEDS_CONTEXT, put the specifics in that final message.
