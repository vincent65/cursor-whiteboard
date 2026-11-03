# Milestone 4 final review fixes

Branch `m4-runs`, from `ff078c0`.
All twelve findings in final-findings.md are fixed, in twelve commits.
None of the commits has a co-author or generated-with trailer.
For each finding I wrote or changed the test first, ran it and saw it fail, then wrote the fix and ran it again to see it pass.
No real Claude session was started and nothing was pushed.

## Commits

| Finding | Commit | Subject |
|---|---|---|
| 1 | `133db36` | fix(runs): the run prompt asks for the Write and Edit tools, not shell redirection |
| 2 | `6a26e61` | fix(runs): bypassPermissions launches allow skipping permissions |
| 3 | `ee4fcbe` | fix(runs): a done run stays done after a turn with no PR URL |
| 4 | `1265390` | fix(runs): find a PR URL in labels, links, brackets, and bold, or anywhere as a last resort |
| 5 | `6510e33` | fix(runs): an existing worktree or branch is a conflict (409), not a server error |
| 6 | `64fd5b5` | fix(runs): sessions.json stores worktree paths relative to the repository |
| 7 | `2c20503` | fix(runs): the run list falls back to slugs when a task file cannot be read |
| 10 | `7a250fc` | fix(runs): a run write landing after close broadcasts nothing |
| 11 | `b4246aa` | feat(runs): mark an idle run done by hand so its dependents can launch |
| 8 | `e49949f` | fix(ui): the sessions view clears a failed load and shows a failed run transcript in its card |
| 9 | `aec4a43` | fix(ui): a transcript's result row reads Turn done, not the run's Done |
| 12 | `05a0d08` | fix(ui): the launch dialog returns focus, keeps Escape in its select, and clears a stale gate error |

## 1. Run prompt: Write and Edit, not shell redirection

Change: `src/server/runs/prompt.ts`.
The definition of done now starts with "1. Create and edit files with the Write and Edit tools, not shell redirection.", and the four items after it are renumbered 2 to 5.

Tests: `test/server/runs/prompt.test.ts`.
"runPrompt carries the task, ..." now expects the full new definition of done and checks that the new line is item 1.

Command and output (red, before the fix):

```
$ npx vitest run test/server/runs/prompt.test.ts
 Tests  1 failed | 3 passed (4)
```

Green, after the fix, together with the manager tests that build the prompt:

```
$ npx vitest run test/server/runs/prompt.test.ts test/server/runs/manager.test.ts
 Test Files  2 passed (2)
      Tests  16 passed (16)
```

## 2. `allowDangerouslySkipPermissions` for bypassPermissions

Change: `src/server/runs/manager.ts` `#open`.
The session options now include `allowDangerouslySkipPermissions: record.permissionMode === "bypassPermissions"`.

Tests: `test/server/runs/manager.test.ts`.
The launch test (bypassPermissions) checks that the flag is `true`.
The permission test (default mode) checks that it is `false`.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
   × launch creates a worktree, a working record, and sends the run prompt
   × permission asks mark the run needs_you and stop cancels them
      Tests  2 failed | 10 passed (12)
$ npx vitest run test/server/runs/manager.test.ts      # green
      Tests  12 passed (12)
```

## 3. `done` is sticky

Change: `src/server/runs/manager.ts` `#fromSession`.
In the `idle` case, the run is done if the last turn printed a PR URL or if the record already has a `prUrl`.
Finding 11 adds a third condition: the run was already done (see below).

Tests: `test/server/runs/manager.test.ts`, "a turn ending with a PR URL makes the run done ...".
In that test, a done run gets "also fix the typo" and its turn ends with no URL.
The test now expects the statuses `["done", "working", "done"]`.
It expects the saved record to have status `done`, the same `prUrl`, and an `endedAt`.
It also checks that `checkGate` passes for a task that depends on the run, using `manager.records()` and a merged branch.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
   × a turn ending with a PR URL makes the run done with prUrl and cost; without one it is idle
      Tests  1 failed | 11 passed (12)
$ npx vitest run test/server                            # green
      Tests  188 passed (188)
```

## 4. Wider `prUrlIn`

Change: `src/server/runs/prompt.ts`.
`prUrlIn` reads the lines in order.
On each line it removes `**` bold markers, then a short label at the start (letters, digits, and spaces, then a colon and whitespace, such as `PR:` or `Pull request:`), then trailing `.,;:!`.
The line matches if what is left is the bare URL, `<url>`, or `[text](url)`.
The first line that matches gives the URL.
If no line matches, `prUrlIn` uses the last `https://github.com/<o>/<r>/pull/<n>` anywhere in the text.
That fallback skips a URL that has more path after it, so a `/pull/7/files` link does not count.
Because the label must be followed by whitespace, `https:` is never taken as a label.

Tests: `test/server/runs/prompt.test.ts`.
The tests that were already there still pass.
One test changed because of the ruling: an inline mention alone used to give `null` and now comes through the fallback.
That test is now "prUrlIn finds a PR URL on its own line before any inline mention", and it checks that a URL on its own line wins over a later inline one.
A new `test.each` has one case per wrapped form:
- angle brackets
- a Markdown link
- a Markdown link with the URL as its text
- a `PR:` label
- a `Pull request:` label
- a bold label
- a bold URL
- trailing punctuation
- a label, a link, and punctuation together

A new fallback test checks three things:
- an inline mention in prose is found
- of two inline URLs, the last one is used
- "No PR: gh is not installed." gives `null`

```
$ npx vitest run test/server/runs/prompt.test.ts       # red
      Tests  10 failed | 4 passed (14)
$ npx vitest run test/server/runs/                      # green
      Tests  32 passed (32)
```

## 5. Worktree and branch conflicts are 409

Change: `src/server/runs/git.ts`.
Both pre-checks in `createWorktree`, for the worktree path and for the branch, now throw `ExistsError`, which `statusFor` maps to 409.

Tests:
- `test/server/runs/git.test.ts`: both refusals are checked to be `ExistsError`, with the same messages as before.
- `test/server/runRoutes.test.ts`: a new test, "a launch whose worktree is already there is a conflict (409), not a server bug". The fake manager's launch calls the real `createWorktree` against a worktree directory that already exists. The test checks for a 409 with the message that names the path, and that `console.error` was not called.

```
$ npx vitest run test/server/runs/git.test.ts test/server/runRoutes.test.ts   # red
      Tests  2 failed | 4 passed (6)
$ npx vitest run test/server/runs/git.test.ts test/server/runRoutes.test.ts   # green
      Tests  6 passed (6)
```

## 6. Worktree paths relative to the root

Changes:
- `src/server/runs/manager.ts`: `launch` stores `relative(root, worktree)`, which gives `.blueprint/worktrees/<slug>`. A new `#worktree(record)` resolves the path against the root. A record saved with an absolute path resolves to itself, so old records still load. `#open` uses the resolved path for the session `cwd`, which is also the `dir` for `getSessionMessages` on restore, and for the board-write guard roots. `list()` sends the resolved path to the UI, so the copied resume command (`cd <abs> && claude --resume`) works from any directory.
- `src/shared/types.ts` and `src/shared/runs.ts`: comments say which form each type holds.

Tests: `test/server/runs/manager.test.ts`.
- The launch test checks that the returned record and the record in `sessions.json` both hold `.blueprint/worktrees/alpha`. It also checks that the session `cwd` is the absolute path and that the view holds the absolute path.
- The restart test uses records saved with absolute `/w/...` paths. It still checks `getSessionMessages(..., { dir: "/w/run_aaaaaa" })` and `cwd: "/w/run_aaaaaa"`, which shows that old records still load.
- The `saved()` helper now resolves the worktree from disk before it compares the record with the view.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
   × launch creates a worktree, a working record, and sends the run prompt
      Tests  1 failed | 11 passed (12)
$ npx vitest run test/server                            # green
      Tests  199 passed (199)
```

## 7. `list()` survives a bad task file

Change: `src/server/runs/manager.ts` `list()`.
If `listTasks()` rejects, `list()` logs one `console.warn` (with the error) for that call and uses each run's slug as its title.

Tests: `test/server/runs/manager.test.ts`, at the end of the launch test.
`store.listTasks` is made to reject once with "02-beta.md: bad frontmatter".
The test checks that `list()` still returns the run titled by its slug, and that `console.warn` was called once with that error.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
      Tests  1 failed | 11 passed (12)
$ npx vitest run test/server/runs/manager.test.ts      # green
      Tests  12 passed (12)
```

## 8. Sessions view errors

Changes:
- `src/ui/sessions/SessionsView.tsx`:
  - A successful `listRuns` that is the newest request clears the page-level error.
  - Run transcript failures now go into a per-run `transcriptErrors` map, not the page error.
  - `expand` clears that run's error before it fetches again.
  - In the other-session row, `toggle` clears the old error before it fetches again. Before this, a retry that succeeded still showed the old error, because the error took precedence when rendering.
- `src/ui/sessions/RunCard.tsx`: a new optional `transcriptError` prop, shown as `role="alert"` inside the card's open transcript.

Tests: `test/ui/SessionsView.test.tsx`.
- "SessionsView clears a failed load on the next good one and shows a failed transcript in its card":
  - A failed load shows an alert.
  - After `runs.changed`, a good load removes it.
  - A failed run transcript shows its alert inside that card, and it is the only alert on the page.
  - Hiding and showing the transcript again fetches it a second time. The old alert is gone while that fetch is pending, and the empty transcript then renders.
- "an other session's transcript retry clears its old failure": a failure, then closing and opening again, gives the transcript with no alert.

```
$ npx vitest run test/ui/SessionsView.test.tsx         # red
   × SessionsView clears a failed load on the next good one and shows a failed transcript in its card
   × an other session's transcript retry clears its old failure
      Tests  2 failed | 2 passed (4)
$ npx vitest run test/ui/SessionsView.test.tsx test/ui/RunCard.test.tsx   # green
      Tests  6 passed (6)
```

## 9. "Turn done"

Change: `src/ui/panel/TranscriptList.tsx`.
The result row now reads `Turn done · $<cost> total`; an interrupted turn still reads `Stopped`.
`TranscriptList` is shared, so the change applies to run transcripts, the panel, and other-session transcripts.

Tests:
- `test/ui/ClaudePanel.test.tsx` now expects `Turn done · $0.0123 total`.
- `test/ui/RunCard.test.tsx` adds a result event to the card's transcript and expects `Turn done · $0.2500 total`.

```
$ npx vitest run test/ui/ClaudePanel.test.tsx test/ui/RunCard.test.tsx    # red
      Tests  2 failed | 9 passed (11)
$ npx vitest run test/ui                                                    # green
      Tests  105 passed (105)
```

## 10. No `runs.changed` after `close()`

Change: `src/server/runs/manager.ts` `#patch`.
When a write succeeds, `runs.changed` is broadcast only if `#closing` is not set.

Tests: `test/server/runs/manager.test.ts`, "a write that lands after close broadcasts nothing".
The store's `writeSessions` is held back for the write that carries the session id.
The test closes the manager, clears `sent`, and lets the write land.
It checks that the record was saved and that nothing was broadcast.
My first version of the test passed before the fix, because the manager's `.then` runs a few microtasks after `runs.settled()` resolves.
I added a macrotask wait, and then the test failed for the right reason before the fix.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
AssertionError: expected [ { type: 'runs.changed' } ] to deeply equal []
      Tests  1 failed | 12 passed (13)
$ npx vitest run test/server/runs/manager.test.ts      # green
      Tests  13 passed (13)
```

## 11. Mark done

Changes:
- `src/server/runs/manager.ts`:
  - New `markDone(runId)`. It throws `NotFoundError` for an unknown run and `ExistsError` (`run <id> is <status>, not idle`) unless the run is idle.
  - When the run is idle, `markDone` sets the session's base status to `done` and derives the status again. That patches `status: "done"` and `endedAt`, and broadcasts `run.status`.
  - `Live` gets a `done` flag. It starts as `record.status === "done"` and becomes true whenever the run is derived as done.
  - On `idle`, the status is `done` if the turn printed a PR URL, the record has a `prUrl`, or `live.done` is set. A marked run therefore stays done through later turns, and after a restart, because its saved status is `done`.
- `src/server/runRoutes.ts`: `POST /api/runs/:id/done` answers 204. A run that is not idle gives 409 and an unknown run gives 404, through `statusFor`.
- `src/ui/api.ts`: new `runDone`.
- `src/ui/sessions/RunCard.tsx`: a `Mark done` button, shown only for an idle run, calls the new `onDone` handler.
- `src/ui/sessions/SessionsView.tsx`: passes `onDone` through to `api.runDone`.

Tests:
- `test/server/runs/manager.test.ts`, "markDone makes an idle run done, and it stays done through later turns and restarts":
  - A working run gives 409 and an unknown run gives 404.
  - An idle run becomes done with `endedAt`, and the statuses are `["idle", "done"]`.
  - Marking a done run again is a conflict.
  - The gate passes for a dependent task.
  - A later turn with no URL leaves the run `done`.
  - After a restart with a new manager, a further message still ends in `done`.
- `test/server/runRoutes.test.ts`: the forwarding test covers 409 for a working run with its message, 404 for an unknown run, and 204 for an idle one.
- `test/ui/RunCard.test.tsx`: the per-status table now has a "Mark done" column, which is true only for idle, and clicking the button calls `onDone`.
- `test/ui/SessionsView.test.tsx`: after a `run.status` idle event, clicking "Mark done" calls `api.runDone("r2")`.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
TypeError: manager.markDone is not a function
      Tests  1 failed | 13 passed (14)
$ npx vitest run test/server                            # green after the manager change
      Tests  201 passed (201)
$ npx vitest run test/server/runRoutes.test.ts          # red, then green after the route
      Tests  1 failed | 3 passed (4)
      Tests  4 passed (4)
$ npx vitest run test/ui/RunCard.test.tsx               # red
      Tests  1 failed | 1 passed (2)
$ npx vitest run test/ui/RunCard.test.tsx test/ui/SessionsView.test.tsx   # green
      Tests  4 passed (4)
$ pnpm check                                            # before the commit
      Tests  347 passed (347)
```

## 12. Launch dialog: focus, Escape, stale gate error

Changes:
- `src/ui/plan/LaunchDialog.tsx`: the `<select>` stops an Escape keydown from propagating, so it never reaches the dialog's close handler.
- `src/ui/plan/TasksView.tsx`:
  - Closing the dialog, by Cancel or by Escape, records the task's slug.
  - The card's `Launch` button takes focus through a ref callback when it mounts again for that slug.
  - Gate-check failures now have their own `gateError` state, which clears when a gate check next opens the dialog. Load and split errors keep their old rule: they show until the next split starts.

Tests:
- `test/ui/LaunchDialog.test.tsx`, "LaunchDialog closes on Cancel and on Escape, but not on Escape in the select": Escape with the focus in the select does not call `onClose`.
- `test/ui/TasksView.test.tsx`:
  - "a failed gate check shows as an error and opens no dialog" now goes on: the next gate check succeeds, the dialog opens, and the alert is gone.
  - New: "closing the launch dialog returns focus to the card's Launch button". After Cancel, and after Escape from inside the dialog, the card's `Launch` button has focus.

```
$ npx vitest run test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx   # red
   × LaunchDialog closes on Cancel and on Escape, but not on Escape in the select
   × a failed gate check shows as an error and opens no dialog
   × closing the launch dialog returns focus to the card's Launch button
      Tests  3 failed | 9 passed (12)
$ npx vitest run test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx   # green
      Tests  12 passed (12)
```

## Final re-runs per file group (at `05a0d08`)

```
== npx vitest run test/server/runs/prompt.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)
== npx vitest run test/server/runs/manager.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)
== npx vitest run test/server/runs/git.test.ts test/server/runRoutes.test.ts
 Test Files  2 passed (2)
      Tests  6 passed (6)
== npx vitest run test/ui/RunCard.test.tsx test/ui/SessionsView.test.tsx
 Test Files  2 passed (2)
      Tests  6 passed (6)
== npx vitest run test/ui/ClaudePanel.test.tsx test/ui/RunCard.test.tsx
 Test Files  2 passed (2)
      Tests  11 passed (11)
== npx vitest run test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

## Final `pnpm check` (exit 0)

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 132 files in 125ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard

 Test Files  51 passed (51)
      Tests  350 passed (350)
   Duration  9.40s
```

## Final `pnpm build` (exit 0)

```
$ pnpm build
> tsc -p tsconfig.server.json && node scripts/copy-excalidraw-assets.mjs && vite build
...
dist/ui/assets/chunk-EIO257PC-C_q0VHDU.js                1,820.99 kB │ gzip: 744.20 kB
dist/ui/assets/index-BP1ItZRw.js                         2,043.39 kB │ gzip: 665.95 kB

(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 1.13s
```

The warning about chunks larger than 500 kB was there before these changes.
It is not one of the twelve findings, so I left it alone.

## Concerns

- Finding 12: as ruled, the select stops every Escape, not only one pressed while its list of options is open, because the DOM cannot tell the two apart reliably. The dialog opens with the focus in the select. Escape therefore closes the dialog only after the user moves the focus out of the select, for example with Tab or by clicking a button.
- Finding 11: the "marked done" stickiness is kept in memory and comes back after a restart from the saved status `done`. Suppose a run that was marked done but has no `prUrl` is mid-turn when Blueprint restarts. Its status is saved as `interrupted`, so when it resumes and goes idle it reads `idle`, and the user has to mark it done again. Runs that have a `prUrl` are not affected.
- Finding 7: the warning is logged once for each `list()` call that fails. While a task file stays broken, every `runs.changed` event logs it again.

## Fix round 2

These are three follow-ups from @thread:thr_ebjwcfrme3.
They replace the round 1 concerns about finding 12 (Escape), finding 11 (marked done after an interrupted restart), and finding 7 (repeated warnings).

| Follow-up | Commit | Subject |
|---|---|---|
| 1 | `28b9c9e` | fix(ui): Escape from the launch dialog's select closes the dialog again |
| 2 | `526ba74` | fix(runs): a run marked done stays done across a restart and resume |
| 3 | `566fec8` | fix(runs): warn about a bad task file once per distinct error |

### 1. Escape from the select closes the dialog

Change: in `src/ui/plan/LaunchDialog.tsx`, I removed the select's `onKeyDown` that stopped Escape from propagating.
The file is now the same as it was before `05a0d08`.
An open native select handles its own Escape in the browser, so the dialog never receives that one.
The focus-return fix in `TasksView` is unchanged.

Test: `test/ui/LaunchDialog.test.tsx`, "LaunchDialog closes on Cancel and on Escape, including from the select".
It checks that the select has the focus when the dialog opens, and that Escape there calls `onClose`.
It then checks Cancel, and Escape with the focus on Cancel.

```
$ npx vitest run test/ui/LaunchDialog.test.tsx                               # red
   × LaunchDialog closes on Cancel and on Escape, including from the select
      Tests  1 failed | 2 passed (3)
$ npx vitest run test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx    # green
      Tests  12 passed (12)
```

### 2. `markedDone` is saved

Changes:
- `src/shared/types.ts`: `RunRecord` gains `markedDone: boolean`.
- `src/server/files.ts`: the `sessions.json` schema gives `markedDone` a default of `false`, so records saved without it read as false.
- `src/server/runs/manager.ts`:
  - `launch` saves `markedDone: false`.
  - `markDone` patches `markedDone: true`, then derives the status as `done`.
  - The in-memory `Live.done` flag is gone.
  - On `idle`, the run is done when the turn printed a PR URL, or when `prUrl !== null || markedDone` for the record.
- Test fixtures that build a `RunRecord` now include `markedDone: false`.

Tests: `test/server/runs/manager.test.ts`.
- "markDone makes an idle run done, and it stays done through later turns, a restart, and a resume":
  - After marking, the saved record has `markedDone: true`.
  - The test sends a message whose turn is held open, and closes the manager while that turn is still running.
  - A new manager's `start()` reads the record as `interrupted`, still with `markedDone: true`.
  - `resume` starts a turn that ends with no URL, and the statuses are `["working", "done"]`.
- The legacy-record restart test leaves `markedDone` out of the saved records and checks that every run reads `false`.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
   × markDone makes an idle run done, and it stays done through later turns, a restart, and a resume
      Tests  1 failed | 13 passed (14)
$ npx vitest run test/server test/ui                     # green
      Tests  307 passed (307)
```

### 3. One warning per distinct task-file error

Change: `src/server/runs/manager.ts`.
The manager keeps a `#warned` set of error messages it has already logged.
`list()` logs a `listTasks()` failure only when its message is not in the set yet.

Test: `test/server/runs/manager.test.ts`, at the end of the launch test.
The same error a second time logs nothing new, and a different error logs once more.

```
$ npx vitest run test/server/runs/manager.test.ts      # red
AssertionError: expected "warn" to be called 1 times, but got 2 times
      Tests  1 failed | 13 passed (14)
$ npx vitest run test/server/runs/manager.test.ts      # green
      Tests  14 passed (14)
```

### `pnpm check` (exit 0)

```
$ pnpm check
Checked 132 files in 159ms. No fixes applied.
 Test Files  51 passed (51)
      Tests  350 passed (350)
```

None of the commits has a co-author or generated-with trailer.
