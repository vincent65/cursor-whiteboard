You are implementing Task 4: Polish backlog, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 5: evidence and polish). This clears the visible rough edges deferred from milestones 1 to 4.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-4-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m5-evidence`, created from `main` after milestone 4 merged. Each item names its area; read the files involved before changing them. Relevant entry points: `src/ui/App.tsx` (sidebar refresh on file-changed), `src/ui/panel/PermissionDialog.tsx` and `src/shared/panel.ts` (pending permission shape; carry a `canAlways: boolean` from the broker based on whether suggestions were sent), `src/server/agent/events.ts` (`summarizeTool`, the non-text result text), `src/ui/sessions/SessionsView.tsx`, `src/ui/plan/LaunchDialog.tsx`, `src/server/runs/{store,git,gate,manager}.ts`, `src/server/agent/index.ts` (`compile`), `src/ui/panel/ClaudePanel.tsx` and `src/ui/sessions/RunCard.tsx` (Stop).

Resolutions of things the brief leaves open:
- For item 4, add `branch` to the gate response (`GET /api/runs/gate/:slug`) from the server's own naming, and render it.
- For item 8, `Stopping…` shows from the click until the next status other than working or needs_you arrives.
- Item 0 (the "Logi / n" label wrap) was fixed in Task 2 (commit 6692890, labels measured in Excalifont); confirm it in your browser pass and do nothing else for it.
- Item 9 (seen in the demo video): the panel shows the propose tool's raw result `{"proposalId":"p_3f004e69"}` as a tool-result row. Blueprint's own tool results read as sentences: propose and revise → `proposal p_3f004e69 is on the board`, get_board → `read the board`, get_selection → `read the selection`; failures keep their message. Do it in `src/server/agent/events.ts` where tool results are summarized, with tests.
- Item 10: tool rows show paths relative to the session's working directory (`editing src/login.ts`, not `/private/var/.../src/login.ts`), in `summarizeTool`.
- Item 11 (e2e hygiene from the Task 2 review): in `e2e/scenario.json` move the run's ask after the write so the story is write, then push; in `e2e/flows.spec.ts` fail with a named error when a test has no `DEMO_NAMES` entry; in `e2e/fixtures.ts` register the temp dir for cleanup before running the seed.
- Item 12 (seen in the design screenshots): a run's transcript opens with the whole run prompt as a user bubble. Launch and the no-session resume send the full prompt but show `Start task <slug>` (PlanSession.send(text, shown) already supports this); restored transcripts map a saved prompt that starts with the run prompt's first line to the same label.
- Item 13: the panel and run transcripts render `[[board:…#…]]` and `[[doc:…#…]]` in assistant text as the same citation chips the spec uses (the `Markdown` citation hook from Task 3), so Claude's replies link to the board too.
- Item 14: correct the `ponytail:` comment at the top of `src/ui/markdown.tsx`: a blank line inside a nested list ends the whole outer list (the remaining nested items render as a separate top-level list).
- Last step: run `pnpm e2e` three times and `pnpm demo` once, so the committed videos show the restyle and the polished rows; look at the end frame of each video and fix anything that looks off.
- One commit per item.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-4-report.md

It must contain: what you implemented, TDD evidence where applicable, manual observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
