Three follow-ups, in this thread, on branch `m4-runs`:

1. My Escape ruling caused a regression: with focus in the select on open, Escape no longer closes the dialog. Revert the select's Escape swallowing. A native select's open popup consumes its own Escape in browsers, so the original concern does not need handling. Escape anywhere in the dialog closes it again; keep the focus-return fix. Update the test to assert Escape from the focused select closes the dialog.
2. A run marked done by hand must stay done across a restart and resume. Add `markedDone: boolean` to `RunRecord` (records without it read as false), set it in `markDone`, and make the sticky-done rule `prUrl !== null || markedDone`. Test: mark done, simulate a restart that marks it interrupted, resume, end a turn without a URL → status done.
3. Log the bad-task-file warning once per distinct error message, not on every list load.

Run `pnpm check` once (pristine), commit with conventional messages and NO co-author trailer, append a "Fix round 2" section to final-fix-report.md, and end with the short status contract only.
