# SDD ledger — plan: docs/superpowers/plans/2026-11-02-m1-claude-panel.md

Spec: docs/build-plan.md (reachable). Branch: m1-claude-panel from main (b8a9b27) in the project checkout (env_kmibyqzefs).
Execution: subagent-driven; implementers are bb child threads on claude-code Opus 5.5 reasoning high, reviewers Opus 5.5 (high for large diffs, medium for small), final review Fable 5.1; permission mode auto.

## Pre-flight scan (2026-11-02)

| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T1 / T8 | T1 FileStore.readSessions/writeSessions and SessionsFile; T8 reads the plan session id and writes it on onSessionId | consistent |
| T2 / T3 | T2 ServerMessage and ClientMessage unions; T3 provider dispatches ServerMessage and sends ClientMessage | consistent |
| T2 / T5 | T2 creates src/shared/panel.ts with PanelEvent; T5 adds PermissionDecision and PendingPermission beside it | consistent after plan fix |
| T2 / T7 | T2 hub.request({ kind, board? }); T7 calls hub.request({ kind: "board.png", board }) and adds hub.activeBoard in ws.ts | consistent |
| T3 / T4 | T3 useServerEvent and useSendToServer; T4 BoardView uses both for responders and selection.changed | consistent |
| T4 / T9 | T4 sends selection.changed over WS from a 150 ms debounced handler; T9 publishes labels through SelectionProvider from the same handler | consistent, both touch BoardView sequentially |
| T5 / T6 | T6 consumes SdkEventMapper and PermissionBroker types | consistent |
| T6 / T8 | T8 builds SessionDeps (query, getSessionMessages, options, callbacks) and calls restore, send, interrupt, state | consistent |
| T7 / T8 | T8 passes createBoardTools server in mcpServers, denyBoardWrites in hooks, SYSTEM_PROMPT_APPEND in systemPrompt | consistent |
| T8 / T9 | routes /api/agent/{send,interrupt,permission,state} vs api.ts agentSend/agentInterrupt/agentPermission/agentState | consistent |
| T8 self | createApp(store, agent?) keeps existing createApp(store) callers in tests working | consistent |
| T10 | modifies BoardView (after T4, T9) and DocView; sequential | consistent |
| T11 | adds mermaid dev dependency; jsdom test | consistent |
| Global constraints | no task contradicts them; no plan-mandated empty test or duplicated logic block | clean |

Rulings:
- Ruling: work on branch m1-claude-panel inside the project checkout, as in milestone 0 — bb child threads share the checkout environment and run one at a time — costs a branch move if wrong.
- Ruling: the design pass (DESIGN.md) stays deferred to milestone 5 where a frontend-design subagent produces it and restyles — it needs taste decisions and the fallback tokens work — costs a restyle pass.

## Tasks
- [ ] Task 1 .. Task 12 (see plan)

## Log
- 2026-11-02 Task 1: dispatched implementer; BASE = b8a9b27
- Task 1: implementer DONE_WITH_CONCERNS (a18f831); spike: apiKeySource none, Claude Code 2.1.316, model claude-opus-5-5, result "ready". Concerns: tests need store.init() first; default settingSources loads the user's MCP servers and plugins (startup cost); sandbox blocked api.anthropic.com on the first run. Review thread thr_ndx3vc9wgv. Plan file committed as 12b7ed5.
- Ruling: the plan session keeps the default settingSources (user, project, local) as the design requires; the acceptance run measures startup latency and a settings toggle is deferred unless it hurts — costs slow first turns if wrong.
- Task 1: review (thr_ndx3vc9wgv) spec ✅, quality Approved.
- Task 1: minor (deferred): the Zod schema and the SessionsFile type can drift silently (add a two-way type check or share the status literals); tests do not exercise a populated RunRecord or a wrong-shape JSON file.
- Task 1: complete (commits b8a9b27..a18f831, review clean)
- Task 2: dispatched implementer; BASE = 12b7ed5
- Task 2: implementer DONE_WITH_CONCERNS (dd5bf74); concerns: type guards added in BoardView and DocView (outside file list, Task 3 replaces them); request arg typed per kind; disconnect error text chosen; no end-to-end browser-to-hub test. Review thread thr_vfaekqma2j
- Task 2: review (thr_vfaekqma2j) spec ✅ (request arg typed distributively, a correct fix to the plan's type), quality Approved.
- Task 2: minor (deferred): no shape check on inbound ClientMessages; a throwing onClient listener blocks later ones; pending-request timer not unref'd; timeout test checks only the upper bound; fallback test leaves a live timer; any socket's response can settle a request; RequestBody type readability.
- Task 2: complete (commits 12b7ed5..dd5bf74, review clean)
- Task 3: dispatched implementer; BASE = dd5bf74
- Task 3: implementer DONE_WITH_CONCERNS (1c9d033); concerns: unbounded reconnect send queue replays stale selection and responses; a throwing subscriber blocks later ones; deleted files stay listed until refresh. Review thread thr_umjdtvesp8
- Task 3: review (thr_umjdtvesp8) spec ✅, quality Approved.
- Task 3: minor (deferred): overlapping sidebar refreshes can apply out of order; deleted files stay listed until a refresh (brief-mandated); StrictMode logs one WebSocket warning on dev load; server-events test 2 depends on mock call counts without clearMocks.
- Ruling: Task 4 also fixes three Task 3 minors on the socket it extends (subscriber isolation, readyState check before send, reconnect queue keeps only the latest selection and drops stale responses) — same code, same reviewer — costs nothing if wrong.
- Task 3: complete (commits dd5bf74..1c9d033, review clean)
- Task 4: dispatched implementer; BASE = 1c9d033
- Task 4: implementer DONE_WITH_CONCERNS (cc86183); concerns: base64 helper exported from scene.ts; selection PNG includes bound text labels of selected shapes; dev-only console noise (StrictMode WS warning, favicon 404). Review thread thr_4rugxr5ihf
- Task 4: review (thr_4rugxr5ihf) spec ✅ (bound labels in the selection PNG accepted as a justified extra), quality Needs fixes: Important #1 selection not re-sent on reconnect (task-4-findings-1.md).
- Task 4: minor (deferred): request-kind fallthrough answers unknown kinds as a snapshot; bound-label filter untested inside the component; two exportToBlob call sites duplicate arguments; non-Error rejections yield undefined error text; a late debounced selection can go stale on board switch.
- Ruling: the two dev-console noises (favicon 404, StrictMode WebSocket warning) are fixed in Task 9 under Vincent's "fix what looks off" rule — costs nothing if wrong.
- Task 4: fix round 1/5 started (resume thr_kpsxuauzgk); FIX_BASE = cc86183
- Task 4: fix round 1/5 (1 addressed, 0 open — last selection re-sent on every reconnect, first report always sent; commits cc86183..b9f1bd7)
- Task 4: minor (deferred to Task 9 by ruling): the remembered selection outlives its BoardView, so a tab showing a doc can re-announce an old board after reconnect; BoardView clears it on unmount.
- Task 4: complete (commits 1c9d033..b9f1bd7, review clean)
- Task 5: dispatched implementer; BASE = b9f1bd7
- Task 5: implementer DONE (cc0a5e6); note: streamed and final text share the id <messageId>:<index> so the transcript replaces in place. Review thread thr_bxhsn3cqkw
- Task 5: review (thr_bxhsn3cqkw) spec ✅, quality Approved. ⚠️ the final-text id scheme depends on the SDK emitting one assistant message per finished block; carried into Task 6 and Task 12.
- Task 5: minor (deferred): duplicate toolUseID in ask orphans the first promise; summarizeTool interpolates undefined for missing keys and keeps newlines; message_start reset untested; mixed text and tool_use message untested; subagent traffic shares mapper state.
- Task 5: complete (commits b9f1bd7..cc0a5e6, review clean)
- Task 6: dispatched implementer; BASE = cc0a5e6
- Task 6: implementer DONE_WITH_CONCERNS (593c44a); concerns for Task 12 to check against the real SDK: brief idle between queued turns; an interrupted turn may end as an error result; restored replies with two text blocks collapse (events.ts id scheme); message order assumption. Review thread thr_x5k3fttj98
- Task 6: review (thr_x5k3fttj98) spec ✅ (two documented deviations: brief idle between queued turns; transcript dedup by id), quality Needs fixes: Important #1 thrown loop orphans the CLI process; #2 a cleanly ended query wedges the session in working (task-6-findings-1.md).
- Task 6: minor (deferred): a failed restore leaves a partial transcript; empty content array restores as a blank user event; error result with no messages gives an empty status message; queued messages silently dropped after a thrown turn; send after close restarts the session; no regression test for the queued-turn status sequence.
- Task 6: fix round 1/5 started (resume thr_uvznr284cg); FIX_BASE = 593c44a
- Task 6: fix round 1/5 (2 addressed, 0 open — loop errors stop the run and close the query; a cleanly ended query becomes an error state that the next send recovers from; commits 593c44a..b2c9f18)
- Task 6: minor (deferred): `void this.#consume(run)` has no .catch, so a throw during the cleanup emit is an unhandled rejection; Task 12 judges whether a clean CLI exit should read as an error in the UI.
- Task 6: complete (commits cc0a5e6..b2c9f18, review clean)
- Task 7: dispatched implementer; BASE = b2c9f18
- Task 7: implementer DONE_WITH_CONCERNS (commit 389bde0); concerns are observations (hub Pick widened to include activeBoard, arrow-keeping rule, tests via _registeredTools, Bash can still write boards); dispatched review thr_2cfxbmfcdt
- Task 7: review (thr_2cfxbmfcdt): Needs fixes (2 Important: guard anchored on drifting hook cwd; activeBoard untested; 7 minor)
- Ruling: `denyBoardWrites` becomes a factory `denyBoardWrites(root)` anchored on the fixed repo root; `input.cwd` only resolves relative paths — the brief's const form can be bypassed by an earlier `cd` — costs a one-line change in Task 8's wiring if wrong.
- Ruling: denial reason copy replaced (brief did not mandate the text; "later milestone" and a non-existent tool confuse the model) — costs nothing if wrong.
- Ruling: minors fixed in the same round: data-URL guard, empty-selection message, get_board error tests; deferred: case-insensitive paths/symlinks, private `_registeredTools` in tests, duplicated per-end nulling.
- Task 7: fix round 1/5 started (resume thr_wyphyr9v8n); FIX_BASE = 389bde0
- Task 7: fix round 1/5 done (commit 6661360; plan docs commit a64f327 in between, so re-review diff is a64f327..6661360); dispatched re-review thr_92ccafre4q
- Task 7: re-review 1 (thr_92ccafre4q): all 6 findings addressed, no new breakage; minor (deferred): get_selection throws on a malformed crop where get_board returns a note; test name still says "cwd".
- Task 7: minor (deferred): isProtectedPath is case-sensitive and ignores symlinks; tests use the private `_registeredTools`; per-end nulling duplicates markdown.ts; Bash can still write board files (system prompt + proposals in M2 are the real guard).
- Task 7: complete (commits 389bde0..6661360, review clean)
- Task 8: dispatched implementer thr_9utb7qvgqj; BASE = 6661360
- Task 8: implementer DONE_WITH_CONCERNS (commit 3800404); real SDK round trip on the user's login worked; resume after restart not observed (sandbox blocked ~/.claude/projects writes), Task 12 verifies it.
- Ruling: canUseTool auto-allows Blueprint's own sdk MCP tools (get_board/get_selection) instead of asking — they are read-only and a dialog per board read would make the panel unusable; allowedTools was rejected because the SDK warns on every start — costs nothing if wrong beyond one ternary.
- Ruling: the JSON 404 for unknown /api/* moved from startServer into createApp so the brief's test can exercise it; behaviour unchanged.
- Task 8: dispatched review thr_hcffpppfx3
- Task 8: review (thr_hcffpppfx3): Approved, 0 Important, 8 minor.
- Task 8: minor (deferred): wrap `agent.close()` in try/finally in server close so a hanging session cannot block shutdown; onSessionId read-modify-write of sessions.json is unserialized (needs a ponytail comment); board-read catch swallows every error, not only not-found; z.prettifyError 400 text carries a symbol and newline; systemPrompt test does not pin `append`; permission event "once per ask" untested; test 5 bundles nine behaviours.
- Task 8: complete (commit 3800404, review clean); plan text updated in 5dfbc85
- Task 9: dispatched implementer thr_ncupxx7nkv; BASE = 5dfbc85
- Task 9: implementer DONE_WITH_CONCERNS (commit b48910b); real-login run found and fixed three UI bugs (selection header shown in the user bubble, tool row vanishing under the dialog, zero-height rows).
- Ruling: Stop stays enabled while a permission dialog waits (needs_you) — interrupt cancels the ask, which is what a user pressing Stop wants — costs nothing if wrong.
- Ruling: .gitignore narrowed from src/ui/public/ to src/ui/public/fonts/ so the favicon is committed — fonts stay generated.
- Carried to Task 12: Stop ends the turn with status "Error: [ede_diagnostic] ..." instead of Idle (interrupt result subtype, flagged in Task 6); the session must treat a result that follows its own interrupt as a normal end.
- Task 9: dispatched review thr_uixaavkgs8
- Task 9: review (thr_uixaavkgs8): Approved, 0 Important, 8 minor.
- Task 9: minor (deferred): status colors are raw hex instead of tokens (design pass, M5); permission buttons can double-submit and a failed answer leaves the dialog up; the restore can re-add an answered ask when a status arrived first; `AgentState` type duplicated in src/ui/api.ts instead of src/shared; the selection header is stripped from user bubbles by regex (moved to the M2 plan: `PlanSession.send(text, shown)`); selectionLabels test lives in ClaudePanel.test.tsx; BoardView selection publishing has no unit test (Excalidraw cannot load in vitest).
- Task 9: complete (commit b48910b, review clean)
- Task 10: dispatched implementer thr_5uu2xntqcu; BASE = f91e04c
- Task 10: NEEDS_CONTEXT (undoDepth not importable); Ruling: add @codemirror/commands ^6.11.1 as a direct dependency (already installed transitively) — a direct import must not rely on pnpm hoisting — costs one lockfile line if wrong; resumed thr_5uu2xntqcu
- Task 10: implementer DONE_WITH_CONCERNS (commit 85fe24d; @codemirror/commands added as a direct dependency per ruling).
- Task 10: deferred (for the final fix wave, not minor): src/server/watch.ts ignores a file for 1 s after Blueprint's own save, so an outside edit in that second is never announced and the next save overwrites it (reproduced on a board); the UI already detects echoes by content, so the server-side suppression should go or compare content hashes.
- Task 10: minor (deferred): the panel placeholder says "Ask Claude about this board" while a doc is open.
- Task 10: dispatched review thr_dqhpxsy46h
- Ruling (for the final fix wave): the watcher echo test becomes content-based — FileStore records the sha256 of its last own write per path and watchPlan skips a change only when the file on disk hashes the same — because both views already reconcile by content and a time window hides real edits; costs one file read per watcher event if wrong.
- Task 10: review (thr_dqhpxsy46h): Approved, 0 Important, 4 minor.
- Task 10: minor (deferred): docReload test mirrors DocView's dirty rule instead of running DocView; BoardView ordering change has no automated test; a selection range collapses to a cursor on reload; exporting a helper from DocView.tsx costs Fast Refresh a full reload.
- Task 10: complete (commit 85fe24d, review clean)
- Task 11: dispatched implementer thr_kcbfmpxfjb; BASE = 85fe24d
- Task 11: implementer DONE (commit ca71e3c; all golden blocks parse; mutation-checked twice); dispatched review thr_yf4ykt5kud
- Task 11: review (thr_yf4ykt5kud): Needs fixes (1 Important: mermaid 12 needs Node >= 22.12 against the 22.1 floor; 2 minor)
- Ruling: mermaid dev dependency pinned to ^11 (already locked transitively through Excalidraw, no engine constraint) rather than raising the Node floor — the floor is a spec constraint and the test only needs a parser — costs nothing if wrong.
- Task 11: minor (deferred): node/edge builders duplicated from markdown.test.ts; one test for all blocks instead of test.each.
- Task 11: fix round 1/5 started (resume thr_kcbfmpxfjb); FIX_BASE = ca71e3c
- Task 11: fix round 1/5 done (commit 1646f79); re-review done by the controller instead of a thread because the diff is a one-line dependency pin: package.json has mermaid ^11.17.2, the lockfile has no mermaid 12 / chevrotain 13 / commander 15, and `pnpm vitest run test/export/mermaid.test.ts` passes locally.
- Task 11: complete (commits ca71e3c..1646f79, review clean)
- Task 12: dispatched implementer thr_x6jc4abr3i; BASE = 1646f79
- Task 12: acceptance passed with the real login (DONE_WITH_CONCERNS; commits 066d977 interrupted turn ends idle, 09da5a4 restored Stop row, a700acf transcript pinning); first streamed text after 10.2 s; Stop back to Idle in 17 ms.
- Ruling: no separate Task 12 review; the whole-branch review is told to read the three acceptance commits as a task review would — it starts minutes later on the same diff — costs one missed defect in three small commits if wrong.
- Task 12: deferred (final wave or later): read-only Bash never prompts (Claude Code auto-approves it; README must say so); the Done row cost is the session's running total, not the turn's; assistant Markdown renders as raw text (M5 design pass); `ToolSearch` and `(non-text result)` rows show raw names on the first turn.
- Task 12: complete (commits 066d977..a700acf)
- Final review: dispatched thr_ybr5ewbiwm on claude-fable-5-1 (base b8a9b27, head a700acf)
- Final review (thr_ybr5ewbiwm): With fixes — 1 Critical (is_error success results shown as Done), 5 Important (doc-tab tool stall, unrecoverable stale resume, corrupt sessions.json fatal, no .catch on the consume loop, watcher blind window), 7 Minor; triage says fix watch.ts, the .catch, dropped-queued-message marking, and the Done label before merge; rulings all upheld by the reviewer.
- Ruling: one fix wave of 13 items (Critical 1, Important 2-6, triage items 7-8, minors 9-12 because each is under ten lines and first-hour relevant, plus the ponytail comment 13); "Allow always without suggestions" and the "can wait" list stay deferred — a wider wave than the skill's minimum because every item is small and a second pass costs more than it saves.
- Final fix wave: dispatched implementer thr_q2yk3f4i4z (fresh, Opus 5.5 high); FIX_BASE = a700acf
- Final fix wave: done (12 commits 46a6712..6b1604e, 136 tests); concerns are observations (queued-send rows appear only before CLI start; Stopped row lacks "total"; restore-refusal reason only on the server console); dispatched re-review thr_7juq8fiszg
- Final re-review (thr_7juq8fiszg): all 13 addressed, no new Critical or Important breakage; `pnpm check` (136 tests) and `pnpm build` confirmed by the controller locally.
- Ruling (residual, carried to the M2 plan Task 4): the pre-init catch-all for a resumed run must append the CLI's reason to the restore-failed panel message so a missing binary or spawn error is not mistaken for a refused session id — keeps the ruled behaviour, adds the cause — costs one string if wrong.
- Ruling (residual, carried to the M2 plan Task 4): the SDK writes queued sends to the CLI as soon as it initializes, so Stop cannot pull them back; PlanSession will hold sends itself and release one per turn (after the previous result), making "queued" accurate and Stop able to drop every pending send — costs a few lines in session.ts if wrong.
- Ruling (residual, carried to the M2 plan Task 9): the Stopped row gets the same `total` label as the Done row.
- Milestone 1 complete: fast-forward merge of m1-claude-panel into main, push, archive the workspace to docs/prompts/2026-11-02-m1-claude-panel/.
