You are implementing Task 11: Mermaid parser test over the golden blocks, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 1: the Claude panel).

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-11-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`. Read `src/export/markdown.ts`, `test/export/markdown.test.ts` (its graph fixtures are reusable), and `test/export/fixtures/basic.md`. The test extracts fenced mermaid blocks with a regex over the Markdown and parses each with `mermaid.parse` in a jsdom test.

Resolutions of things the brief leaves open:
- `mermaid.parse(text)` resolves truthy for valid input and rejects otherwise; call `mermaid.initialize({ startOnLoad: false })` once.
- If jsdom lacks an API mermaid needs at import time, stub the smallest thing (for example `DOMPurify` is bundled; `SVGElement.getBBox` may need a no-op) and note it in the report.
- Follow the brief's steps, including the deliberate temporary breakage to prove the harness catches failures.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-11-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
