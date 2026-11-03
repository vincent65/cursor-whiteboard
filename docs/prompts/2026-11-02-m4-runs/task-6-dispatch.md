You are implementing Task 6: The sessions view, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 4: runs and the sessions view). This task is the user-facing sessions view: a card per run with the same transcript and permission components as the panel.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-6-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m4-runs`, created from `main` after milestone 3 merged. Read `src/ui/panel/ClaudePanel.tsx` (the transcript rendering to lift into `TranscriptList`, the `PermissionDialog` usage, the composer), `src/ui/panel/PermissionDialog.tsx`, `src/ui/api.ts`, `src/ui/hooks/useHashRoute.ts` (`Route`, `routeHash` from milestone 3), `src/ui/nav/Sidebar.tsx` (the `Plan` section from milestone 3), `src/ui/App.tsx` (the shell lays out the rail, the main pane, and the Claude panel; the sessions route takes the full width), `src/ui/server-events.tsx`, `src/shared/messages.ts`, and the tests under `test/ui/`.

Resolutions of things the brief leaves open:
- `TranscriptList` is lifted without changing its output: the existing `ClaudePanel` tests must pass unchanged apart from imports.
- The copy button uses `navigator.clipboard.writeText` and shows `Copied` for two seconds.
- The other-sessions list hides sessions started through the SDK (only terminal sessions appear), so it is empty in a scratch repo; give it a clear empty state (`No other Claude sessions in this repository.`) and check the populated case with a mocked `listSessions` in the test.
- Look at the view in the browser as a user would (card spacing, status chip colors, long branch names, a card with a long transcript) and fix what looks off within your files.
- Cards are ordered newest first; the other-sessions list shows `summary`, the relative time of `lastModified`, and `gitBranch` when present.

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. Every run is an ordinary Claude Code session on the user's login.
- Worktrees live at `.blueprint/worktrees/<slug>` on branch `blueprint/<slug>`, created from the repository's current `HEAD`; both paths are git-ignored by `blueprint init`.
- Run sessions get no board tools; their context is the task file and the spec.
- Run permission mode defaults to `acceptEdits`; the launch dialog offers `default` and `bypassPermissions`; whatever still prompts shows as a dialog in the sessions view.
- Launch is gated: every `dependsOn` task needs a run with status `done` whose branch is an ancestor of `HEAD`; the dialog explains what is missing and offers an override.
- Run status is one of `working`, `needs_you`, `idle`, `done`, `failed`, `interrupted`.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy, except the literal `claude --resume` command the copy button produces.
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-6-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
