You are implementing Task 3: Markdown renderer with golden fixture, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim, including the complete expected golden output:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-3-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Task 2 created `src/export/schema.ts` (Zod schemas and types `ExcalidrawElement`, `BoardFileAsset`, `BoardFile`, `BoardNode`, `BoardEdge`, `BoardLoose`, `BoardGraph`), `src/export/boardGraph.ts` (`excalidrawToBoardGraph(board: BoardFile, boardName: string): BoardGraph`), and `src/export/index.ts` that re-exports them; read those two source files before you start, because your renderer consumes `BoardGraph` exactly as defined there. The export module is pure: no I/O, no model calls, no imports from server or UI. Task 4 adds citations next to your file; Task 6 calls your renderer from the server.

Resolutions of things the brief leaves open:
- The golden test reads the fixture and expected file with `fs/promises` and compares the full string with `toBe`; the fixture lives at `test/export/fixtures/basic.excalidraw.json` and the expected output at `test/export/fixtures/basic.md`, and the expected file ends with exactly one newline after the last line.
- Bound text elements in the fixture are ordinary Excalidraw `text` elements with `containerId` set and listed in the container's `boundElements`; arrows carry `startBinding`/`endBinding` objects with `elementId`; frame children carry `frameId: "fr1"`.
- Sanitized IDs count up from 1 in the order nodes appear in the graph, skipping nodes that do not appear in the diagram.
- Follow TDD as the brief's steps say: write the fixture and the failing tests, run them and record the failure, implement, run them and record the pass.

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies.
- Element IDs are carried through unchanged into the ids comment; only the Mermaid node IDs are sanitized.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/export/markdown.ts`, the two fixture files, `test/export/markdown.test.ts`, and the one-line change to `src/export/index.ts`.

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

Completeness: all six tests from the brief exist and pass, and the golden output matches byte for byte. Quality: the rendering rules are implemented as stated, with clear names. Discipline: no extra exports or files. Testing: pristine output. Fix anything you find before reporting.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-3-report.md

It must contain: what you implemented, TDD evidence (RED command and failing output, GREEN command and passing output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines; the detail lives in the report file):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path

If BLOCKED or NEEDS_CONTEXT, put the specifics in that final message.
