I have everything I need. Here is the review.

## Milestone 4 review: runs and the sessions view

### Strengths

- **The architecture matches the design.** One `PlanSession` per run with the worktree as cwd, no subclass, no board tools, the preset system prompt with no append, and a per-run `PermissionBroker`. The manager derives status from the session rather than storing a parallel state machine, and the derived status is written back so the view works before any session exists.
- **Serialized persistence is right.** `RunStore.write` chains every write and only advances memory once the file is on disk. The plan session's id now goes through the same queue, closing the milestone 1 note. The "failed write leaves memory as on disk" test is exactly the right check.
- **Git safety is good.** `createWorktree` checks the path and the branch before touching git, uses `execFile` with no shell, validates the slug against traversal, and never removes anything. The helpers are tested on a real temporary repository including the merge and prune paths.
- **Restart and resume are handled carefully.** Stale `working` and `needs_you` records read `interrupted`; every saved run gets its transcript restored from the worktree's session store; resume re-checks the status after the await so a double click cannot start two processes; a run with no usable session id gets the full prompt again instead of a meaningless "continue".
- **Cost accounting across processes** (`costBase` plus the process total, reset on each `starting`) is a sound answer to the SDK reporting per-process totals, and the multi-turn test pins it.
- **The fake SDK is faithful.** `textTurn` emits the stream deltas, the assistant message, the stops, and a typed result; `fakeQuery` reads the prompt iterable in the background like the real SDK. Manager tests run against a real `FileStore` in a temp dir with only git faked.
- **The UI keeps server types out.** The Biome override forbidding `src/ui` from importing `src/server` is a cheap guard that will pay off every milestone.
- **The acceptance run was thorough and honest.** Real login, real worktrees, a real restart mid-turn, a cancelled pending ask, the other-sessions list, and a gap found and fixed.

### Issues

#### Critical (Must Fix)

1. **The "fix before merge" ruling on the run prompt was never applied.** `src/server/runs/prompt.ts:27-31`. The deferred list records the acceptance finding (Claude wrote files with `printf`, so `acceptEdits` prompted twice per run) and the ruling that the definition of done gains "Create and edit files with the Write and Edit tools, not shell redirection." No commit after the acceptance run touches the prompt, and the string is nowhere in `src/`. Add it as item 1 or 2 of the definition of done and extend the `runPrompt` test.

#### Important (Should Fix)

2. **`bypassPermissions` launches do not set `allowDangerouslySkipPermissions`.** `src/server/runs/manager.ts:259`. SDK 0.3.316's `Options` says the flag "must be set to true when using `permissionMode: 'bypassPermissions'`", and `sdk.mjs` only passes `--allow-dangerously-skip-permissions` when it is set. The launch dialog offers this mode, the acceptance run never used it, and the unit test only asserts the mode string passes through. I verified the SDK wiring, not the CLI's reaction, but the documented contract says the launch will not get what it asked for. Fix: `allowDangerouslySkipPermissions: record.permissionMode === "bypassPermissions"` in the options, and assert it in the launch test.

3. **`done` is not sticky, so a finished run flips back to `idle` and blocks its dependents.** `src/server/runs/manager.ts:323-325` and `src/server/runs/gate.ts:23`. On `idle` the status is `done` only if the turn that just ended printed the PR URL. The spec and plan both say a done run accepts messages. A user who sends "also fix the lint warning" to a done run gets a turn that ends with "pushed" and no URL, so the run reads `Idle` while the `PR` link stays on the card, and the gate reports the dependency as `run not done` even after the PR is merged. Fix: in the `idle` case, derive `done` when `prUrl ?? live.record.prUrl` is set. The card and the gate then agree with what the user sees.

4. **The PR URL match is the milestone's headline signal and was never observed live.** `src/server/runs/prompt.ts:34`. The regex accepts only a line that is exactly the URL. Claude's summaries often write `PR: https://...`, a Markdown link, or a trailing period. The acceptance run had no remote by ruling, so the only evidence is the unit test with an ideal line. If the real wording misses, every run reads `Idle` with no link and every gate fails, which is the first-hour experience the design is built around. Widen the match (a line whose only content is the URL, allowing surrounding angle brackets, Markdown link syntax, a label like `PR:`, and trailing punctuation), or fall back to the last PR URL anywhere in the final text when no own-line match exists. Keep the own-line test and add the wrapped forms.

5. **Worktree and branch conflicts surface as HTTP 500 and a logged "server bug".** `src/server/runs/git.ts:29-31` and `src/server/app.ts:28`. Review Focus 1 asks for a failure that names the path or branch. The message is right, but it is a plain `Error`, so `statusFor` returns 500 and `console.error` prints a stack trace for an expected condition. Throw `ExistsError` for both pre-checks so the route answers 409 like every other conflict.

#### Minor (Nice to Have)

6. **The worktree path is stored absolute in a committed file.** `src/server/runs/git.ts:23` against spec section 5, which shows `.blueprint/worktrees/03-auth`. `sessions.json` is committed, so a teammate's clone carries another machine's home directory. Store it relative to the root and resolve at use (the manager, the copy-resume command, `getSessionMessages`).

7. **A malformed task file takes down the sessions view.** `src/server/runs/manager.ts:157-158`. `list()` calls `listTasks()`, which throws on any bad task file, so `GET /api/runs` 500s and the page shows only the error. Catch it and fall back to slugs for titles.

8. **The sessions view's page-level error never clears and catches transcript failures.** `src/ui/sessions/SessionsView.tsx:95,101,148`. Already on the deferred list; one `setError(null)` on the next successful load is enough.

9. **"Done · $X total" in a run transcript beside an `Idle` chip, with a different total than the card.** `src/ui/panel/TranscriptList.tsx:28`. Deferred to M5 by ruling; "Turn done" would cost one word now.

10. **`#patch` keeps broadcasting `runs.changed` after `close()`.** `src/server/runs/manager.ts`, the `#patch` callback. Harmless since the sockets are terminated, but the `#closing` guard that protects events and statuses does not cover it.

### Deferred-list triage

Must fix before merge:

- The run prompt line from the acceptance ruling (issue 1). The ruling itself says "fix before merge".

Can wait:

- Task 1: untested `newRunId` retry, the post-failure chain write, `isAncestor`'s re-throw branch. Small and cheap, but nothing observable depends on them.
- Task 2: duplicated heading asserts, the extra blank line after a body ending in a newline.
- Task 3: lazy transcript loading. Startup reads every run's session file; fine until a repository has dozens of runs.
- Task 4: squash and rebase merges need the override (README note in M5); restored sessions not closed if `serve()` fails (restore starts no subprocess, so nothing leaks).
- Task 6 minors: the other-session transcript retry, the page error slot (issue 8), `endedAt` moving with a changed failure reason, the missing re-derive test, `.button:disabled` widened (checked visually in acceptance).
- Task 7 minors: the stale gate error, the branch name rebuilt in the UI, the stale gate snapshot, the hash assertion, Escape from an open select, focus return.
- Task 8: transcript wording (issue 9), raw Markdown, Stop latency.

Rulings that deserve a second look:

- **"A task runs once; a fresh retry is the user's choice through the run card."** Sound for the MVP, but it leaves no path at all when the session cannot be recovered (worktree deleted by hand, session file gone, or a run that `Failed` before the CLI reported an id and whose worktree is now dirty). The user must delete the branch and edit `sessions.json` by hand. Not wrong, but it should be written down in the M5 README as a known limitation.
- **"The acceptance run must not create a GitHub repository or push."** Right call on safety. Its cost is that the milestone's "PR link appears" criterion rests on a strict regex and a unit test (issue 4). Pair it with widening the matcher now and one real-remote check on a throwaway repository Vincent owns before the demo.
- The other rulings (store as a required `createAgent` dependency, cost base plus process total, `ExistsError` for a non-interrupted resume, any done and merged run passes, `includeProgrammatic: false`) look right.

### Declined to judge

- Assistant Markdown rendered raw in transcripts and card previews: ruled into the M5 design pass.
- Stop taking 3 to 8 seconds to land: SDK interrupt latency, not Blueprint's.
- Uneven card heights leaving gaps in the two-column grid: cosmetic, M5.
- "Allow always" in a run writes rules into the worktree's `.claude/settings.local.json`, which never reaches the main repository and vanishes with the worktree: spec section 10 lists allow-always persistence as a build-time verification and section 11 as a cut candidate; not exercised in acceptance.
- The worktree lacks the user's git-ignored `.claude/settings.local.json`, so local permission rules do not apply to runs: Claude Code's own behaviour, within spec section 2's "fit the user's existing Claude Code" only as far as committed files go.
- Bash can still write under `.blueprint/boards/` in a run: the milestone 1 ponytail note on the hook, unchanged here.
- A worktree deleted by hand makes resume fail with a generic failure message: spec section 6.7 leaves cleanup to the user.
- The spend of a turn killed by a restart is never counted: the CLI reports nothing for it.
- A corrupt `sessions.json` is overwritten by the first write, losing any run records it held: milestone 1 ruling, unchanged.
- Startup restores every run's transcript before the server listens: deferred lazy loading.
- The gate's `not merged` wording is wrong for squash merges: ruled into the M5 README.

### Recommendations

- Apply issues 1 to 3 as one small commit each; they are a prompt line, one option, and one condition. Issue 4 is a regex and two test cases.
- Before the M5 demo, run one task against a throwaway remote Vincent owns with `gh` authenticated, and record which wording Claude used for the URL. That single observation settles issue 4 either way.
- Click "Allow always" once in a run during that same check and look at where the rule landed. The design's risk list asks for exactly this and nobody has looked yet.
- Consider storing `worktree` relative (issue 6) before `sessions.json` with absolute paths gets committed to a shared repository; it is cheaper to change now than after.

### Assessment

Ready to merge? **With fixes**

Reasoning: the branch implements every requirement of design sections 4, 5, 6.7, 7, 8 row 4, 9, and 10 with solid tests and a thorough acceptance run, but a ruled fix-before-merge prompt change is missing, the bypass mode is launched without the flag the SDK requires, and a done run loses its status on any follow-up message. All four fixes are small and local.
