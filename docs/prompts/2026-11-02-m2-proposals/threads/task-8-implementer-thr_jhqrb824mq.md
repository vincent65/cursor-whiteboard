- **Status:** DONE_WITH_CONCERNS
- **Commit:** `a8d2db0 feat(ui): the board applies proposals as ghosts and decides them`
- **Tests:** `pnpm check` is clean (197/197); `pnpm build` warns only about the old chunk size. I tested by hand with your real login: reject, accept, reload rebuilding the bar, and the 404 warning path all work.
- **Concerns:**
  1. Claude says it gets no id for arrows from the board Markdown, so it can't delete an arrow. In the cache test it deleted both boxes instead, and the arrow never turned red. This is a server-side issue outside Task 8.
  2. The 404 is detected by the server's message text ("is not pending"), because `api.ts` (not in my file list) throws without the status code.
  3. I added a version bump in the shared helper. Without it, a reject or accept doesn't change the scene version, so it isn't saved, isn't undoable, and the bar doesn't update.
  4. I changed `.proposals-bar` to `bottom: 64px`. At 16px it covered the zoom, undo and help buttons.
- **Report:** `/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-02-m2-proposals/task-8-report.md`
