You are implementing Task 1: Repository bootstrap, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-1-brief.md

## Context

This is the first task of milestone 0. The repository at /Users/vincentyip/programming/cursor-whiteboard has no commits yet; you are on branch `m0-skeleton`. The design document is at docs/build-plan.md and the plan at docs/superpowers/plans/2026-11-01-m0-skeleton.md; you do not need to read either, the brief is complete. Everything under docs/ must be included in your commit, as the brief's commit step says. Later tasks add the export module, the server, the CLI, and the UI into the `src/{export,server,cli,ui,shared}` layout this task establishes.

Resolutions of things the brief leaves open:
- Use pnpm. If `pnpm` is not on PATH, run `corepack enable` first. Confirm `node --version` is 20 or later before starting.
- Use the latest stable release of each dependency; record the versions pnpm picked in your report.
- For Biome 2, use its current config schema (`files.includes` with negations) if `files.ignore` no longer exists; the intent is to skip `dist` and `test/export/fixtures`.
- `.DS_Store` exists untracked in the repo root; it is ignored by the `.gitignore` you write and must not be committed.

## Global constraints that bind this task

- Node 20 or later; TypeScript strict mode; ESM throughout.
- No "Claude Code" branding anywhere in package metadata or copy.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind. This is a hard rule from the repository owner.
- Do not create files outside the brief's list except what pnpm creates (`pnpm-lock.yaml`, `node_modules`).

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies.
2. Run the check as the brief's Step 6 says.
3. Commit as the brief's Step 7 says.
4. Self-review (below).
5. Write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

While iterating, run the focused command for what you are changing; run `pnpm check` once before committing.

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer. A reviewer is dispatched separately after you report.

## Self-Review Before Reporting

Completeness: every file in the brief exists with the specified contents; the scripts, configs, and smoke test match the brief. Quality: names and config are clean, nothing extra. Discipline: no files or dependencies beyond the brief. Testing: `pnpm check` passes with pristine output. Fix anything you find before reporting.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-1-report.md

It must contain: what you implemented, the exact commands you ran and their output for the check, the dependency versions installed, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines; the detail lives in the report file):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path

If BLOCKED or NEEDS_CONTEXT, put the specifics in that final message.
