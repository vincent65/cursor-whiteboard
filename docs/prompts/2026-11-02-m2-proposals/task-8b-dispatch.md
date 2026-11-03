You are implementing Task 8b: Arrow ids in the board export and typed API errors, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 2: ghost proposals). This task closes a gap the real-login check found: Claude could not target arrows because the export never names their ids.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8b-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`. Read `src/export/markdown.ts` (the `linked`/`free` split, `sid`, the Unconnected arrows bullets whose format you mirror), `test/export/markdown.test.ts` and `test/export/fixtures/basic.md` (the golden; `test/export/mermaid.test.ts` parses only the fenced Mermaid block, so a new section after the ids comment does not affect it), `src/server/agent/prompt.ts` and its test, `src/ui/api.ts` (`request`), and the decision handler in `src/ui/board/BoardView.tsx` that currently matches "is not pending" in the message.

Resolutions of things the brief leaves open:
- Labels in the Arrows bullets use the existing `plain()` helper (whitespace collapsed), the same as the Unconnected arrows bullets.
- Keep the Unconnected arrows section as it is; the new section lists only arrows that appear in the diagram.
- The decide path order changes from "local first, then server" to "server first": the Task 8 review showed a 409 during a revise round trip left accepted copies on the board that the revise then duplicated. Keep the existing local apply code; move the `api.decideProposal` call ahead of it and branch on `ApiError.status`.
- `ApiError` carries `status` as a public readonly field; `request()` still builds the message from the body's `error` or the method, path, and status.

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials.
- Claude never edits board files directly: proposals are the only write path, and the `PreToolUse` guard from milestone 1 stays.
- AI edits are never applied without an accept step: every operation lands as a ghost first, and only `accepted` makes it real.
- Ghost styling: added elements at `opacity: 40` with `strokeStyle: "dashed"` and the proposal id appended to `groupIds` as the outermost group; updated elements with `strokeStyle: "dashed"`; deleted elements at `opacity: 40` with `strokeStyle: "dashed"` and `strokeColor: "#e03131"`. Ghosts are not locked.
- Every element Blueprint creates or accepts carries `customData.origin: "ai"` and `customData.proposalId`.
- Placement: beside the anchor's bounding box with an 80 pixel gap to the right, top-aligned; several additions in one proposal stack downward with a 40 pixel gap; with nothing to anchor on, centered in the viewport.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; anything the importer turns into an image is rejected with a message naming those five kinds.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy; the panel is titled `Claude`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.
- No new dependencies; only the files the brief lists.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8b-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
