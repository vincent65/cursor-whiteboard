You are implementing Task 4: Prompt, guard copy, agent wiring, and proposal routes, for Blueprint, a local-first planning whiteboard that runs beside Claude Code (milestone 2: ghost proposals). This task wires the store and tools into the running agent and exposes decisions and refine requests over HTTP.

## Task Description

Read your task brief first — it is your requirements, with the exact values to use verbatim:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-4-brief.md

## Context

The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m2-proposals`, created from `main` after milestone 1 merged. Read `src/server/agent/index.ts` (`createAgent`, the `canUseTool` bypass for Blueprint's own tools, `onSessionId`), `src/server/agent/session.ts` (`send(text)` emits the `user` event; the `shown` parameter is new), `src/server/agentRoutes.ts`, `src/server/app.ts` (its `onError` already maps `NotFoundError` to 404, so throwing one from a route is enough), `src/server/index.ts` (`close()`), the prompt and hooks modules with their tests, and `test/server/agentRoutes.test.ts` (the `createAgent` wiring test with a fake sdk).

Resolutions of things the brief leaves open:
- The hook test that asserts the old denial text is updated to the new text verbatim.
- `Agent.send` composes `text = composeUserMessage(typed, header, notes)` and calls `session.send(text, typed)`; the `user` event therefore shows what the user typed.
- Seed pending proposals in tests by writing a `proposals.jsonl` into the temp store before `createAgent`.
- Do not touch `src/ui/panel/ClaudePanel.tsx`; Task 9 removes the header-stripping code there.
- Three rulings from the Task 3 review, which add `src/server/agent/tools.ts`, `src/server/agent/proposals.ts`, and their tests to your file list:
  - `ProposalStore` gains `beginRevise(id)` / `endRevise(id)`; `decided()` throws `Error("proposal <id> is being revised")` while a revise round trip is in flight, and the `revise` tool brackets its browser round trip with them (also on failure). The decision route maps that error to 409.
  - `checkIds` in the tools treats `add` ghosts (elements with `customData.ghost === "add"`) as unknown ids, matching what the board reads show.
  - The pending line names only the board being read: `Pending proposals on this board: p_x (2 ops)`; proposals for other boards are not listed. Update the Task 3 test expectation.
- Send gating (carried from the milestone 1 final review, now in the brief): `PlanSession` keeps its own queue of sends and hands exactly one to the SDK per turn, releasing the next only after the previous `result` event; `interrupt()` drops the whole held queue with the existing `Message not sent: stopped` events. The `InputQueue` the SDK iterates then never holds more than the current turn's message. Update the milestone 1 tests that modelled the old behaviour rather than deleting them.
- Ruling from the Task 1 review: if `ProposalStore.load()` throws at startup (a corrupt or torn `proposals.jsonl`), `createAgent` must not reject; it reports the same kind of startup error status the corrupt `sessions.json` path uses, with the message `proposals.jsonl could not be read: <reason>. Fix or delete .blueprint/proposals.jsonl.`, and continues with no pending proposals (appends still work). Add that case to the wiring test.
- The restore-failed message with the cause uses the thrown error's `message`; keep the existing constant for the prefix.

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

Write your full report to /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-4-report.md

It must contain: what you implemented, TDD evidence (RED and GREEN commands with output), manual observations if any, files changed, self-review findings, and any concerns.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
