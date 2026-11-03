You are implementing Task 2: Playwright flows and the recorded demo, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 5: evidence and polish). This is the milestone's evidence: three end-to-end flows that run on any machine, and the demo videos.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-2-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m5-evidence`, created from `main` after milestone 4 merged. Read `src/cli/index.ts` (startup output; print the bound port in a parseable line if it does not already, for example `Blueprint is running at http://127.0.0.1:<port>`), `src/server/fake/` and `e2e/scenario.json` from Task 1, the UI components the flows touch (`src/ui/board/BoardView.tsx` with Excalidraw, `src/ui/panel/ClaudePanel.tsx`, `src/ui/board/ProposalsBar.tsx`, `src/ui/plan/SpecView.tsx`, `src/ui/plan/TasksView.tsx`, `src/ui/plan/LaunchDialog.tsx`, `src/ui/sessions/SessionsView.tsx`). Excalidraw's toolbar buttons carry `data-testid` attributes such as `toolbar-rectangle`; draw with mouse drags on the canvas.

Resolutions of things the brief leaves open:
- `pnpm add -D @playwright/test@^1.64` then `pnpm exec playwright install chromium`; run outside the sandbox if the store or browser cache is not writable.
- The compile scenario cites `[[board:main#login]]`; the compile-and-split test seeds `.blueprint/boards/main.excalidraw.json` with a rectangle whose id is `login` (and its bound text) before starting the server, so the citation resolves and clicking it selects that box.
- Tests run serially (`workers: 1`) because each starts a server; give each its own temp repo.
- Use role and text locators first; add a `data-testid` to a Blueprint component only where no accessible locator exists, and say which.
- If another session holds the default browser profile, Playwright's own launched browser is unaffected (it uses a fresh profile).

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. With `BLUEPRINT_FAKE_SDK` unset, behaviour is unchanged.
- No "Claude Code" branding in UI copy; the README may name Claude Code as the thing Blueprint runs beside.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` stays pristine; `pnpm build` warns only about the pre-existing chunk size; `pnpm e2e` passes three times in a row.
- Long Markdown files put each full sentence on its own line, and never use an em dash.
- No new dependencies unless the brief adds one; only the files the brief lists, plus what a named item needs.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Never push anywhere and never create GitHub repositories.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first where there is behaviour.
2. Run `pnpm check` once before committing; output must be pristine.
3. Do the manual verification the brief names and record what you observed.
4. Commit as the brief says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Report

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-2-report.md

It must contain: what you implemented, TDD evidence where applicable, manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
