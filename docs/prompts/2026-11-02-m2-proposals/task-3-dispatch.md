You are implementing Task 3: The propose and revise tools, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 2: ghost proposals). This task gives Claude its write path to the board: a validated proposal that the browser applies as ghosts before the tool returns.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-3-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`, created from `main` after milestone 1 merged. Read `src/server/agent/tools.ts` (how `tool()` and `createSdkMcpServer` are used, the `image()` helper), `test/server/agent/tools.test.ts` (the fake store and hub; tests reach handlers through the server's `_registeredTools`, keep that pattern), `src/server/ws.ts` (`request()` with `timeoutMs`; its `RequestBody` type distributes over the `ServerMessage` union, so adding a request kind in `src/shared/messages.ts` needs no change there), `src/server/agent/events.ts` (`summarizeTool`), and `src/server/agent/proposals.ts` from Task 2.

Resolutions of things the brief leaves open:
- Ghost filtering for `get_board`/`get_selection` happens on the stored elements before `excalidrawToBoardGraph`: drop elements whose `customData?.ghost === "add"`.
- The pending line is appended to the tool's text as `\n\nPending proposals: p_x (2 ops), p_y (1 op)` with the singular `1 op`.
- `revise` keeps the pending record's `board` and `title`; `propose` uses `hub.activeBoard` as the board.
- From the Task 2 review: `revise` must also check that the pending record's `board` equals `hub.activeBoard`, else throw `Error("proposal <id> belongs to board <board>, which is not open")`, so a revision can never move ghosts to another board; add that case to the tests.
- Errors thrown inside a handler reach Claude as tool errors through the SDK, as the read tools already rely on.

## Global constraints that bind this task

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials.
- Claude never edits board files directly: proposals are the only write path, and the `PreToolUse` guard from milestone 1 stays.
- AI edits are never applied without an accept step: every operation lands as a ghost first, and only `accepted` makes it real.
- Ghost styling: added elements at `opacity: 40` with `strokeStyle: "dashed"` and the proposal id prepended to `groupIds`; updated elements with `strokeStyle: "dashed"`; deleted elements at `opacity: 40` with `strokeStyle: "dashed"` and `strokeColor: "#e03131"`. Ghosts are not locked.
- Every element Blueprint creates or accepts carries `customData.origin: "ai"` and `customData.proposalId`.
- Placement: beside the anchor's bounding box with an 80 pixel gap to the right, top-aligned; several additions in one proposal stack downward with a 40 pixel gap; with nothing to anchor on, centered in the viewport.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; anything the importer turns into an image is rejected with a message naming those five kinds.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy; the panel is titled `Claude`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.
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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-3-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
