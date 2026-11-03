### Task 8: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Run `node dist/cli/index.js --no-open` in a fresh git repository. Draw a small architecture (three labeled boxes and two arrows) and write a doc with two headings. Then:

1. Press `Compile`. Expected: a user row `Compile the plan into spec.md`, tool rows for reading the exports and a `Write` permission dialog for `spec.md`; allow it; `spec.md` has the six sections in order and citations to real ids; the spec view shows it with underlined citations and no dropped warning.
2. Click a board citation. Expected: the board opens with the element selected and centered. Click a doc citation. Expected: the doc opens scrolled to the heading.
3. Delete one cited box, save, and reopen the spec view. Expected: the dropped warning names it; the remaining citations still work.
4. Press `Split into tasks`. Expected: `Splitting…`, then cards in the tasks view with dependencies and source links, and `.blueprint/tasks/01-….md` files with JSON frontmatter; the split cost shows.
5. Press `Split into tasks` again while it runs (or right after). Expected: the second press is refused with the server's message and the files are replaced exactly once.

Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
