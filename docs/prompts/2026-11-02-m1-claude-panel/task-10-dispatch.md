You are implementing Task 10: Robustness carried from milestone 0, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-10-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/ui/board/BoardView.tsx` (the watcher handler and the save `queue` ref) and `src/ui/docs/DocView.tsx` (the `replace` helper). CodeMirror's `history()` is part of `basicSetup`; `undoDepth` comes from `@codemirror/commands`, which `codemirror` depends on, so import it from there without adding a dependency if it resolves; otherwise report NEEDS_CONTEXT.

Resolutions of things the brief leaves open:
- `replaceFromDisk` keeps the main selection head clamped to the new length and dispatches one transaction with both `Transaction.remote.of(true)` and `Transaction.addToHistory.of(false)`; `DocView` uses it for silent reloads and Take theirs.
- In `BoardView`, the watcher handler awaits `queue.current` before fetching the board and comparing.
- Follow TDD as the brief says; the manual checks use `pnpm dev`.

## Global constraints that bind this task

- TypeScript strict; ESM; no new dependencies unless the brief adds one.
- No API key anywhere; the SDK runs on the user's Claude Code login.
- No "Claude Code" branding in UI copy; the panel is titled "Claude".
- Commit messages use conventional commits and carry NO co-author or generated-with trailer of any kind.
- Only the files the brief lists.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-10-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
