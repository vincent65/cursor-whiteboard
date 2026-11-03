You are implementing Task 8: Milestone acceptance, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 4: runs and the sessions view). This is the end-to-end check of milestone 4 with your real Claude Code login.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-8-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m4-runs`, created from `main` after milestone 3 merged. Follow the brief's acceptance script on a fresh scratch repository using the built CLI; do NOT create any GitHub repository or push anywhere (that publishes on the user's account); use a local scratch repository with no remote, so step 1 exercises the no-PR path (the card ends Idle with Claude's explanation), and test the PR-link path by checking that a final message with a PR URL line would mark the run Done through the existing unit tests. Drive the browser with the Playwright MCP tools if they are available, otherwise gstack's browse tool; if neither can start, say so and describe what you could verify with curl. If a step fails, fix the smallest thing that makes it pass within the plan's file structure, keep `pnpm check` green, and commit with a conventional message and no trailer; otherwise make no commit. Stop any server you started and every run you launched. Revert any file a browser tool adds to the repository.

Resolutions of things the brief leaves open:
- A failed run is retried by sending it a message (it continues in the same worktree); include that in step 3 or 5 if a run fails.
- Every real turn spends the user's plan allowance: keep the tasks tiny (one-file changes) and run each acceptance step once.
- Only files the run proves must change may change.
- `prUrlIn` accepts only a line that is exactly a GitHub PR URL. If the real run prints the link wrapped (Markdown bold, angle brackets, a trailing slash) and the card stays Idle instead of Done, widen `prUrlIn` to tolerate those wrappers with tests, as the smallest fix.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-8-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
