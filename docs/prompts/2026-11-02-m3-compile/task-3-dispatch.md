You are implementing Task 3: Compile, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 3: compile and tasks). This task adds the Compile action: a fixed instruction into the existing plan session.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-3-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m3-compile`, created from `main` after milestone 2 merged. Read `src/server/agent/prompt.ts` (the prompt constants and `composeUserMessage`), `src/server/agent/index.ts` (`Agent.send(text, selection?, proposalId?)` and how events flow through `onEvent`), `src/server/agent/session.ts` (`send(text, shown)` emits the `user` event; `result` events end a turn), `src/server/agentRoutes.ts`, and `test/server/agentRoutes.test.ts` (the `createAgent` wiring test with the fake sdk).

Resolutions of things the brief leaves open:
- `compile()` calls `session.send(COMPILE_INSTRUCTION, "Compile the plan into spec.md")` through the same path as `send` (notes included), remembers the returned id as pending, and clears it when a `result` event arrives (hook into the existing `onEvent` fan-out in `createAgent`).
- A `compile()` while one is pending returns the pending id and sends nothing.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-3-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
