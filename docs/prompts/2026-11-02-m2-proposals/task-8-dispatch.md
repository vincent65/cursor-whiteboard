You are implementing Task 8: Board integration, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 2: ghost proposals). This task connects the pure ghost logic and the Mermaid importer to the live Excalidraw scene and answers the server's apply requests.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`, created from `main` after milestone 1 merged. Read `src/ui/board/BoardView.tsx` end to end (`latest.current`, `excalidraw.current`, the `answer()` request handler, `apply()`, `useServerEvent`), `src/ui/board/ghosts.ts`, `src/ui/board/mermaid.ts`, `src/ui/board/ProposalsBar.tsx`, and `src/ui/panel/refine.tsx`. Excalidraw 0.18 exports `restoreElements(elements, null, { refreshDimensions, repairBindings })`, `CaptureUpdateAction`, and the imperative API's `updateScene`, `scrollToContent(target, { fitToViewport, animate })`, and `getSceneElementsIncludingDeleted()`. The viewport in scene coordinates is `x = -appState.scrollX`, `y = -appState.scrollY`, `w = appState.width / appState.zoom.value`, `h = appState.height / appState.zoom.value`.

Resolutions of things the brief leaves open:
- Convert every `add_diagram` and `add_note` first; only then read the live elements and mutate, so a conversion error leaves the scene untouched.
- Cast Excalidraw elements to ghosts.ts's `El` at the boundary with a single typed helper; do not widen `El`.
- The bar's items recompute in `onChange`, memoized on `getSceneVersion`; titles come from a `Map` filled by apply requests and `api.listProposals()` on mount.
- A 404 from the decision route is logged with `console.warn` and the local change stands.
- The bar was never seen on screen in Task 7: in your manual check, confirm it floats above Excalidraw's own bottom controls (it uses `z-index: 10`) and does not cover the zoom buttons; adjust `.proposals-bar` in `src/ui/styles.css` if it does (that file is added to your list for this purpose only).

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials.
- Claude never edits board files directly: proposals are the only write path, and the `PreToolUse` guard from milestone 1 stays.
- AI edits are never applied without an accept step: every operation lands as a ghost first, and only `accepted` makes it real.
- Ghost styling: added elements at `opacity: 40` with `strokeStyle: "dashed"` and the proposal id prepended to `groupIds`; updated elements with `strokeStyle: "dashed"`; deleted elements at `opacity: 40` with `strokeStyle: "dashed"` and `strokeColor: "#e03131"`. Ghosts are not locked.
- Every element Blueprint creates or accepts carries `customData.origin: "ai"` and `customData.proposalId`.
- Placement: beside the anchor's bounding box with an 80 pixel gap to the right, top-aligned; several additions in one proposal stack downward with a 40 pixel gap; with nothing to anchor on, centered in the viewport.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; anything the importer turns into an image is rejected with a message naming those five kinds.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy; the panel is titled `Claude`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.
- No new dependencies unless the brief adds one; only the files the brief lists.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
