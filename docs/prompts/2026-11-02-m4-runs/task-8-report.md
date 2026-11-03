# Task 8 report: milestone 4 acceptance

## Status

DONE_WITH_CONCERNS.
Every acceptance step passed against the built CLI with the real login.
One gap the run revealed was fixed in `ff078c0`.
The concerns below are small observations I did not fix.

## What I implemented

- Ran `pnpm check && pnpm build` (Step 1).
- Ran the acceptance script (Step 2) on a fresh local scratch repository with no remote, at `/private/tmp/claude-501/bp-accept`.
- Fixed one gap the run revealed: after a server restart, run cards lost Claude's last message.
  `RunManager.start()` now sets each restored run's `lastText` from the last complete `assistant_text` in its restored transcript (`src/server/runs/manager.ts`).
- Commit: `ff078c0 fix(runs): a restored run keeps the last thing Claude said on its card` (conventional, no trailer).

## TDD evidence

RED: I added an assertion to the existing restart test in `test/server/runs/manager.test.ts`: after `start()`, the restored run's view has `lastText` equal to `"On it."`.

```
$ pnpm vitest run test/server/runs/manager.test.ts -t "start marks active"
   × start marks active records interrupted and resume continues the saved session id in the worktree 20ms
 FAIL  test/server/runs/manager.test.ts > start marks active records ...
- Expected:
+ Received:
      Tests  1 failed | 11 skipped (12)
```

(The received value was `null`.)

GREEN:

```
$ pnpm vitest run test/server/runs/manager.test.ts
      Tests  12 passed (12)
```

Full check before the commit:

```
$ pnpm check
Checked 132 files in 144ms. No fixes applied.
 Test Files  51 passed (51)
      Tests  334 passed (334)
```

`pnpm build` (before and after the fix): the only warning is the existing "Some chunks are larger than 500 kB" warning.

PR-link path, covered by unit tests as the dispatch said:

```
$ pnpm vitest run test/server/runs/prompt.test.ts test/server/runs/manager.test.ts --reporter=verbose
 ✓ prompt.test.ts > prUrlIn finds a PR URL on its own line and ignores inline mentions
 ✓ prompt.test.ts > prUrlIn allows surrounding whitespace and takes the first URL line
 ✓ manager.test.ts > a turn ending with a PR URL makes the run done with prUrl and cost; without one it is idle
      Tests  16 passed (16)
```

## Setup

- Scratch repository: `git init`, a README commit, then `blueprint init` from `dist/cli/index.js`.
  `.gitignore` got `.blueprint/export/` and `.blueprint/worktrees/`.
- I wrote the plan by hand instead of running compile and split, to save plan allowance (compile and split were accepted in M3).
  `.blueprint/spec.md` plus three one-file tasks:
  - `add-greeting`: create `greeting.txt`.
  - `add-farewell`: depends on `add-greeting`; create `farewell.txt`.
  - `add-note`: independent; create `note.txt`. This task is for Step 5, so the `default` permission mode run does not disturb Steps 3 and 4.
  
  All of it was committed on `main`.
- Server: `node dist/cli/index.js --no-open --port 4343` in the scratch repository.
  It ran with the sandbox disabled, because Claude must write its sessions under `~/.claude/projects`.
- Browser: the Playwright MCP failed with "Browser is already in use" (another session holds the shared profile).
  I used gstack browse instead, run from `/tmp/claude-501`, outside the repository.

### Test-environment artifact (not a product bug)

My harness exports `CLAUDE_CODE_ENTRYPOINT=sdk-cli` and other `CLAUDE*` variables.
Child processes inherit them, so my first hand-run `claude` session was saved as `entrypoint: sdk-cli`.
`listOtherSessions` (`includeProgrammatic: false`) correctly hid it, and "Other sessions" was empty.
I reran the terminal session and restarted the Blueprint server with every `CLAUDE*` variable unset (`env -u ...`), which matches a user's terminal.
The new session was saved as `entrypoint: cli` and appeared in the list.

## Manual observations (Step 2)

1. **Launch the first task with Accept edits.**
   - The dialog shows "Starts a session on branch `blueprint/add-greeting` in its own worktree."
   - After launch the page went to `#/sessions`.
   - `git worktree list` showed `.blueprint/worktrees/add-greeting` on `[blueprint/add-greeting]`, created from `fd0b4d8` (HEAD).
   - The card showed `Working`, then streaming tool rows ("running `ls -la; git log ...`").
   - Claude wrote the file with Bash `printf` instead of the Write tool, so Accept edits still asked twice: the printf/commit command and a `git commit --amend`.
     Each showed `Needs you` and an inline dialog.
     I answered both with "Allow once".
   - The run ended `Idle` with Claude's explanation ("there's no pull request: this repository has no git remote...").
   - Cost: `$0.2313 total`.
   - `sessions.json` held the record: `status: idle`, `permissionMode: acceptEdits`, `prUrl: null`, `costUsd: 0.2312853`, the session id, the worktree, and the branch.
   - Commit `85096dc feat: add greeting.txt` is on the branch.
   - Claude amended the commit to remove a co-author line because the user's global CLAUDE.md applies to runs.
2. **Launch the dependent task.**
   - The dialog listed "These dependencies are not ready: add-greeting: run not done", with the "Launch anyway" checkbox.
     `Launch` stays disabled until the box is checked.
   - The reason is `run not done`, not `branch not merged into HEAD`.
     With no remote, run 1 ends `Idle`, never `done`, so the gate never reaches the merge check.
     The `not merged` copy is in `LaunchDialog.tsx` and is covered by the gate and dialog unit tests.
   - "Launch anyway" started `add-farewell` (`run_45707e`) as Working.
3. **Stop, then "Carry on".**
   - I pressed `Stop` while the run was working.
     About 3 s later the card still read Working, and it was `Idle` within about 8 s.
   - The transcript shows the rejected Bash tool and an `interrupted` result; cost `$0.1435`.
   - I typed `Carry on` in "Message this run" and pressed Enter.
     The card went back to `Working` with the same session id, `f20dbbc9-...`.
4. **Restart the server mid-turn.**
   - I stopped the server while `add-farewell` was working; `sessions.json` still read `working`.
     No orphaned run process was left.
   - After the restart, the card showed `Interrupted` with a `Resume` button.
   - Resume continued the same session id `f20dbbc9-...`.
     The transcript was intact: the run prompt, the stopped turn, `Carry on` with its tool rows, then "Continue the task where you left off."
   - Claude checked whether the interrupted commit had landed, then redid it.
     Two more asks were allowed; the run ended `Idle`.
   - Commit `d074e34 feat: add farewell.txt`; cost added up to `$0.3994` (0.1435 + 0.2559).
   - The `Carry on` turn that was killed by the restart never reported a result, so its spend is not counted.
     This is expected: a killed CLI reports nothing.
5. **Permission ask in Ask first (`default`) mode.**
   - I launched `add-note` with "Ask first" ("Asks before every edit and command.").
   - Read-only Bash ran without asking.
     The write-and-commit command showed `Needs you` with "Allow Bash: running `printf 'note\n' > note.txt && git add note.txt && git commit`", and "Allow once" answered it.
   - The run ended `Idle` ($0.2005).
   - To test Stop on a pending ask, I messaged the run: "Also create scratch.txt holding the line x, using the Write tool."
     A pending Write ask appeared (`Needs you`).
     `Stop` cancelled it: the tool result reads "The user doesn't want to proceed...", the result is `interrupted`, the card is `Idle`, `pending` is empty, and no `scratch.txt` exists. Cost: $0.2128.
6. **Other sessions.**
   - The hand-run terminal session (clean env) is listed as "Greeting reply · N minutes ago · `main`".
   - Clicking it opens a read-only transcript: the user bubble "Reply with just the word hi..." and the reply "hi".
     There is no message box or controls.
   - Run sessions and the earlier `sdk-cli` session are not listed, which is correct.

### The gap the run revealed (fixed)

After the Step 3/4 restart, the `add-greeting` card no longer showed Claude's explanation under its Idle status.
`lastText` was only set from live events.
After the fix, I rebuilt and restarted the real server: all three Idle cards show their last message (screenshot `/tmp/claude-501/s20-after-fix.png`).

## Files changed

- `src/server/runs/manager.ts`: `start()` sets `lastText` for each restored run.
- `test/server/runs/manager.test.ts`: one assertion in the restart test.

## Cleanup

- The Blueprint server was stopped; port 4343 is free and no Blueprint or run processes remain.
- No run is active; all three runs are Idle.
- The tmux terminal session was exited and killed (only my own named sessions).
- The gstack browse daemon was stopped.
- gstack browse's `stop`, run from the repository, appended `.gstack/` to `.gitignore` and created an empty `.gstack/`.
  I reverted `.gitignore` and removed the directory; `git status` is clean.
- The scratch repository stays at `/tmp/claude-501/bp-accept` for inspection.
  It has no remote, nothing was pushed, and no GitHub repository was created.
- Spend: about $0.84 across the three runs, plus two one-word terminal turns and the uncounted killed turn.

## Self-review

- The fix is 9 lines in the place restored sessions are opened.
  It uses the same "last complete assistant text" rule as live events.
  It does not touch `endedText`/`turnText`, so status derivation is unchanged.
  A restored run keeps its stored status.
- `start()` finishes before the server serves, so no live event can race the assignment.
- The test checks the observable behavior (`list()` returns the preview), not internals.

## Concerns (observed, not fixed)

1. Claude often edits files with Bash (`printf > file`) instead of the Write tool.
   So Accept edits still asks about every file change and commit; each run here needed 2 asks.
   Telling Claude in the run prompt to use the edit tools for file changes would make Accept edits quieter.
   That is a product decision, not a defect.
2. The transcript's result row reads "Done · $0.2559 total" (that CLI process's total) while the card reads "$0.3994 total" (the run's total).
   Also, "Done" in the transcript sits next to an `Idle` badge.
   Both come from the shared M2 transcript copy; consider "Turn done · $X this session" wording.
3. Assistant text is shown as raw Markdown (`**Change:**`) in the transcript and the card preview.
   This is the same as the M2 panel.
4. Stop takes a few seconds to land: the card still read Working about 3 s after the click.
   An optimistic "Stopping…" state would help.
5. The run cards sit in a two-column grid, so cards of different heights leave a gap (masonry-like).
   This is cosmetic.
6. The `not merged` gate reason and the PR → `Done` path could not be seen live without a remote.
   Both are covered only by unit tests.
