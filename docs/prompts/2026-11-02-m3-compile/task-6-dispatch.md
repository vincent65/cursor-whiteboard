You are implementing Task 6: Focus on boards and docs, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 3: compile and tasks). This task makes citations clickable targets: the board selects and scrolls to cited elements, the doc scrolls to a cited heading.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-6-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m3-compile`, created from `main` after milestone 2 merged. Read `src/ui/board/BoardView.tsx` (the `initial` scene state, the `excalidraw` ref, `apply`, and how `updateScene` and `scrollToContent` are already used in `applyProposalRequest`), `src/ui/docs/DocView.tsx` (the `EditorView` ref), `src/ui/App.tsx` (passing route fields to the views), `src/export/citations.ts` (`headingSlugs`), and `src/ui/board/snapshot.ts` for the id helpers.

Resolutions of things the brief leaves open:
- The focus effect runs once the scene is loaded (`initial` set and the api ref present) and again whenever `focus` changes; it uses `updateScene({ appState: { selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])) } })` with `captureUpdate: CaptureUpdateAction.NEVER` (a selection is not an undo step) followed by `scrollToContent(targets, { fitToViewport: true, animate: true })`.
- `DocView` computes the heading line by matching `headingSlugs` over the document's lines and dispatches `{ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: "start" }) }`.

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. Both the plan session and the split query run on the user's Claude Code login.
- `spec.md` has exactly these level-2 sections in this order: `Goals`, `Architecture`, `Interfaces`, `Constraints`, `Acceptance criteria`, `Open questions`.
- Citations use `[[board:<name>#<elementId>]]` and `[[doc:<file>#<heading-slug>]]`; unknown citations are dropped with a warning when the spec is served and never rewritten on disk.
- Task files live at `.blueprint/tasks/<nn>-<slug>.md`; `nn` is two digits from `01`; slugs match `src/shared/slug.ts`'s rule.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` stays pristine; `pnpm build` warns only about the pre-existing chunk size.
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-6-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
