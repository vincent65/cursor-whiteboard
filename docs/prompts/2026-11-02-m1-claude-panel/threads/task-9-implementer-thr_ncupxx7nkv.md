- **Status:** DONE_WITH_CONCERNS
- **Commit:** `b48910b feat(ui): the Claude panel with streaming transcript, permissions, and selection chips`
- **Tests:** `pnpm check` passes cleanly (119 tests in 25 files). `pnpm build` succeeds with only the chunk-size warning that was already there. A run with my real login confirmed the selection chips, the `reading the selection` row, streaming text, the permission dialog, and `Idle` with a cost.
- **Fixed after the run:** it found three bugs, each fixed test-first:
  - The user's message showed the server's internal selection header, including element ids.
  - A tool row disappeared while its permission dialog was open.
  - Transcript rows collapsed to 0px tall.
- **Concerns:**
  1. Clicking Stop sets the status to `Error: [ede_diagnostic] …` instead of `Idle`. This is the interrupt issue flagged in Task 6. The server reports it and the panel just shows it, so Task 12's Stop check will fail until the server handles an interrupted turn.
  2. Stop is also enabled while a permission dialog is waiting (`Needs you`), not only while working.
  3. `.gitignore` ignored all of `src/ui/public/`, so I narrowed it to `src/ui/public/fonts/` to commit the favicon.
- **Report:** `/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m1-claude-panel/task-9-report.md`
