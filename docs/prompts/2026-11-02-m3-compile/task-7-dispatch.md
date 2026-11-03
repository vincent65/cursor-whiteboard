You are implementing Task 7: Spec view and tasks view, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 3: compile and tasks). This task adds the two plan views and makes citations clickable.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-7-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m3-compile`, created from `main` after milestone 2 merged. Read `src/ui/docs/DocView.tsx` (CodeMirror setup: `basicSetup`, `markdown()`, `EditorView.lineWrapping`, the theme), `src/ui/hooks/useHashRoute.ts` (`routeHash` from Task 5), `src/ui/api.ts` (`getSpec`, `listTasks`, `agentSplit`), `src/ui/server-events.tsx` (`useServerEvent`), `src/shared/messages.ts` (`split.status`, `file-changed`), `src/server/watch.ts` and `test/server/watch.test.ts` (extend the watcher for `spec.md` and `tasks/`), and `src/ui/styles.css` tokens.

Resolutions of things the brief leaves open:
- Citation marks: a `StateField<DecorationSet>` built from `citationMarks(doc)` with `Decoration.mark({ class: "cite" })`, rebuilt on doc changes; a `EditorView.domEventHandlers({ click })` handler finds the mark under the click (`view.posAtCoords`) and sets `location.hash`.
- The read-only editor uses `EditorState.readOnly.of(true)` and `EditorView.editable.of(false)`.
- `file-changed` gains kinds `spec` and `task`; the watcher watches `.blueprint/spec.md` and `.blueprint/tasks/`, classifying `spec.md` as `{ kind: "spec", name: "spec" }` and `tasks/<file>.md` as `{ kind: "task", name: <file without .md> }`; the sidebar's refresh-on-new-file logic must ignore these kinds.
- From the Task 5 review: replace both placeholder paragraphs in `App.tsx` (they name an internal task); add a test that a rejected `agentSplit` (404 "compile the plan first" or 409) shows its message in the spec view.
- In your manual check, also look at the Claude panel header: it now holds the status strip, `Compile`, and `Stop` (Task 5 never saw it on screen). If the controls crowd or wrap at the default 360 px pane width, fix the header layout in `src/ui/styles.css`.
- `TasksView` shows `Split cost $<n>` from the last `split.status done` with a cost, and the error text from `error` until the next split.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-7-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
