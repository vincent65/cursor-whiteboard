You are implementing Task 10: Doc view, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-10-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Task 9 built the UI shell: read `src/ui/api.ts` (`getDoc`, `saveDoc`, `connectWs`), `src/ui/App.tsx` (how `DocView` is rendered with a `name` prop), `src/ui/styles.css` (the design tokens), and the stub at `src/ui/docs/DocView.tsx`, which you replace. `codemirror`, `@codemirror/lang-markdown`, `@codemirror/state`, and `@codemirror/view` are installed. Task 11 reuses your `useDebounced` hook, so its signature is a contract.

Resolutions of things the brief leaves open:
- Every UI test file that renders components or hooks starts with the line `// @vitest-environment jsdom`; `reconcile.test.ts` is pure and needs no pragma.
- `useDebounced` is tested with `renderHook` and `vi.useFakeTimers()`: three calls within 500 ms produce exactly one invocation with the last value after the delay.
- The banner's two buttons are labeled exactly `Keep mine` and `Take theirs`.
- The CodeMirror `EditorView` is created once per doc name in an effect and destroyed on cleanup; switching docs creates a fresh view.
- Follow TDD as the brief's steps say; the manual verification in Step 4 is done by you with `pnpm dev` and described in the report (what you did and what you observed).

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies.
- The server is the only writer of `.blueprint/`; the UI saves through the API.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; output must be pristine.
3. Do the manual verification from the brief's Step 4 and record what you observed.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Self-Review Before Reporting

Completeness: `reconcileExternalChange`, `useDebounced`, and `DocView` exist with the stated signatures; both tests pass; autosave and the banner behave as specified. Quality: no leaked editor instances or listeners. Discipline: no extra files or dependencies. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-10-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the manual verification steps and observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
