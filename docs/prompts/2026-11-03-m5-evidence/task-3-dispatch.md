You are implementing Task 3: Design pass and restyle, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 5: evidence and polish). This gives the UI one coherent look and renders Claude's Markdown.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-3-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m5-evidence`, created from `main` after milestone 4 merged. Load the frontend-design skill for direction before writing DESIGN.md. Read `src/ui/styles.css` in full (788 lines, 15 raw hex values), every component under `src/ui/`, and run the built app on the fake SDK (`BLUEPRINT_FAKE_SDK=e2e/scenario.json node dist/cli/index.js --no-open` in a scratch repo) to take the before screenshots with Playwright or gstack browse at 1280 by 800.

Resolutions of things the brief leaves open:
- Keep the existing class names where you can, so component diffs stay small; rename only where a name lies.
- Ghost styling on the canvas is Excalidraw element styling (opacity, dashed stroke); the design pass covers the bar and chips around it, not the canvas rendering.
- The Markdown renderer is a small hand parser into React nodes; no `dangerouslySetInnerHTML`, no new dependency.
- The sessions view currently puts narrow cards in one column of an otherwise empty full-width page (seen in the demo); lay the cards out to use the width (a responsive grid of cards with a sensible max width, or a list plus detail), and keep the rate-limit note and other sessions aligned with them.
- Status colors become `--ok`, `--warn`, `--danger`, `--muted` tokens used by the panel status strip and the run cards alike.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-3-report.md

It must contain: what you implemented, TDD evidence where applicable, manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
