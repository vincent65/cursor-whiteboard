# SDD ledger — plan: docs/superpowers/plans/2026-11-02-m4-runs.md
- Workspace created on 2026-11-02 while milestone 2 runs; execution starts on branch m4-runs after m3-compile merges to main.

## Pre-flight scan (2026-11-02)

| Tasks | Produced vs consumed | Finding |
|---|---|---|
| 1 → 3, 4 | `RunStore` (load/runs/run/upsertRun/patchRun/newRunId/setPlanSession), `createWorktree`, `isAncestor` | consistent; Task 4's gate takes `isAncestor` as a function |
| 1 → M1 agent | `createAgent` uses `RunStore.setPlanSession`; its deps gain `runs` | the agentRoutes wiring test adapts (stated) |
| 2 → 3 | `runPrompt`, `prUrlIn` | consistent |
| 3 → 4, 6 | `RunManager` API, `RunView`, `LaunchOptions`; `run.event`/`run.status`/`runs.changed` messages | consistent with routes and the UI's handlers |
| 3 (self) | reuses `PlanSession` with `send(text, shown)` from M2 Task 4 and `denyBoardWrites(worktree)` | consistent once M2 merges |
| 3 → 5 | `transcriptFrom` extracted from `PlanSession.restore` in Task 5, used by sessions routes | Task 3's `transcript(runId)` uses the live session; no dependency on Task 5 |
| 4 → 6, 7 | route paths and codes; `gate(slug)` | consistent |
| 6 → 7 | `#/sessions` route for navigation after launch | consistent |
| 6 (self) | lifts `TranscriptList` out of `ClaudePanel` | the M2 refine chip must survive the lift; stated as "unchanged in output" |
| 3 (self) | status derivation needs the turn's last assistant text to detect the PR URL | implementer tracks the last `assistant_text` event per run until the `result` event |

Rulings: none needed before execution; revisit the plan against the merged M2 and M3 code before Task 1 (session signature, TasksView shape).
- Pre-flight re-check against merged M3 code: SessionDeps has onNotSent and send(text, shown); createApp(store, agent?) takes proposals from the agent; TasksView takes { cost }; Route has spec/tasks; dispatches for Tasks 1 and 4 aligned.
- Execution started on branch m4-runs from main 6e7ef85
- Task 1: dispatched implementer thr_zvyjrmfhxx; BASE = 6e7ef85
- Task 1: implementer DONE_WITH_CONCERNS (commit dce9eed, 299 tests); Ruling: accepted — runs is a required createAgent dependency (a silent second store would defeat serialization), createAgent loads it (resume and startup-error reporting need it), createWorktree checks the slug first; dispatched review thr_96gdp3z5kf
- Task 1: review (thr_96gdp3z5kf): Approved, 0 Important, 5 minor; Task 4 now lifts the inline RunStore into one shared instance and guards patchRun against undefined values; deferred: newRunId's stored-run retry and the post-failure chain write are untested; isAncestor's re-throw branch untested.
- Task 1: complete (commit dce9eed, review clean)
- Task 2: dispatched implementer thr_fw6ce9dt2d; BASE = dce9eed
- Task 2: implementer DONE_WITH_CONCERNS (commit f88815f, 303 tests); Ruling: an empty acceptance list renders "- none listed; use the task description and the specification" — pre-review fix round 0 (resume thr_fw6ce9dt2d)
- Task 2: fix round 0 done (68ea07a); dispatched review thr_3p4djwfy6a
- Task 2: review (thr_3p4djwfy6a): Approved, 0 Important, 3 minor; the strict PR-URL match is checked by the acceptance run (Task 8 widens it if Claude wraps the link); deferred: duplicated heading asserts, an extra blank line after a body ending in a newline.
- Task 2: complete (commits f88815f..68ea07a, review clean)
- Task 3: dispatched implementer thr_jw5anqrzqq; BASE = 68ea07a
- Task 3: implementer DONE_WITH_CONCERNS (commit e00ee9e, 309 tests); Ruling: cost = session total at start plus the result total (accepted deviation; resumed runs keep what they spent); ExistsError for a non-interrupted resume accepted; pre-review fix round 0: persist permissionMode on RunRecord, restore each run's transcript at start() and resume on that session, a run-specific board-write denial reason (resume thr_jw5anqrzqq)
- Task 3: fix round 0 done (0d108c6, 6dce619; 311 tests); Ruling: a resume with no usable session id sends the full run prompt instead of the continue message — one more pre-review fix
- Task 3: context-less resume fix done (73e6e3b); dispatched review thr_u3ygb5ufvt
- Task 3: review (thr_u3ygb5ufvt): Needs fixes (2 Important: message() to a run with no session starts Claude without its task; the board guard covers only the worktree copy, so ../../boards reaches the live board; 5 minor)
- Ruling: message() with no session sends the run prompt then the text; run sessions guard both the root and the worktree (denyBoardWrites takes several roots); error events carry cost so failed runs report spend; a multi-turn cost test; INTERRUPTED_REASON rename; onEvent ignores events after close; deferred: lazy transcript loading.
- Task 3: fix round 1/5 started (resume thr_jw5anqrzqq); FIX_BASE = 73e6e3b
- Task 3: fix round 1/5 done (a6ca48d); dispatched re-review thr_dp9n2byzht
- Task 3: re-review 1 (thr_dp9n2byzht): all 6 addressed, no new breakage.
- Task 3: complete (commits e00ee9e..a6ca48d, review clean)
- Task 4: dispatched implementer thr_ujkxk38uay; BASE = a6ca48d
- Task 4: implementer done (23909ed); dispatched review thr_suwxsid5yh
- Task 4: review (thr_suwxsid5yh): Needs fixes (1 Important: the gate looks only at the newest run; 4 minor)
- Ruling: the gate passes on any done and merged run; reasons ordered not merged > not done > no run; neutral 409 message; shared parse/PermissionBody in src/server/http.ts; deferred: squash/rebase merges need the override (README note in M5), restored sessions not closed if serve() fails.
- Finding (controller, while checking the reviewer's scenario): a task can run only once because createWorktree refuses an existing blueprint/<slug> branch. Ruling: Task 7's card shows `Launch` only for a task with no run and `View run` otherwise; a fresh retry after a failed run is the user's choice through the run card (message or resume).
- Task 4: fix round 1/5 started (resume thr_ujkxk38uay); FIX_BASE = 23909ed
- Task 4: fix round 1/5 done (0dc0f5e, b4031df; 321 tests); controller re-review: gate.ts read in full (any done and merged run passes; reasons ordered correctly; git only for done runs), covering tests pass locally.
- Task 4: complete (commits 23909ed..b4031df, review clean)
- Task 5: dispatched implementer thr_futnd536jq; BASE = b4031df
- Task 5: implementer done (7649522); dispatched review thr_wcc9rpef3e
- Task 5: implementer DONE_WITH_CONCERNS (7649522 plus test-stability commit 9ceef72 adding RunStore.settled(); 323 tests; real server listed 123 sessions); Ruling: app.ts/index.ts mounting accepted; listOtherSessions uses includeProgrammatic: false (parity with the terminal /resume picker; hides Blueprint's own split and replaced plan sessions and other headless SDK runs) — to be fixed with the review findings.
- Task 5: review (thr_wcc9rpef3e): Approved, 0 Important, 5 minor; follow-up round: includeProgrammatic false, sessionRoutes into sessions.ts, transcript capped at 500, per-message timestamps (controller verifies locally).
- Task 5: follow-up done (a9204ea, 324 tests); controller verified includeProgrammatic false, the 500-event cap, sessionRoutes in sessions.ts, and pnpm check locally.
- Task 5: complete (commits 7649522..a9204ea, review clean)
- Task 6: dispatched implementer thr_6xk9ejkgym; BASE = a9204ea
- Task 6: implementer DONE_WITH_CONCERNS (5b95f99, 328 tests; browser check fixed transcript overflow and the shared Idle/Done color); Ruling: onExpand prop accepted; pre-review fix round 0: RunRecord.failure persisted and RunView.title from the task file (RunCard drops title/message props), run types moved to src/shared/runs.ts so the UI never imports server code (resume thr_6xk9ejkgym)
- Task 6: fix round 0 done (5944d4e); dispatched review thr_yux7wjyz6n
- Task 6: review (thr_yux7wjyz6n): Approved, 0 Important, 5 minor.
- Task 6: minor (deferred, final-wave candidates): an other-session transcript retry keeps showing the old error; one page-level error slot is never cleared and misplaces run transcript failures; a changed failure reason moves endedAt; no test for a restored failure reason through a re-derive; .button:disabled widened to all buttons (check visually in the acceptance run).
- Task 6: complete (commits 5b95f99..5944d4e, review clean)
- Task 7: dispatched implementer thr_z3qvk9bczm; BASE = 5944d4e
- Task 7: implementer done (f591fce); dispatched review thr_yjfqt6qe4q
- Task 7: review (thr_yjfqt6qe4q): Approved, 0 Important, 6 minor; the View run deviation is recorded in the plan (a failed run is retried by messaging it).
- Task 7: minor (deferred, final-wave candidates): a failed gate's error never clears; the branch name is rebuilt in the UI; the gate snapshot can go stale while the dialog is open; a hash assertion without waitFor; Escape from an open select closes the dialog; focus is not returned to Launch on close.
- Task 7: complete (commit f591fce, review clean)
- Ruling: the acceptance run must not create a GitHub repository or push (outward-facing); it exercises the no-remote path, and the PR-link path stays covered by unit tests.
- Task 8: dispatched implementer thr_h4b6rvaht8; BASE = 611adf9
- Task 8: acceptance passed live on all six steps (DONE_WITH_CONCERNS; commit ff078c0 restores a run card's last message after a restart); three runs cost about $0.84; nothing pushed; PR-link path covered by unit tests only.
- Finding (acceptance, fix before merge): without a GitHub remote or gh, a run never becomes done (done requires a PR URL), so every dependent task stays gated as "not done". Ruling for the final wave: idle runs get a `Mark done` action (POST /api/runs/:id/done, status done, endedAt set), so a user who merges by hand can satisfy the gate.
- Finding (acceptance, fix before merge): Claude wrote files with Bash printf, so acceptEdits still prompted twice per run. Ruling: the run prompt's definition of done gains "Create and edit files with the Write and Edit tools, not shell redirection."
- Task 8: deferred (M5): transcript "Done · $X total" is the process total while the card shows the run total and reads Idle (label wording); assistant Markdown renders raw (M5 design pass); Stop takes 3 to 8 s (SDK interrupt latency).
- Task 8: complete
- All tasks complete.
- Final review: dispatched thr_wxy98gjub6 on claude-fable-5-1 (base 6e7ef85, head ff078c0)
- Final review (thr_wxy98gjub6): With fixes — 1 Critical (the acceptance-ruled run-prompt line not yet applied: it was always scheduled for this wave), 4 Important (bypassPermissions needs allowDangerouslySkipPermissions; done is not sticky; the strict PR-URL match was never observed live; worktree conflicts surface as 500), 5 Minor.
- Ruling: one fix wave of 12 items (review 1-10, Mark done from acceptance, launch dialog focus/Escape/stale error from Task 7).
- Final fix wave: dispatched implementer thr_77cejrh6j5; FIX_BASE = ff078c0
- Final fix wave: done (12 commits 133db36..05a0d08, 350 tests). Follow-up round: revert the select Escape swallowing (my ruling made Escape unable to close the dialog); persist markedDone so a hand-marked run stays done across a restart; warn once per distinct bad-task-file error.
- Final fix follow-up done (566fec8); dispatched re-review thr_5kns5gshes over ff078c0..HEAD
- Final re-review (thr_5kns5gshes): all 12 addressed; 2 minor regressions (shared error slot clears an other-sessions failure; sticky done missing in the stopped case); follow-up round 3 sent, controller verifies locally.
- Final fix round 3 (255be22, a7c5bea): verified by the controller (352 tests, build clean).
- Milestone 4 complete: fast-forward merge of m4-runs into main, push, archive to docs/prompts/2026-11-02-m4-runs/.
