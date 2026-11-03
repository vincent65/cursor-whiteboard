You are fixing the findings of a whole-branch review for Blueprint, a local-first planning whiteboard that runs beside Claude Code. The repository at /Users/vincentyip/programming/cursor-whiteboard is on branch `m1-claude-panel`; milestone 1 (the Claude panel on the Claude Agent SDK) is complete and reviewed task by task. Read the design at docs/build-plan.md sections 4, 6.4, and 6.5, then the findings.

## Findings to address (all thirteen)

Read: /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/final-findings.md
The full review with the reviewer's evidence is beside it: final-review-report.md.

## Context you need

- Server code uses NodeNext resolution: relative imports need explicit `.js` extensions. `pnpm check` runs both typechecks, Biome, and Vitest; it must stay pristine.
- The agent module: `src/server/agent/session.ts` (`PlanSession`, `InputQueue`, `#consume`, `#stopRun`, `restore`, `interrupt`), `src/server/agent/events.ts` (`SdkEventMapper`, `summarizeTool`), `src/server/agent/index.ts` (`createAgent`), `src/server/agent/tools.ts`, and their tests under `test/server/agent/` with a fake SDK that scripts per-turn output. `test/server/agentRoutes.test.ts` holds the `createAgent` wiring test on a temp-dir store.
- The SDK's result message types are in `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (`SDKResultSuccess` with `is_error`, `result`, `num_turns`, `session_id`, `total_cost_usd`; the error subtypes carry `errors`). Transcript lines from `getSessionMessages` carry `uuid` and `parentUuid` besides the message.
- The watcher is `src/server/watch.ts` (chokidar, polling at 100 ms, `awaitWriteFinish` 100 ms) and the store is `src/server/files.ts` (atomic temp-file writes through a private `write`). Use `createHash("sha256")` from `node:crypto`.
- The panel is `src/ui/panel/ClaudePanel.tsx` with tests in `test/ui/ClaudePanel.test.tsx` (jsdom, Testing Library, API mocked). UI test files that render components start with `// @vitest-environment jsdom`.
- Never start a real Claude session to verify; every real turn spends the user's plan allowance. The unit tests with the fake SDK are the verification, plus `pnpm build`.

## Rules

- Fix all thirteen findings exactly as ruled; do not address anything else, including the deferred list.
- Follow TDD where a test is named: write the failing test, run it, implement, run it.
- Make one conventional commit per finding or per closely related pair (for example 9 and 10 together), each with NO co-author or generated-with trailer of any kind.
- Do not spawn subagents or reviewers.

## Report

Write your full report to:
/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/final-fix-report.md

It must contain, per finding: what you changed, the covering tests, the command, and its output; plus the final `pnpm check` and `pnpm build` output.

Then end your turn with ONLY this short message (under 15 lines):
- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commits created (short SHA + subject)
- One-line test summary
- Concerns, if any
- The report file path
