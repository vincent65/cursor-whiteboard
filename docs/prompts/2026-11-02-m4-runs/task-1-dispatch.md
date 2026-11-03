You are implementing Task 1: Run store and git helpers, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 4: runs and the sessions view). This is the foundation for runs: the serialized sessions.json writer and the git worktree helpers.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-1-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m4-runs`, created from `main` after milestone 3 merged. `createAgent` already takes `{ store, hub, cwd, sdk?, clock? }` and returns an `Agent` with a `proposals` field; add `runs` to its deps. Read `src/server/files.ts` (`readSessions`/`writeSessions`), `src/shared/types.ts` (`RunRecord`, `RunStatus`, `SessionsFile`), `src/server/agent/index.ts` (`onSessionId` writes the plan session id today with a `// ponytail:` note about serializing it; this task is that upgrade), `src/server/agent/proposals.ts` (`serial()` is the model for the promise chain), and the tests `test/server/files.test.ts` and `test/server/agentRoutes.test.ts` (the `createAgent` wiring test, which must adapt to the new `runs` dependency).

Resolutions of things the brief leaves open:
- `RunStore` is constructed with the store and loaded once in `startServer`; `createAgent` receives it as `deps.runs` and calls `setPlanSession` from `onSessionId` (the corrupt-file handling from milestone 1 stays: `load()` throwing is reported as the agent's startup error and runs start empty).
- Git helpers use `execFile` from `node:child_process` promisified with `{ cwd: root }`; the existence checks before `git worktree add` use `access` on the path and `git show-ref --verify --quiet refs/heads/<branch>`.
- Git tests create a temp repository with `git init -q`, one commit, and `user.name`/`user.email` set locally.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-1-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
