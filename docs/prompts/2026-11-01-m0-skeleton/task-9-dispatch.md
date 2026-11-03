You are implementing Task 9: UI shell, routing, and sidebar, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-9-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. The server is done: read `src/server/routes.ts` for the exact REST routes and status codes your `api.ts` calls, `src/shared/messages.ts` for `ServerMessage`, `src/shared/types.ts` for `IncomingScene`, and `src/export/schema.ts` for `BoardFile`. React 19, Vite, and Testing Library are installed; `test/setup.ts` loads jest-dom. Tasks 10 and 11 replace the stub components you create at `src/ui/docs/DocView.tsx` and `src/ui/board/BoardView.tsx` with real editors, so create those two files now as components that render nothing and accept `{ name: string }`.

Resolutions of things the brief leaves open:
- Design tokens: `DESIGN.md` does not exist in the repository, so use the fallback tokens from the plan's Task 0: font `system-ui, -apple-system, "Segoe UI", sans-serif` at 14px with line height 1.5; an 8px spacing grid; colors background `#ffffff`, surface `#f6f7f9`, border `#e3e6ea`, text `#1f2328`, muted `#656d76`, accent `#2563eb`; left rail 240px, right pane 360px, main fills the rest. Put them in `src/ui/styles.css` as CSS custom properties and use plain CSS classes; no CSS framework.
- Every UI test file that renders components or hooks starts with the line `// @vitest-environment jsdom`.
- `vite.config.ts` lives at the repository root with `root: "src/ui"`; `pnpm vite build` must produce `dist/ui/index.html`.
- pnpm 10 skipped esbuild's install script during bootstrap. If `vite build` fails because of esbuild, add `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` to package.json, run `pnpm install`, and include those changes in your commit.
- The hash router is a few lines in `App.tsx` reading `location.hash` and listening to `hashchange`; no routing library.
- Follow TDD as the brief's steps say.

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies beyond the plan's list.
- No "Claude Code" branding anywhere in UI copy; the right pane text is exactly `The Claude panel arrives in milestone 1.`
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists plus the two stub components and, if needed, the package.json and lockfile change above.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` and `pnpm vite build` once before committing; output must be pristine.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Self-Review Before Reporting

Completeness: every `api.ts` function in the brief's Interfaces block exists with the stated signature; the Sidebar test passes; the build succeeds. Quality: the layout uses the tokens; the WebSocket client reconnects with backoff. Discipline: no extra dependencies or files. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-9-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the build output, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
