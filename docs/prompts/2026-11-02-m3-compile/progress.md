# SDD ledger — plan: docs/superpowers/plans/2026-11-02-m3-compile.md
- Workspace created on 2026-11-02 while milestone 2 runs; execution starts on branch m3-compile after m2-proposals merges to main.

## Pre-flight scan (2026-11-02)

| Tasks | Produced vs consumed | Finding |
|---|---|---|
| 1 → 2 | `Task`, `TaskFile`, `orderTasks`, `taskFileName`, `taskToMarkdown`, `taskFromMarkdown` | consistent; slug comes from frontmatter (`taskToMarkdown` writes it, `taskFromMarkdown` reads it) |
| 2 → 4 | `FileStore.readSpec/replaceTasks` | consistent |
| 2 → 5, 7 | `GET /api/spec` → `{ text, dropped }`, `GET /api/tasks` → `TaskFile[]` | consistent with `getSpec`/`listTasks` in Task 5 |
| 1 → 4 | `TaskGraph` for `z.toJSONSchema` and validation | consistent |
| 3 → 5 | `POST /api/agent/compile` → 202 `{ id }`; `agentCompile()` | consistent |
| 4 → 5, 7 | `POST /api/agent/split` 202/404/409; `split.status` message; `agentSplit()` throws on 404/409 | consistent |
| 5 → 6, 7 | `Route` with `focus`, `routeHash`; `#/spec`, `#/tasks` | Task 6 reads `focus` from `App`'s route; Task 7's `citationHash` must match `routeHash` output format — stated in Task 7 (`#/boards/<page>?focus=<id>`) |
| 5 (self) | App renders placeholders for spec/tasks until Task 7 | stated |
| 7 (self) | extends `src/server/watch.ts` for `spec`/`task` kinds plus a server test | the only server change in a UI task; allowed and stated |
| 3 (self) | "compile while pending returns the same id" needs the result event to clear the pending id | implementer must hook `onEvent` for `result`; stated by "tracked by the returned id until the next result event" |

Rulings: none needed before execution.
- Execution started on branch m3-compile from main 6dc5d50
- Task 0: dispatched implementer thr_8cgcqdfgbx; BASE = 6dc5d50
- Task 0: implementer DONE_WITH_CONCERNS (commit 2625f7d, 236 tests); Ruling: reconcile skips proposals younger than 5 s (a stale autosave must not reject a fresh proposal) — fixed before review in round 0; the agentRoutes test change is accepted; no broadcast needed (the bar reads the scene).
- Task 0: fix round 0 started (resume thr_8cgcqdfgbx)
- Task 0: fix round 0 continued (commit ccc45c1); Ruling: the store stamps proposed/revised entries with the logging time so the grace period counts from the browser ack, not the minted id — one more pre-review fix.
- Task 0: fix round 0 done (commits 2625f7d, ccc45c1, 3f6881f; 237 tests); Ruling: one injected clock on the store (accepted deviation); dispatched review thr_k93cfbaqmt (diff 6dc5d50..3f6881f includes two plan docs commits)
- Task 0: review (thr_k93cfbaqmt): Needs fixes (1 Important: the save-time reconcile beats the browser's undo window; 5 minor)
- Ruling: the server alone owns the reconcile with a two-strike rule (mark on first missing save, reject on a later reconcile at least 3 s after the mark, clear on reappearance); tools reconcile the board they read; the browser timer goes; route failure test, fixed clock in the route test, createApp takes proposals from the agent; deferred: no broadcast, minted at in proposal.apply.
- Task 0: fix round 1/5 started (resume thr_8cgcqdfgbx); FIX_BASE = 3f6881f
- Task 0: fix round 1/5 done (commit 623b9ed, 240 tests); concerns accepted by design (a tool read whose reconcile cannot log fails honestly; a removal with no later save settles at the next tool read); dispatched re-review thr_urmhzitq3p
- Task 0: re-review 1 (thr_urmhzitq3p): all 4 addressed, no new Critical or Important breakage.
- Task 0: minor (deferred, final-wave candidates): a tool's reconcile that cannot log fails the read-only tool (wrap it like the save route); get_selection now reads the board file even with nothing selected.
- Task 0: complete (commits 2625f7d..623b9ed, review clean)
- Task 1: dispatched implementer thr_8zdiiqgb7k; BASE = 623b9ed
- Task 1: NEEDS_CONTEXT (my dispatch put slug first, the brief test wants title first); Ruling: order title, slug, dependsOn, files, acceptance, sources — the brief test is binding; resumed thr_8zdiiqgb7k
- Task 1: implementer DONE_WITH_CONCERNS (commit 0b30e4c, 244 tests; concerns: self-dependency and longer-cycle error wording); dispatched review thr_vxj5n37jmz
- Task 1: review (thr_vxj5n37jmz): Approved, 0 Important, 5 minor.
- Ruling: folded into Task 2 — exact cycle messages with a three-task test, `task <s> depends on itself`, CRLF normalization, and listTasks checking the frontmatter slug against the file name; deferred: unknown frontmatter keys are stripped and a duplicate key wins last.
- Task 1: complete (commit 0b30e4c, review clean)
- Task 2: dispatched implementer thr_795mmbj7ed; BASE = 0b30e4c
- Task 2: implementer DONE_WITH_CONCERNS (commit 796fff6, 254 tests; routes checked with curl on a real server).
- Deferred (final wave, visible in the spec view): dropUnknownCitations leaves the surrounding punctuation ("See A, B, , ."); it should also remove one adjacent separator (", " or a leading space) and collapse empty parentheses.
- Task 2: dispatched review thr_h2n9dvbr37
- Task 2: review (thr_h2n9dvbr37): Approved, 0 Important, 7 minor.
- Task 2: minor (deferred, final-wave candidates): one corrupt board makes GET /api/spec a 500 (skip it in citationIndex with a warning); listTasks does not detect duplicate slugs across files; concurrent replaceTasks can mix sets (Task 4's single-flight split guard covers it); no route test for a bad task file; stray punctuation after dropped citations (already logged); readSpec repeats the ENOENT-to-null catch.
- Task 2: complete (commit 796fff6, review clean)
- Task 3: dispatched implementer thr_4be9uifhpz; BASE = 796fff6
- Task 3: implementer DONE (commit 7f1d6a6, 258 tests); known limit: any result clears the pending compile, so a compile queued behind another message can be sent twice (a harmless rewrite; the session now releases one send per turn, so the fix is to clear only on the turn that carried the compile); dispatched review thr_ghzk4x38hj
- Task 3: review (thr_ghzk4x38hj): Approved, 0 Important, 2 minor.
- Task 3: minor (deferred, final-wave candidates): a failed send can clear a newer compile promise (clear only when compiling === p); a compile queued behind another message can be sent twice; agent-behaviour tests live in agentRoutes.test.ts.
- Task 3: complete (commit 7f1d6a6, review clean)
- Task 4: dispatched implementer thr_mspj2qzxib; BASE = 7f1d6a6
- Task 4: implementer DONE_WITH_CONCERNS (commit 355eb22, 262 tests; one real split returned 5 tasks for $0.076).
- Ruling: the output schema targets JSON Schema draft-7 (the CLI rejects Zod's default 2020-12); "a split is already running" reuses ExistsError for the 409; split() resolves once started and reports through split.status — all accepted.
- Deferred (final-wave candidates): a crash inside the query reaches the browser without the "split failed:" prefix; agent.close() does not abort a running split (pass an AbortController to the query).
- Task 4: dispatched review thr_ig9qdwmwai
- Task 4: review (thr_ig9qdwmwai): Approved, 0 Important, 5 minor.
- Task 4: minor (deferred, final-wave candidates): abort a running split in close() via an AbortController; prefix SDK-thrown errors with "split failed:"; a dedicated SplitBusyError instead of reusing ExistsError; carry the cost on the error broadcast; test the omitted costUsd and compare cycle file contents.
- Task 4: complete (commit 355eb22, review clean)
- Task 5: dispatched implementer thr_n54bpbxndu; BASE = 355eb22
- Task 5: implementer DONE_WITH_CONCERNS (commit bc0e06c, 265 tests); the panel header visual check moved to Task 7; Compile stays clickable during a turn by the brief; dispatched review thr_2fb8yzgzsx
- Task 5: review (thr_2fb8yzgzsx): Approved, 0 Important, 4 minor; Task 7 now also removes the placeholders and tests that a rejected split shows its message; deferred: useHashRoute test leaves hooks mounted; Compile enabled mid-turn (looked at in Task 7's manual pass).
- Task 5: complete (commit bc0e06c, review clean)
- Task 6: dispatched implementer thr_pahy98y43b; BASE = bc0e06c
- Task 6: implementer DONE_WITH_CONCERNS (commit ebbc428, 266 tests; browser check passed); Ruling: App.tsx prop wiring and focusing after the first onChange accepted; focus must never zoom in (center at the current zoom when the targets fit, fit with factor 0.8 otherwise, offset for the properties panel) — pre-review fix round 0 (resume thr_pahy98y43b)
- Task 6: fix round 0 done (commit b456a73, 267 tests; browser: a small element stays at 100% centered right of the panel); Ruling: the fits case uses fitToViewport with min/max zoom pinned to the current zoom (the false path ignores canvasOffsets) — accepted; the fixed 232 px panel offset is wrong only in the phone layout (deferred, desktop tool); dispatched review thr_r9k8923dxa
- Task 6: review (thr_r9k8923dxa): Approved, 0 Important, 4 minor.
- Task 6: minor (deferred, final-wave candidates): rename the `loaded` state to `sceneReady` (shadowing); extract and test `headingLine(doc, slug)`; guard setLoaded with a ref; recreating the doc editor does not re-apply focus (latent).
- Task 6: complete (commits ebbc428..b456a73, review clean)
- Task 7: dispatched implementer thr_z3kdyegw4a; BASE = b456a73
- Task 7: implementer DONE_WITH_CONCERNS (commit 5c0d14f, 276 tests; browser check of citation clicks and live reloads).
- Ruling: accepted — messages.ts kinds and the exported DocView theme; TasksView reloads on task file changes; citationHash strips .md (checked: the server's citation index keys docs as "<name>.md", so both sides agree).
- Deferred (final wave, carried from M1 Task 10): the panel placeholder says "Ask Claude about this board" on doc, spec, and tasks routes.
- Task 7: dispatched review thr_ehqmagrdrx
- Task 7: review (thr_ehqmagrdrx): Approved, 0 Important, 7 minor.
- Task 7: minor (deferred, final-wave candidates): SpecView keeps a stale split or load error (clear it on any split.status and successful reload, like TasksView); a jsdom test for clicking a citation; index-based keys for acceptance and source lists; singular/plural in the dropped-citations line; classify the spec by full path; editor theme and replaceFromDisk in a shared module; deletions are not reported by the watcher.
- Task 7: complete (commit 5c0d14f, review clean)
- Task 8: dispatched implementer thr_z2v7zidyn8; BASE = 5c0d14f
- Task 8: acceptance passed with the real login (DONE_WITH_CONCERNS; commit 45b3c1e keeps the split cost when the split finishes on the spec view); compile 41 s $0.2478, split 35.3 s $0.3025, second split refused, task files written once.
- Task 8: deferred (final-wave candidates from the run): the compile instruction should tell Claude to read with Read/Glob, not Bash (a needless permission prompt); the dropped-citations warning lists a repeated citation twice (dedupe); task sources keep citations to deleted elements (clean them when serving GET /api/tasks); after a restart the transcript shows the full compile prompt (restore should show "Compile the plan into spec.md"); the spec view gives no feedback when a split finishes (show "N tasks written" with a link to the tasks view).
- Task 8: complete
- All tasks complete.
- Final review: dispatched thr_6nhe4yvysi on claude-fable-5-1 (base 6dc5d50, head 45b3c1e)
- Note: the M3 final review prompt lost two inline names (".blueprint/spec.md", "?focus=") to shell backtick substitution; harmless (the reviewer reads the plan); fixed in the M4 script.
- Final review (thr_6nhe4yvysi): With fixes — 0 Critical, 4 Important (compile reads exports only a save regenerates; the slug rule in the instruction does not match the index; a split in flight is invisible to a later view; a failed reconcile fails a read-only tool), 8 Minor; rulings upheld.
- Ruling: one fix wave of 15 items (Important 1-4; triage: Read/Glob instruction, dedupe and pluralize, separator cleanup, cleaned spec into split, index keys; plus stale SpecView errors, unlink events, restored compile label, compiling === p, route-aware placeholder, readable split errors); the instruction lists citable heading slugs per doc rather than describing the rule.
- Final fix wave: dispatched implementer thr_22fwwnytbp; FIX_BASE = 45b3c1e
- Final fix wave: done (13 commits faf1f49..42e28f4, 292 tests, a cleanup flake it introduced fixed with 30 clean runs); concerns accepted: a result from any turn still clears compiling (needs result-to-send correlation; harmless rewrite); mapped split errors drop the "split failed:" prefix; citation removal also trims the trailing space.
- Deferred to M5 polish: the sidebar keeps a deleted board or doc until its next refresh (App refreshes only on unknown names; handle unlink by refetching the lists).
- Final fix wave: dispatched re-review thr_jriz2wq25w
- Final re-review (thr_jriz2wq25w): 14 of 15 addressed; finding 7 partial (a stale citation leading a list leaves a stray comma); new minors: a Split click before the mount-time state answer can be re-enabled (heardSplit), a corrupt board fails split while compile skips it (consistent with GET /api/spec, accepted), docs read with Promise.all in compile (deferred).
- Ruling: one small follow-up in the same thread for finding 7 (leading-list case) and the heardSplit guard; the controller verifies it locally instead of a second re-review thread.
- Final fix round 2 (commits 8fc6684, b802cd8): verified by the controller (294 tests, build clean, a node probe of the four citation cases gives clean text).
- Milestone 3 complete: fast-forward merge of m3-compile into main, push, archive to docs/prompts/2026-11-02-m3-compile/.
