# Milestone 1 final fix wave: report

Branch `m1-claude-panel`, base `75abb44`, twelve commits, none with a co-author or generated-with trailer (checked with `git log --format='%h %s%n%b' 75abb44..HEAD | grep -ci "co-authored\|generated with"`, which prints `0`).
No real Claude session was started; all verification is the fake-SDK unit tests plus `pnpm check` and `pnpm build`.

| # | Commit | Subject |
|---|---|---|
| 1 | `46a6712` | fix(agent): report a success result flagged is_error as an error |
| 2 | `9c5d60e` | fix(agent): skip the browser round trip when no tab shows the board |
| 3 | `b8cf641` | fix(agent): start fresh when the CLI refuses a saved session id |
| 4 | `f537eaa` | fix(agent): keep the server up when sessions.json is corrupt |
| 5 | `786206e` | fix(agent): log a failure in the session loop instead of crashing |
| 6 | `c54c69f` | fix(server): detect write echoes by content instead of a time window |
| 7 | `6ac78bd` | fix(agent): report queued messages a thrown run never sent |
| 8 | `e058694` | fix(ui): label the Done row's cost as the session total |
| 9, 10 | `3716b00` | fix(agent): make Stop drop queued sends and work while starting |
| 11 | `8ce23f1` | fix(agent): keep subagent traffic out of the main transcript |
| 12 | `d780135` | fix(agent): give restored text blocks ids from their transcript line |
| 13 | `6b1604e` | docs(agent): note the ceiling of the unserialized session-id write |

## 1. is_error success results (Critical)

**Change.**
`src/server/agent/events.ts` gains an exported `resultError(msg: SDKResultMessage): string | undefined`.
It returns `errors.join("\n")` for the error subtypes, `msg.result` for a success flagged `is_error`, and `undefined` for a true success.
The mapper's `result` case emits an `error` event with that message when it is defined, otherwise the `result` event.
`src/server/agent/session.ts` uses the same function, so status becomes `error` with `msg.result` as the message.
The interrupt path (`stopped && msg.subtype !== "success"`) is unchanged, as ruled.

**Fixture typing.**
Both `test/server/agent/events.test.ts` and `test/server/agent/session.test.ts` define `SuccessFixture = Pick<SDKResultSuccess, "type" | "subtype" | "session_id" | "is_error" | "num_turns" | "duration_ms" | "total_cost_usd" | "result"> & { uuid: string }` and the matching `ErrorFixture` over `SDKResultError` with `errors`.
Every result fixture in both files now carries `is_error`, `session_id`, and `num_turns` and ends in `satisfies SuccessFixture` or `satisfies ErrorFixture`.
`uuid` is typed as `string` because the SDK's `UUID` template type would reject readable ids such as `r1`; the field the review cared about (`is_error`) and the two others are typed against the SDK.

**Tests.**
- events.test.ts: "a success result flagged is_error becomes an error event with its result text" (`Not logged in · Please run /login`).
- session.test.ts: "a success result flagged is_error sets status error with its result text".

**Red.** `pnpm vitest run test/server/agent/events.test.ts test/server/agent/session.test.ts`

```
   × a success result flagged is_error becomes an error event with its result text 5ms
   × a success result flagged is_error sets status error with its result text 1007ms
AssertionError: expected [ { kind: 'result', …(5) } ] to deeply equal [ { kind: 'error', …(3) } ]
AssertionError: expected 'idle' to be 'error' // Object.is equality
      Tests  2 failed | 15 passed (17)
```

**Green.** `pnpm vitest run test/server/agent` plus both typechecks and Biome

```
      Tests  37 passed (37)
Checked 73 files in 74ms. No fixes applied.
```

## 2. Board tools stall when no tab shows the board (Important)

**Change.**
`src/server/agent/tools.ts`: `get_selection` reads `hub.activeBoard` first and returns `Nothing is selected on the board.` without a request when it is `null`.
`get_board` requests the PNG only when `hub.activeBoard === board`; otherwise it returns the Markdown with `(No PNG: board <name> is not open)` appended.

**Tests** in `test/server/agent/tools.test.ts`:
- "get_board asks for a PNG only when the board is the one open in the tab" (active board `null` and a different board; asserts no request and the note).
- "get_selection answers nothing-selected without asking the browser when no board is open".
- The existing browser-failure case now sets `hub.activeBoard = "zeta"` so it still exercises the request path.

**Red.** `pnpm vitest run test/server/agent/tools.test.ts`

```
   × get_board asks for a PNG only when the board is the one open in the tab 4ms
   × get_selection answers nothing-selected without asking the browser when no board is open 1ms
      Tests  2 failed | 5 passed (7)
```

**Green.** same command

```
      Tests  7 passed (7)
```

## 3. Refused resume id retried forever (Important)

**Change.**
`Run` in `session.ts` now records `resumed` (started with a saved id) and `initialized` (init message arrived).
In `#consume`'s catch, when the run is still current, was resumed, and never initialized, the session id is cleared and the error message becomes the existing `RESTORE_FAILED` text, which is emitted as the `error` event and the status message.
The CLI's own reason is kept in a `console.warn` line (`could not resume session <id>: <reason>`) so it is not lost.
The next send has no session id, so it starts without `resume`.

**Test** in session.test.ts: "a resumed run that throws before init drops the saved id and the next send starts fresh" (the first run throws `No conversation found with session ID: old`; asserts `resume: "old"` on run 1, the restore-failed event and status, no `resume` on run 2, and the new id saved). It spies on `console.warn` so the test output stays clean.

**Red.** `pnpm vitest run test/server/agent/session.test.ts`

```
   × a resumed run that throws before init drops the saved id and the next send starts fresh 60ms
AssertionError: expected 'old' to be undefined
      Tests  1 failed | 12 passed (13)
```

**Green.** same command

```
      Tests  13 passed (13)
```

## 4. Corrupt sessions.json took the server down (Important)

**Change.**
`src/server/agent/index.ts`: `createAgent` catches the `readSessions` error and starts from `{ plan: null, runs: [] }`, recording `loadError = "sessions.json could not be read: <reason>. Fix or delete .blueprint/sessions.json."`.
`status()` reports `{ status: "error", message: loadError }` while it is set (a pending permission still wins as `needs_you`).
`send()` clears it before calling the session, so the first send's status broadcast is the session's own.
`onSessionId` falls back to the startup value when the file still cannot be read, so the first send's session id overwrites the corrupt file, as ruled.

**Test** in `test/server/agentRoutes.test.ts`: "createAgent survives a corrupt sessions.json and reports it until the first send".
It writes `{not json` to the temp store's sessions.json, builds the real app, asserts `GET /api/agent/state` answers 200 with status `error` and the message pattern, then sends once and asserts the status is no longer `error`, the file now holds `s1`, and the query had no `resume`.

**Red.** `pnpm vitest run test/server/agentRoutes.test.ts`

```
   × createAgent survives a corrupt sessions.json and reports it until the first send 7ms
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
      Tests  1 failed | 6 passed (7)
```

**Green.** same command

```
      Tests  7 passed (7)
```

## 5. Unhandled rejection from the session loop (Important)

**Change.**
`session.ts` `#start`: `void this.#consume(run).catch((err) => console.error("session loop failed", err));`.
No test was named; the existing session tests cover the loop.

**Command.** `pnpm vitest run test/server/agent/session.test.ts`

```
      Tests  13 passed (13)
```

## 6. Write-echo suppression hid outside edits (Important)

**Change.**
`src/server/files.ts`: the private `recentWrites` map and `wasWrittenRecently` are gone.
The private `write` records `sha256(data)` per absolute path in `ownWrites` (before the rename, so the watcher can never see the file first).
`async isOwnWrite(absPath)` reads the file now on disk and compares its sha256 with the recorded one; an unknown path or an unreadable file is `false`.
A small `sha256` helper over `createHash("sha256")` also replaces the inline hash in `writeBoard`.
`src/server/watch.ts`: the report awaits `store.isOwnWrite(path)` and skips only a true echo; a rejection from the async report is logged instead of left unhandled.

**Tests.**
- `test/server/files.test.ts`: "isOwnWrite matches the store's last write by content, not by time" replaces the `wasWrittenRecently` test (own write true, unknown path false, outside edit right after the own write false).
- `test/server/watch.test.ts`: "watcher reports an outside edit made right after the server's own write". The existing "ignores the server's own write" test still holds.

**Red.** `pnpm vitest run test/server/files.test.ts test/server/watch.test.ts`

```
   × isOwnWrite matches the store's last write by content, not by time 5ms
   × watcher reports an outside edit made right after the server's own write 2623ms
TypeError: store.isOwnWrite is not a function
Error: no event for a
      Tests  2 failed | 14 passed (16)
```

**Green.** same command, then the watcher file five times in a row to check for flakiness

```
      Tests  16 passed (16)
      Tests  3 passed (3)
      Tests  3 passed (3)
      Tests  3 passed (3)
      Tests  3 passed (3)
      Tests  3 passed (3)
```

## 7. Queued messages dropped silently after a thrown turn

**Change.**
`InputQueue.drain()` removes the messages the SDK has not taken and returns how many there were.
`#stopRun()` drains before ending the queue and returns that count.
In `#consume`'s error path the session error is emitted first, then one `error` event per dropped message with `Message not sent: Claude session ended before it ran` (through a small `#notSent(count, message)` helper shared with finding 9).

**Fake SDK.**
I read the SDK: `Query.streamInput` awaits `initializeWritten` and then drains the prompt iterable eagerly, so messages stay in `InputQueue` only before the CLI is initialized or when it stops reading.
The session-test fake therefore gained a `readLimit` option: it reads at most that many prompt messages (0 reads none) and leaves the rest queued.

**Test** in session.test.ts: "messages still queued when a run throws are each reported as not sent" (`readLimit: 1`, two sends queued behind a turn that then throws; asserts `["process exited", <not sent>, <not sent>]`).

**Red.** `pnpm vitest run test/server/agent/session.test.ts`

```
   × messages still queued when a run throws are each reported as not sent 106ms
AssertionError: expected [ 'process exited' ] to deeply equal [ 'process exited', …(2) ]
      Tests  1 failed | 13 passed (14)
```

**Green.** `pnpm vitest run test/server/agent`

```
      Tests  42 passed (42)
```

## 8. Done row cost is the session total

**Change.**
`src/ui/panel/ClaudePanel.tsx` renders a success result as `Done · $<cost> total`, with a comment that the SDK's cost is the session's running total.
The Stopped row is unchanged (`Stopped · $<cost>`), since the ruling names only the Done row.

**Test.** The existing expectation in `test/ui/ClaudePanel.test.tsx` is now `screen.getByText("Done · $0.0123 total")`.

**Red** (test change with the source change stashed). `pnpm vitest run test/ui/ClaudePanel.test.tsx`

```
   × panel renders restored transcript, sends on Enter with the current selection, shows Stop while working 95ms
TestingLibraryElementError: Unable to find an element with the text: Done · $0.0123 total.
```

**Green.** same command

```
      Tests  5 passed (5)
```

## 9 and 10. Stop drains the queue and works while starting

**Change, 9.**
`PlanSession.interrupt()` on an initialized run drains `InputQueue` and emits one `error` event per dropped item with `Message not sent: stopped`, then calls `query.interrupt()` as before.

**Change, 10.**
When `interrupt()` runs before the init message arrived (`run.initialized` false), it calls `#stopRun()`, emits `Message not sent: stopped` for every message it dropped (before init the CLI has taken none, so this includes the message that started the run), sets status `stopped`, and does not call `query.interrupt()`.
The next send starts a new query (resuming the saved id if there is one).
In `ClaudePanel.tsx`, `busy` now includes `starting`, so Stop is enabled then; the composer stays disabled while starting, as before.

**Tests.**
- session.test.ts: "interrupt drops the messages still queued and reports each as not sent" (`readLimit: 1`; two queued sends; asserts `query.interrupt` called once, two not-sent errors, and the turn still ends as the stopped result).
- session.test.ts: "interrupt while the CLI is still starting closes the run instead of interrupting it" (`readLimit: 0`; asserts no `query.interrupt`, `close` called, status `stopped`, the not-sent error, and a second query on the next send).
- ClaudePanel.test.tsx: "an error status shows the message" now asserts Stop is enabled in `starting` and that clicking it calls `agentInterrupt`.

**Red.** `pnpm vitest run test/server/agent/session.test.ts test/ui/ClaudePanel.test.tsx`

```
   × an error status shows the message 9ms
   × interrupt drops the messages still queued and reports each as not sent 65ms
   × interrupt while the CLI is still starting closes the run instead of interrupting it 2ms
Error: expect(element).toBeEnabled()
AssertionError: expected [] to deeply equal [ 'Message not sent: stopped', …(1) ]
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
      Tests  3 failed | 18 passed (21)
```

The first implementation run showed the fake marking its input ended when it merely stopped reading (`expected 'error' to be 'idle'`); the fake now sets `inputEnded` only when the prompt iterable is done.

**Green.** `pnpm vitest run test/server/agent test/ui/ClaudePanel.test.tsx`

```
      Tests  49 passed (49)
```

## 11. Subagent traffic in the main transcript

**Change.**
`SdkEventMapper.map` returns no events for any message with a non-null `parent_tool_use_id`, before touching its stream state.

**Test** in events.test.ts: "subagent messages are skipped and leave the main stream's state alone" (a main stream starts, subagent `message_start`, delta, assistant text plus tool use, and tool result all map to `[]`, and the next main delta still continues `msg_main:0` as `Hello world`).

**Red.** `pnpm vitest run test/server/agent/events.test.ts`

```
   × subagent messages are skipped and leave the main stream's state alone 5ms
AssertionError: expected [ …(4) ] to deeply equal []
      Tests  1 failed | 5 passed (6)
```

**Green.** `pnpm vitest run test/server/agent`

```
      Tests  45 passed (45)
```

## 12. Restored text blocks collide on message id

**Change.**
`SdkEventMapper.map(msg, idBase?)`: a non-streamed text block's id is `${idBase ?? msg.message.id}:${index}`.
`restore()` passes the transcript line's `uuid`.
Live streaming is unchanged.

**Tests** in session.test.ts:
- New: "restore keeps every text block when transcript lines share one message id" (two lines with `message.id: "msg_shared"`; asserts `a1:0 First.` and `a2:0 Second.`).
- The existing restore test's expected id changes from `msg_old:0` to `a1:0`.

**Red.** `pnpm vitest run test/server/agent/session.test.ts`

```
   × restore seeds the transcript from the saved session and a failure starts fresh with an error event 8ms
   × restore keeps every text block when transcript lines share one message id 1ms
AssertionError: expected [ { kind: 'assistant_text', …(4) } ] to match object [ …(2) ]
      Tests  2 failed | 15 passed (17)
```

**Green.** `pnpm vitest run test/server/agent`

```
      Tests  46 passed (46)
```

## 13. ponytail comment on onSessionId

**Change.**
`src/server/agent/index.ts`, above the read-modify-write in `onSessionId`:

```ts
// ponytail: unserialized read-modify-write, safe while the plan session is the only
// writer; serialize through a promise chain once run sessions write the file too.
```

**Command.** `pnpm biome check src/server/agent/index.ts`

```
Checked 1 file in 5ms. No fixes applied.
```

## Touched test files, verbose

`pnpm vitest run --reporter=verbose test/server/agent/events.test.ts test/server/agent/session.test.ts test/server/agent/tools.test.ts test/server/agentRoutes.test.ts test/server/files.test.ts test/server/watch.test.ts test/ui/ClaudePanel.test.tsx`

```
 Test Files  7 passed (7)
      Tests  58 passed (58)
```

## Final `pnpm check`

```
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 81 files in 50ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard

 Test Files  27 passed (27)
      Tests  136 passed (136)
   Start at  19:02:21
   Duration  4.99s (tests 35%, environment 26%, setup 22%, import 12%, transform 4%, worker 1%)
```

Exit code 0, no warnings or stderr lines in the output.

## Final `pnpm build`

Exit code 0, ending:

```
dist/ui/assets/chunk-EIO257PC-HmB18WqQ.js                1,820.99 kB │ gzip: 744.20 kB
dist/ui/assets/index-DF3OZ1F-.js                         1,936.69 kB │ gzip: 628.87 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
...
✓ built in 949ms
```

The chunk-size warning was already there before this wave (Excalidraw and Mermaid bundles); it is outside these findings and was left alone.

## Concerns

- Findings 7 and 9 act on `InputQueue`, but the real SDK drains the prompt iterable eagerly once the CLI's initialize request is written. After init, a message queued behind a turn is usually already on the CLI's stdin, so the drop and the "Message not sent" rows mostly apply before init (which is exactly finding 10's case). Whether the CLI runs a message it already received after an interrupt is still unverified without a real turn.
- Finding 8 labels only the Done row as `total`, as ruled; the Stopped row shows the same running total without the word.
- Finding 3 shows only the restore-failed text in the panel; the CLI's reason goes to the server console through `console.warn`.
