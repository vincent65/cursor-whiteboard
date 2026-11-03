You are implementing Task 11: Connecting operations, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 2: ghost proposals). This task closes the gap the acceptance run found: nothing could connect a new shape to existing shapes, so the spec's "add a cache between these two" scenario could not be expressed.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
.superpowers/sdd/2026-11-02-m2-proposals/task-11-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`. Read `src/shared/proposals.ts` (`Op`, `referencedIds`), `src/server/agent/tools.ts` (`checkIds`, the propose/revise handlers), `src/server/agent/proposals.ts` (`revised`), `src/server/agent/prompt.ts`, `src/ui/board/ghosts.ts` (`applyProposal`, `placeBeside`, `bounds`, the `El` type, the ghost style helpers), `src/ui/board/mermaid.ts` (`renderNote` is the model for `renderNode`), and `src/ui/board/BoardView.tsx` (`applyProposalRequest` renders each add op into the `rendered` map before applying; add `add_node` there). Excalidraw's `convertToExcalidrawElements` accepts a shape skeleton with `label: { text }` and sizes the container to the label; `restoreElements(..., { repairBindings: true })` adds a bound arrow to its targets' `boundElements`. Excalidraw arrows store `x`/`y` as the first point and `points` relative to it; a bound arrow's `startBinding`/`endBinding` carry `elementId`, `focus`, and `gap`.

Resolutions of things the brief leaves open:
- `$<i>` may also name an earlier `add_arrow`? No: only `add_node`. A `$` reference inside `near` is not supported.
- The arrow's own `El` needs fields `ghosts.ts` does not list today (`points`, `startBinding`, `endBinding`, `startArrowhead`, `endArrowhead`); widen `El` with optional fields for them rather than casting.
- Border points: for every kind use the axis-aligned bounding box; intersect the center-to-center segment with the box edge (the diamond and ellipse approximation is acceptable).
- An arrow label is a bound text element with `containerId` set to the arrow id, `text` and `originalText` equal to the label, placed at the arrow's midpoint; `restoreElements` with `refreshDimensions` in BoardView measures it.
- The prompt example in the brief is verbatim; keep the rest of the propose line's content and add the two new ops to its list.
- Do the real-login check once; every turn spends the user's allowance.

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
3. Do the manual verification the brief names and record what you observed.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to .superpowers/sdd/2026-11-02-m2-proposals/task-11-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
