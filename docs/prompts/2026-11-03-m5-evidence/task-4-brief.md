### Task 4: Polish backlog

**Files:** as each item needs; tests beside each change.

Fix each of these, test first where it is behaviour:

1. The sidebar drops a board or doc deleted on disk (refetch the lists on an `unlink` file-changed event).
2. `Allow always` is labelled `Allow for this session` when the SDK sent no permission suggestions, so it never promises more than it does.
3. Tool rows for `ToolSearch` read `loading tools`, and a non-text tool result reads `done` instead of `(non-text result)`.
4. The sessions view's other-session transcript and the launch dialog's gate snapshot refresh on `runs.changed`; the launch dialog shows the branch name the server will use (from the gate response, not rebuilt in the UI).
5. `RunStore`: test `newRunId`'s retry against a stored run, a write after a failed write, and `isAncestor`'s re-throw.
6. A failed run's `endedAt` does not move when only its failure message changes; test a restored failure reason through a re-derive.
7. `compile()` reads docs with skip-and-warn like boards, so one unreadable doc does not fail the compile.
8. Stop shows `Stopping…` on the button between the click and the interrupt landing (Stop takes several seconds).

- [ ] **Step 1 per item: failing test, fix, passing test.**
- [ ] **Step 2: `pnpm check` and `pnpm e2e`.**
- [ ] **Step 3: Commit per item**, conventional messages.

---

