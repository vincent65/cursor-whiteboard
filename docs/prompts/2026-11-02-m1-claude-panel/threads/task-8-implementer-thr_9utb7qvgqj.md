- **Status:** DONE_WITH_CONCERNS
- **Commit:** `3800404 feat(server): agent routes and wiring of the plan session`
- **Tests:** the new routes test file has 6 tests, all passing. `pnpm check` exits 0 with 110 tests passing and no lint or type errors. A real round trip through the SDK on the user's login returned `ready`, saved the session id to `sessions.json`, and closed cleanly.
- **Concerns:**
  1. I added one thing the brief didn't ask for: `canUseTool` automatically allows Blueprint's own two board-reading tools (matched on `mcpServer.source === "sdk"` and name `blueprint`). Without it, every board read opens a permission dialog, and the Task 10 end-to-end check expects none. I tried `allowedTools` first, but the SDK then prints a warning every time it starts. To get the brief's exact binding back, revert one ternary in `src/server/agent/index.ts`.
  2. I moved the JSON 404 for unknown `/api/*` paths from `startServer` into `createApp`. The brief's "404 JSON" test needs it there, and the server's behavior doesn't change.
  3. I couldn't see a resume succeed after a restart. The sandbox blocks the CLI from saving the session to `~/.claude/projects`, so after restarting, the panel showed the "starting fresh" message instead of the restored transcript. Resume is covered by tests and should be confirmed in the Task 10 end-to-end run.
- **Report:** `/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-8-report.md`
