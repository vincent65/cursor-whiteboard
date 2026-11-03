- **Status:** DONE_WITH_CONCERNS
- **Commit:** `07dc67e feat(server): a fake SDK mode that replays a scenario`
- **Tests:** 15 new tests in `test/server/fake/sdk.test.ts`, including a full `startServer` check that the plan session, split, a run and the sessions routes all use the fake. `pnpm check` is clean (367 tests). `pnpm build` warns only about the old chunk size. I also did a manual run with the built app: ask, accept, compile, split and launch all completed against the fake, and the run ended Done with its PR link.
- **Concerns:**
  1. The compile scenario cites `[[board:main#login]]`, but accepted ghost elements get random ids, so the citation is dropped in a fresh flow. Task 2's fixture needs to seed board `main` with a box whose id is `login`.
  2. Unrelated UI bug I saw but didn't fix: after Accept, the "Login" label wraps to "Logi" + "n", and the "n" overlaps the arrow. The task limits which files I can change, so I left it for the polish work.
  3. The browse skill added `.gstack/` to `.gitignore`; I reverted it. Its browser couldn't start inside the sandbox, so I used the Playwright browser instead.
- **Report:** `/Users/vincentyip/programming/cursor-whiteboard/.superpowers/sdd/2026-11-03-m5-evidence/task-1-report.md`
