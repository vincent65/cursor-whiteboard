You are implementing Task 11: Board view, for Blueprint, a local-first planning whiteboard that runs beside Claude Code.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-11-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m0-skeleton`. Read before you start: `src/ui/api.ts` (`getBoard`, `saveBoard`, `uploadBoardPng`, `assetUrl`, `connectWs`), `src/ui/hooks/useDebounced.ts` (from Task 10), `src/ui/App.tsx` (how `BoardView` is rendered with a `name` prop), `src/ui/styles.css`, the stub at `src/ui/board/BoardView.tsx` which you replace, `src/shared/types.ts` (`IncomingScene`, `IncomingFile`), and `src/export/schema.ts` (`BoardFile`). `@excalidraw/excalidraw` is installed; import its CSS once (`@excalidraw/excalidraw/index.css`). The server extracts image data URLs to assets on save and returns asset references, which is why `filesWithDataUrls` rebuilds data URLs on load.

Resolutions of things the brief leaves open:
- `test/ui/scene.test.ts` is pure and runs in the Node environment; it must not import Excalidraw. Keep `scene.ts` free of Excalidraw imports except types.
- `getSceneVersion` and `exportToBlob` come from `@excalidraw/excalidraw`; the Excalidraw component receives `initialData` only on first mount, and later external reloads go through the API's `updateScene` and `addFiles`.
- Importing a CSS file from TypeScript fails `tsc` until `tsconfig.json` lists `"vite/client"` in `types`; you may add that one entry to `tsconfig.json` (controller ruling), and import Excalidraw's CSS from `BoardView.tsx`.
- Component styles for the board view and its notice go in `src/ui/styles.css` using the existing tokens, not inline (controller ruling); include that file in your commit.
- The reload notice text is exactly `Board changed on disk. Reload to see it.` with a button labeled `Reload`.
- Follow TDD as the brief's steps say; the manual verification in Step 4 is done by you with `pnpm dev` and described in the report (what you did and what you observed), including the three-second checks on the files under `.blueprint/`.

## Global constraints that bind this task

- TypeScript strict mode; ESM; no new dependencies.
- Excalidraw element IDs are never regenerated or rewritten by Blueprint.
- Board files hold no embedded image data; the UI sends data URLs and the server extracts them.
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

## Before You Begin

If anything in the brief is unclear or contradictory, say so in your final message with status NEEDS_CONTEXT instead of guessing.

## Your Job

1. Implement exactly what the brief specifies, test first.
2. Run `pnpm check` and `pnpm vite build` once before committing; output must be pristine.
3. Do the manual verification from the brief's Step 4 and record what you observed.
4. Commit as the brief's final step says.
5. Self-review, then write the report and finish.

Work from: /Users/vincentyip/programming/cursor-whiteboard

## You Do Not Dispatch Subagents

Do all of this task's work yourself. Never spawn a subagent or a reviewer.

## Self-Review Before Reporting

Completeness: `toSaveBody` and `filesWithDataUrls` exist with the stated signatures; both tests pass; autosave, PNG export, and the external-change notice behave as specified. Quality: no redundant saves, no leaked timers. Discipline: no extra files or dependencies. Testing: pristine output.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-01-m0-skeleton/task-11-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), the manual verification steps and observations, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
