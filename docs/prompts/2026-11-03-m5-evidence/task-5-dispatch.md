You are implementing Task 5: README, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 5: evidence and polish). This is the front door for anyone who clones the repository.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-5-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m5-evidence`, created from `main` after milestone 4 merged. Read `docs/build-plan.md` (sections 1 to 3, 5, 11), `package.json` (scripts, engines, bin), `src/cli/args.ts` (flags), `docs/demo/README.md` and `docs/design/` from Tasks 2 and 3, and `.blueprint/` layout in `src/server/files.ts` (`SUBDIRS`, the gitignore lines).

Resolutions of things the brief leaves open:
- Use a screenshot from `docs/design/` (the board with a pending proposal is the best first image).
- Write for a developer who has Claude Code and has never seen Blueprint; no marketing tone.
- Follow the README from a fresh `git clone` of the local repository into `/tmp` (not from GitHub) using the fake SDK.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-5-report.md

It must contain: what you implemented, TDD evidence where applicable, manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
