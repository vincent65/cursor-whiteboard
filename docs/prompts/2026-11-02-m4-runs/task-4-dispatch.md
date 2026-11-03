You are implementing Task 4: Gating, run routes, and server wiring, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 4: runs and the sessions view). This task exposes runs over HTTP and gates launches on merged dependencies.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-4-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m4-runs`, created from `main` after milestone 3 merged. Read `src/server/runs/manager.ts` from Task 3, `src/server/agentRoutes.ts` (route style, Zod bodies, `NotFoundError` mapping through `app.onError`), `src/server/app.ts` (`createApp(store, agent?)`, which takes the proposal store from `agent.proposals`, and `statusFor`; add `runs?: RunManager` as a third parameter), `src/server/index.ts` (`startServer`), `src/shared/tasks.ts`, and `test/server/agentRoutes.test.ts` (route tests with fakes).

Resolutions of things the brief leaves open:
- `startServer` currently builds the `RunStore` inline inside the `createAgent` call; lift it into a variable and pass the same instance to the `RunManager` (one store, one write chain).
- `patchRun` copies `undefined` values from a patch; build patches only from defined fields, or make `patchRun` skip undefined keys and add a test.
- `checkGate` resolves each `dependsOn` slug against the newest run for that slug; `isAncestor` is called only for `done` runs.
- A 409 from the gate carries `{ error: "dependencies are not merged", missing }`; `override: true` skips the gate.
- Add a `GateError` (or reuse `ExistsError`) mapped to 409 in `statusFor` rather than a route-local try/catch.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m4-runs/task-4-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
