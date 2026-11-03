I have everything I need. Here is the review.

## Review: milestone 1, Claude panel (b8a9b27..a700acf)

### Strengths

- **The session core is well designed.** `InputQueue` plus one long-lived `query()` is the right shape for streaming input. The `Run` token pattern (`this.#run !== run`) makes reaping a dead query, restarting on error, and ignoring a stale consumer loop simple and correct. The error-result path keeps the query alive and restarts lazily on the next send with `resume`, which matches the plan's status rules.
- **The fake SDK in the session tests is faithful where it matters.** It consumes the prompt iterable eagerly in the background like the real transport, keeps the query open until closed, and scripts per-turn output. The tests cover queueing, thrown queries, error results, a query that ends on its own, a throwing event sink, restore success and failure, interrupt-then-error-result, and the transcript cap. That is real behavior, not mock choreography.
- **Trust decisions are keyed correctly.** `canUseTool` auto-allows only `mcpServer.source === "sdk"` with name `blueprint`, exactly as the SDK typings advise, and the test proves a config look-alike still prompts. The board-write guard anchors on the repository root and the test covers the `cd` bypass.
- **Interrupt and permission interplay is right.** Stop cancels pending asks as deny before `query.interrupt()`, status falls back from `needs_you` automatically, and the acceptance commit that maps the interrupt's error result to a `Stopped` row (with cost) is the correct reading of the CLI.
- **The WebSocket request channel is tight.** Timeout, no-tab, error response, and socket-leave rejections are all tested; `settle` clears the timer and the map once; the active-socket rule is explained in a comment.
- **UI robustness details are thoughtful.** Live events that beat the restore are reduced on top of it, partials arriving after a final are dropped, a failed send puts the text back, the selection header is hidden from the user bubble, and the socket close waits for CONNECTING to end so StrictMode stays quiet.
- **Milestone 0 fixes are real improvements.** `replaceFromDisk` keeps undo clean and the cursor stable; the board watcher now waits for the save queue.
- **Ruling verification.** I checked the SDK typings: `settingSources` omitted does load user, project, and local (so the global constraint and the ruling hold), `mcpServer` is present on the `canUseTool` options, `getSessionMessages` returns an empty array for an unknown session (so the empty-check in restore is what makes "start fresh" work).

### Issues

#### Critical (Must Fix)

1. **`src/server/agent/events.ts:142` treats every `subtype: "success"` result as success, but the CLI reports auth and API failures as `subtype: "success"` with `is_error: true` and the message in `result`.** I confirmed in the SDK typings (`SDKResultSuccess.is_error`, `result`, `api_error_status`) and in the bundled CLI, whose main result builder emits `variant:{subtype:"success", api_error_status, result}` with `is_error: ht||Cs`. The CLI's auth strings are "Not logged in · Please run /login" and "Session expired. Please run /login to sign in again." With this mapper, an expired login renders as `Done · $0.0000` and status `Idle`, the error text in `result` is dropped, and the user is left guessing. This is Review Focus 1, and the acceptance run could not exercise it because it ran logged in. Fix: in the `result` case, when `is_error` is true emit an `error` event with `msg.result` (and in `session.ts` set status `error` with that message); nothing else changes. Add one fixture to `events.test.ts` and one to `session.test.ts`.

#### Important (Should Fix)

2. **`src/server/agent/tools.ts:80` and `:63` stall for the full 10 second timeout whenever the one open tab is showing a doc or the sidebar only.** `get_selection` requests a snapshot before looking at `hub.activeBoard`, and `get_board` always requests a PNG even when `activeBoard` is another board or null. A `DocView` tab has no responder for `request`, so nothing answers and the tool returns "the browser did not answer in time" after 10 seconds. A user who opens a doc and asks "summarize the board" hits this in the first hour. Fix on the server, two lines: `get_selection` returns "Nothing is selected" without a request when `hub.activeBoard === null`; `get_board` skips the PNG request unless `hub.activeBoard === board` and notes "(No PNG: board X is not open)". Alternatively give `App` a fallback responder that answers unclaimed requests with `ok: false`.

3. **`src/server/agent/session.ts:183` retries the same `resume` id forever when the CLI refuses it.** `restore()` handles a missing transcript, but if the transcript exists and the CLI exits non-zero on resume (corrupt line, version mismatch), the run throws, the id stays, and every subsequent send throws the same way. The user cannot recover without deleting `sessions.json`. Review Focus 5 asks for "start fresh and say so". Fix: in `#consume`, if the run throws before its init message arrived and `resume` was set, clear `#sessionId`, emit the existing `RESTORE_FAILED` message, and let the next send start fresh.

4. **`src/server/index.ts:35` makes a corrupt `sessions.json` fatal for the whole server.** `readSessions` throws a Zod error from `createAgent` and `startServer` rejects, so boards and docs are unreachable because of a file the agent owns. The plan's test asked that corruption be "reported, not silently replaced", which this satisfies, but reporting should not take the editor down. Fix: catch in `createAgent`, start with no session id, emit an `error` event naming the file, and keep the rest of the server up.

5. **`src/server/agent/session.ts:190` has no `.catch` on `void this.#consume(run)`.** The body is in try/catch, but the cleanup emit and `#setStatus` after the catch run outside it. If `onEvent` throws there, it is an unhandled rejection, which terminates the Node process. Today the sinks are `hub.broadcast`, which does not throw, so it is latent, but it is a server-crash class with a one-line fix.

6. **`src/server/watch.ts:37` (deferred Task 10 item, not minor).** The 1 second suppression after Blueprint's own write hides an outside edit made in that window, and the next save overwrites it. The deferred list parks this for "the final fix wave"; this is that wave. The UI already detects echoes by content, so the suppression can go, or compare content hashes.

#### Minor (Nice to Have)

7. **`src/server/agent/events.ts:92` collides ids when restoring.** Claude Code writes one transcript line per content block, all sharing `message.id`, so two text blocks from one response restore as `msgid:0` twice; the second overwrites the first in the Map and takes its position. Use `msg.uuid` as the id base in the restore path (or pass it through the mapper).

8. **`src/server/agent/events.ts` ignores `parent_tool_use_id`.** Subagent traffic (any `Task` call) streams into the panel as if it were the main assistant and clobbers `#messageId`. Either skip messages with a non-null `parent_tool_use_id` or show them as a muted "subagent" row.

9. **Stop does not drain the send queue.** A message queued behind the stopped turn was already written to the CLI's stdin, so whether it runs after the interrupt is the CLI's choice. I could not verify without a real turn. If it runs, a user who pressed Stop pays for a turn they did not want; `interrupt()` should also drop queued items from `InputQueue` and mark their user events.

10. **`src/ui/panel/ClaudePanel.tsx:179` disables Stop while `starting`.** If the CLI hangs at startup (a slow MCP server from the user's config, a stuck login), nothing in the UI can stop it, and `query.interrupt()` on an uninitialized process waits for a control reply. Enable Stop in `starting` and have the session `close()` the run instead of interrupting when no init has arrived.

11. **`src/server/agent/broker.ts:64` turns "Allow always" into "allow once" silently when the SDK sends no suggestions.** Show the user the difference, or label the button by whether suggestions exist.

12. **`src/server/agent/index.ts` `onSessionId` read-modify-write is unserialized** (deferred). Harmless with one writer today; keep the ponytail comment the controller asked for.

13. **Test shape drift.** The session-test result fixtures omit `is_error`, `session_id`, and `num_turns`; the restore fixtures never model two lines with one `message.id`. Both gaps are why issues 1 and 7 went unseen. The events test does include `is_error: false` on its success fixture, so the fake knew the field and the code ignored it.

### Deferred-list triage

Fix before merge:
- Task 10 watch.ts suppression window (issue 6): data loss path, controller already marked it "not minor".
- Task 6 `void this.#consume(run)` without `.catch` (issue 5): one line, server-crash class.
- Task 6 "queued messages silently dropped after a thrown turn": not the drop itself, but the UI should mark those user bubbles as unanswered; otherwise the user waits for a reply that never comes. Cheap: emit an `error` per dropped queued message in `#stopRun` from the error path.
- Task 12 "Done row cost is the session total, not the turn's": a one-word label change (`Total $x`) stops a misleading number; the SDK docs say the cost is cumulative.

Can wait:
- Task 1 Zod/type drift (already annotated with `z.ZodType<SessionsFile>`).
- Task 2 pending-request timer unref, any-socket response, throwing `onClient` listener, test details.
- Task 3 out-of-order sidebar refreshes, StrictMode warning, mock counts.
- Task 4 unknown request kinds, non-Error rejections, stale debounced selection on switch.
- Task 5 duplicate toolUseID, `summarizeTool` undefined interpolation, untested branches, subagent mapper state (issue 8 raises it to Minor).
- Task 7 case-insensitive paths and symlinks, private `_registeredTools`, per-end nulling, Bash can still write boards (design accepted; proposals in M2 are the real guard).
- Task 8 `agent.close()` try/finally (`query.close()` is synchronous, so nothing hangs), board-read catch breadth, 400 text, test bundling.
- Task 9 double-submit, dialog left up on failure (that is correct behavior), restore re-adding an answered ask, `AgentState` duplication, selectionLabels test location, no BoardView unit test.
- Task 10 placeholder copy, docReload test mirroring, Fast Refresh.
- Task 11 builder duplication.
- Task 12 read-only Bash README note (M5), raw Markdown (M5), raw `ToolSearch` names.

Rulings: none look wrong. I verified the two that rest on SDK facts (default `settingSources` loads all sources; `mcpServer.source` exists and is the documented trust key). The "no separate Task 12 review" ruling cost nothing in the three commits, which are sound; what it could not catch is issue 1, since a logged-in acceptance run never produces an `is_error` success result.

### Declined to judge

- The Claude subprocess can `curl` `POST /api/agent/permission` to approve its own ask once it has Bash: inherent to Claude Code's permission model and the design's local-only trust; noted, not graded.
- Bash can write board files (system prompt only): the design's hook covers file tools only, and the deferred list already records it for M2 proposals.
- Assistant Markdown rendered raw, status colors as hex, panel placeholder while a doc is open: design pass, M5 by ruling.
- Allow-always persistence beyond the session (design 10): depends on the SDK honoring `updatedPermissions`; not verifiable without a real turn.
- Tool activity derived from the message stream rather than hooks (design 6.4 names hooks): a justified simplification, same information, fewer moving parts.
- `get_selection` with no tab returns a tool error rather than "text only" (design 6.5): with no tab there is no selection, so an error is the honest answer.
- Windows paths, large-board PNG timing (design 10): outside this milestone.
- The acceptance report's observations: I could not re-run them without spending the user's allowance.

### Recommendations

1. Fix issue 1 first; it is three lines plus two fixtures and closes Review Focus 1 for real.
2. Fix issues 2 to 6 in one small commit each; all are under ten lines.
3. Add a shape test that builds fixtures from the SDK's own `SDKResultSuccess` type with `satisfies`, so `is_error` cannot be omitted again.
4. When M2 adds `PlanSession.send(text, shown)`, also carry `msg.uuid` into the restore ids (issue 7) since that code moves anyway.

### Assessment

Ready to merge? **With fixes**

Reasoning: the architecture and tests are solid and the "done when" row is met for a logged-in user, but the panel misreports the most likely real failure (an expired login) as a successful turn, and two cheap stalls or dead ends (doc-open tool timeout, unrecoverable stale resume) would hit a user in the first hour.
