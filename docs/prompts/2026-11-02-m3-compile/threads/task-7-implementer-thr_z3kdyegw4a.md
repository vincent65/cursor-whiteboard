- **Status:** DONE_WITH_CONCERNS
- **Commit:** `5c0d14f feat(ui): spec view with clickable citations and the tasks view`
- **Tests:** `pnpm check` is clean with 276 of 276 tests passing. `pnpm build` warns only about the existing chunk size. In the browser, clicking a citation opened the cited board element or doc heading, and the spec and task lists reloaded without a page reload.
- **Concerns:**
  1. I made two small edits outside the file list: the new kinds in `src/shared/messages.ts`, and an `export` on DocView's `theme` so the spec editor reuses it.
  2. TasksView also reloads when a task file changes on disk, not only after a split. Without this, hand-edited task files don't show until a page reload.
  3. `citationHash` removes `.md` from doc citations. Doc citations name the file (`notes.md`) but the route needs the doc name (`notes`), so without this every doc citation would open a missing doc.
  4. Not mine, but visible on these routes: the panel input still says "Ask Claude about this board" on the spec and tasks routes.
  5. I didn't run a real split because it starts a paid query on the user's login. I tested a rejected split instead.
- **Report:** `/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m3-compile/task-7-report.md`
