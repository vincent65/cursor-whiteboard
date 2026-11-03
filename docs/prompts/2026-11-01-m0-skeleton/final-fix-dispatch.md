You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`; milestone 0 is complete and reviewed task by task. Read the design at docs/build-plan.md sections 3 to 6 and 10 for context, then the findings.

## Findings to address (all five)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/final-findings.md

## Context you need

- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions. `pnpm check` runs both typechecks, Biome, and Vitest; it must stay pristine.
- Routes are tested with `app.request()` on a temp-dir `FileStore` in `test/server/routes.test.ts`; the server start and WebSocket live in `src/server/index.ts` and are tested in `test/server/ws.test.ts`. For the Host and Origin check, apply it in `createApp` for HTTP and in the WebSocket upgrade path in `startServer`; the port is known there.
- The slug rule today lives in `src/server/files.ts` (`assertSlug`). Move the regex to `src/shared/slug.ts` (export `SLUG_RE` and `slugify(input: string): string`) and use it from both the server and `src/ui/nav/Sidebar.tsx`.
- `src/ui/board/scene.ts` has `toSaveBody`; filter the files map there to ids referenced by non-deleted image elements, and add the case to `test/ui/scene.test.ts`.
- UI test files that render components or hooks start with `// @vitest-environment jsdom`.
- Excalidraw's accepted image MIME types: png, jpeg, gif, svg+xml, webp, bmp, avif, jfif, x-icon; choose a sensible extension for each.
- Verify by hand after the changes: `pnpm build`, run `node dist/cli/index.js --no-open` in a scratch git repository, confirm a cross-origin POST is refused and the app still works in the browser (create a board named "My Board" and see `my-board`). Stop the server afterwards.

## Rules

- Fix all five findings; do not address anything else.
- Follow TDD where a test is named: write the failing test, run it, implement, run it.
- Make one or more conventional commits with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/final-fix-report.md

It must contain, per finding: what you changed, the covering tests, the command, and its output; plus the manual observations and `pnpm check` output.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
