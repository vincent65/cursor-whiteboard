### Task 8: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Use a fresh git repository with a remote you can push to (a throwaway GitHub repository) and `gh` authenticated, or without a remote to exercise the no-PR path. Compile and split a tiny plan (two tasks, the second depending on the first). Then:

1. Launch the first task with `acceptEdits`. Expected: a worktree at `.blueprint/worktrees/<slug>` on `blueprint/<slug>`, a card with `Working`, streaming tool rows, then `Done` with a PR link (or `Idle` with Claude's explanation when there is no remote), the cost, and `sessions.json` holding the record.
2. Try to launch the second task. Expected: the dialog lists the first task as `branch not merged into HEAD`; `Launch anyway` works.
3. With a run working, press `Stop`. Expected: the card goes `Idle`; send `Carry on` in its message box and see it resume working.
4. With a run working, restart the server. Expected: the card shows `Interrupted` with `Resume`; resuming continues the same session id and the transcript is intact.
5. Trigger a permission ask (a run in `default` mode doing a write). Expected: `Needs you` on the card, the dialog answers it, and `Stop` cancels a pending one.
6. Open the other sessions list. Expected: the terminal session you started by hand in the repository (`claude` run once) appears with a read-only transcript.

Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
