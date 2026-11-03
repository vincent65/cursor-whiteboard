You are implementing Task 8: CLI, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-8-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Read these before you start: `src/server/index.ts` (`startServer({ root, port, uiDir? })`) and `src/server/files.ts` (`FileStore` with `init()`). The package's `bin` field already points at `dist/cli/index.js`, and `pnpm build` compiles `src/{cli,server,export,shared}` with `tsconfig.server.json` to `dist/`. The UI (Task 9) will be built to `dist/ui`, so the compiled CLI resolves `uiDir` as `../ui` relative to its own file.

Resolutions of things the brief leaves open:
- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions; resolve the CLI's own file with `import.meta.url` and `fileURLToPath`.
- `parseArgs` takes `process.argv.slice(2)`; `--port` requires a numeric value and throws on a missing or non-numeric one.
- `main()` is invoked at the bottom of `index.ts` only when the module is the entry point; keep `parseArgs` in `args.ts` so it is importable by tests without side effects.
- The brief's Step 4 runs `node dist/cli/index.js init` in this repository; `.blueprint/` is created here and its export and worktrees paths are already ignored by `.gitignore`. Do not commit `.blueprint/` contents.
- Follow TDD as the brief's steps say.

## Global constraints that bind this task

- Node 22 or later; TypeScript strict mode; ESM; no new dependencies.
- No "Claude Code" branding in CLI output.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists: `src/cli/index.ts`, `src/cli/args.ts`, `src/cli/open.ts`, `test/cli/args.test.ts` (plus `.gitignore` only if it actually changes).

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` once before committing; its output must be pristine. Run the brief's Step 4 build and init as well.
3. Commit as the brief's final step says.
4. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Self-Review Before Reporting

Completeness: both commands work from the compiled output; the three tests exist and pass. Quality: the browser opener never throws. Discipline: no extra files. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-8-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the build and init output, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
