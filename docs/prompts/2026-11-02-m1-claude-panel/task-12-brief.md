### Task 12: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Run `node dist/cli/index.js --no-open` in a fresh git repository, open the app, draw two labeled boxes and an arrow, select them, and in the panel ask `Describe what I selected`. Expected: a `reading the selection` row, streaming text that names both boxes and the arrow, then `Idle` with a cost. Ask `List the files in this repository` and expect a permission dialog for Bash; choose `Allow once` and see the result. Click `Stop` during a long answer and see status return to `Idle`. Restart the server, reload, and ask `What was my first question?`; expect the restored transcript and a correct answer. Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
