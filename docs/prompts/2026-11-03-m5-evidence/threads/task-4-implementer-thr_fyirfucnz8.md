- **Status:** DONE
- **Commits:**
  - e024279 fix(ui): without suggested rules an ask offers only Allow once and Deny, and the broker invents no rule
  - 5281636 fix(ui): a board tells the server it is open as soon as it mounts
  - 8007aef fix(ui): command rows show the command as code instead of in backticks
  - 1b00567 style(ui): a command in a tool row or ask is the same chip as inline code
  - 4582cf2 docs(demo): re-record the flows with the two-choice ask and command chips
- **Tests:** `pnpm check` is clean with 407 tests passing, and `pnpm e2e` passed 3 of 3. I re-recorded the demo because the ask and the command rows changed visibly.
- **Fix 2:** has a `BoardView` unit test with Excalidraw mocked out. A throwaway e2e check (since deleted) that sends a message right after creating a board failed without the fix and passed 3 of 3 with it.
- **Concerns:**
  1. The command chip also appears in the permission dialog, which shows the same text but wasn't named in the ruling.
  2. The command chip reuses the Markdown inline-code style so it matches the rest of the UI.
- **Report:** /Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-4-report.md
