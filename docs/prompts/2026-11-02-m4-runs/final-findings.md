# Milestone 4 final review findings and controller rulings (review thread thr_wxy98gjub6)

Full review: final-review-report.md in this directory. Fix every numbered item below in this wave.

## From the review
1. The run prompt's definition of done gains, as its first item: "Create and edit files with the Write and Edit tools, not shell redirection." Extend the runPrompt test.
2. `bypassPermissions` launches also pass `allowDangerouslySkipPermissions: true` (only for that mode); assert it in the launch test.
3. `done` is sticky: on `idle`, a run whose record already has a `prUrl` (or that was marked done, item 6) stays `done`. Test: a done run that gets a message and ends a turn without a URL stays done, and the gate still passes for it.
4. Widen `prUrlIn`: accept a PR URL on its own line with surrounding `<>`, Markdown link syntax `[text](url)`, a short label prefix such as `PR:` or `Pull request:`, bold markers, and trailing punctuation; if no line matches, fall back to the last `https://github.com/<o>/<r>/pull/<n>` anywhere in the text. Keep the existing tests and add one per wrapped form plus the fallback; an inline mention in prose is still accepted only through the fallback.
5. `createWorktree`'s two pre-checks throw `ExistsError` so the route answers 409, not 500.
6. Worktree paths are stored relative to the repository root in `sessions.json` (`.blueprint/worktrees/<slug>`) and resolved at use; records with absolute paths still load (resolve treats them as absolute).
7. `RunManager.list()` falls back to slugs for titles when `listTasks()` throws, logging one warning.
8. The sessions view clears its page-level error on the next successful load, clears a transcript retry's old error before refetching, and shows a run-transcript failure inside that card instead of at the top.
9. In run transcripts (and the panel), the result row reads `Turn done · $<cost> total` so it is not confused with a run's `Done` status; update the expectations.
10. `#patch` stops broadcasting `runs.changed` after `close()` began.

## From the acceptance run (ruled fix before merge)
11. `Mark done`: idle runs get a `Mark done` button on their card; it calls `POST /api/runs/:id/done` (204; 409 unless the run is idle; 404 unknown), which sets status `done` and `endedAt`. A user who merged by hand can then satisfy the gate. Tests on the manager, the route, and the card.

## From the Task 7 review (cheap, visible)
12. The launch dialog returns focus to the card's `Launch` button on close, and Escape from inside an open `<select>` does not close the dialog (stop propagation from the select). A failed gate check's error clears when the dialog next opens successfully.

## Deferred (do not address)
- Lazy transcript loading; squash and rebase merges (README note in M5); no recovery path for a run whose session and worktree are both unusable (README note in M5); the remaining test-only minors.
