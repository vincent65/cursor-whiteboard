### Task 10: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Run `node dist/cli/index.js --no-open` in a fresh git repository and open the app. Draw two labeled boxes joined by an arrow. Then:

1. Select all three and ask `Add a cache between these two`. Expected: ghosts as in Task 8; `Reject` restores everything; `proposals.jsonl` logs `proposed` then `rejected`.
2. Ask `Draw the login flow as a flowchart` with nothing selected. Expected: ghosts to the right of all content; `Accept` makes them solid, grouped, and tagged `origin: "ai"` in the board file; the next message you send starts, in the server log or transcript, with the acceptance note.
3. Select one box and ask `Rename this to Dashboard and make it green`. Expected: a dashed box with the new label and color, the bar reads `1 changed`; press `Refine`, type `keep the old color`, Enter. Expected: a `revising p_…` row, the ghost is replaced in place, still one proposal pending; `Accept`.
4. Ask for a pie chart. Expected: a failed `proposing` row with the supported-kinds message and Claude recovering in text.
5. With a proposal pending, restart the server and reload. Expected: the bar reappears; `Accept` logs `accepted`.

Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
