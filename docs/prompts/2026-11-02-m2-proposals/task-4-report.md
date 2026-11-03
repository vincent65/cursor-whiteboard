# Task 4 report: prompt, guard copy, agent wiring, and proposal routes

Status: DONE_WITH_CONCERNS (one wording concern, below; everything the brief and rulings specify is implemented and green).

Commit: `b0e701a feat(agent): proposal routes, refine and decision notes, and the proposal prompt`

## What I implemented

### `src/server/agent/prompt.ts`
- `SYSTEM_PROMPT_APPEND` gains the three propose / ghosts / revise lines verbatim, right after the "Read boards only" line.
- `composeUserMessage(text, header, notes = [])` joins the non-empty parts of `[...notes, header, text]` with a blank line.

### `src/server/agent/hooks.ts`
- Denial reason is now `Blueprint board files are read-only here. Propose changes with the propose tool instead.`

### `src/server/agent/session.ts`
- `send(text, shown = text)`: the `user` event carries `shown`; `text` goes to the SDK.
- Send gating: each `Run` has `busy` and `held`.
  A send while a turn is in flight goes to `held`; on every `result` (success, error, or interrupted), `#turnEnded` hands the next held send to the `InputQueue`.
  The `InputQueue` therefore never holds more than the current turn's message.
- `interrupt()` on an initialized run drops the whole held queue with one `Message not sent: stopped` event each; the turn in flight is interrupted as before.
  It no longer drains the `InputQueue`: an initialized SDK has already taken the in-flight message, and draining it could leave a turn that never produces a result, wedging `busy`.
- `#stopRun()` reports `input.drain() + held` as not sent (covers both the not-yet-initialized case and a thrown run).
- When a held send is handed over at a result, status goes straight to `working` (no idle flicker), so the old `stream_event → working` ponytail workaround is deleted.
- After an error result with a held send, the held send runs on the same query (status `working`); the error stays in the transcript.
  This matches what the CLI did with queued sends before.
- Resumed run failing before init now reports `The previous session could not be loaded (<error message>); starting fresh.` via a `resumeFailed(cause)` template.
  `RESTORE_FAILED` is unchanged and still used for `restore()` failures.
- `#start()` returns the new `Run` (avoids a cast in `send`).

### `src/server/agent/proposals.ts` (Task 3 ruling)
- `ProposalBusyError` class.
- `beginRevise(id)` / `endRevise(id)`; `decided()` throws `ProposalBusyError("proposal <id> is being revised")` while a revise is in flight (checked after the not-pending check, so unknown ids still 404).
- `beginRevise` also throws the same error if a revise of that id is already in flight, so two concurrent revises cannot clear each other's guard.

### `src/server/agent/tools.ts` (Task 3 rulings)
- `revise` brackets the browser round trip and the `revised()` log with `beginRevise`/`endRevise` in `try/finally`.
- `checkIds` filters through `withoutAddGhosts`, so add ghosts are unknown ids.
- The pending line is `Pending proposals on this board: ...` and only lists proposals whose `board` is the one being read (`get_board`'s board; `get_selection`'s open board; no line when no board is open).

### `src/server/agent/index.ts`
- One `ProposalStore` is built, `load()`ed, and passed to `createBoardTools`.
- A `load()` failure does not reject: it adds `proposals.jsonl could not be read: <reason>. Fix or delete .blueprint/proposals.jsonl.` to the startup error status (same mechanism as the corrupt `sessions.json`; both are joined if both fail) and continues with nothing pending.
  The status clears on the first send, like the sessions case.
- `send(text, selection, proposalId)`: awaits the selection header, then without further awaits checks `proposalId` is pending (else `NotFoundError("proposal <id> is not pending")`), takes the notes, appends the refine note, and calls `session.send(composeUserMessage(text, header, notes), text)`.
  The check runs before `takeNotes()`, so a refused send loses no decision notes; it runs after the only await, so a decision cannot slip in between.
- `pendingProposals()` and `decideProposal(id, decision)` delegate to the store.

### `src/server/agentRoutes.ts`
- `SendBody.proposalId: z.string().optional()`, forwarded to `agent.send`; `NotFoundError` reaches `app.onError` → 404 `{ error: "proposal <id> is not pending" }`.
- `GET /proposals` → `agent.pendingProposals()`.
- `POST /proposals/:id/decision` with `{ decision: "accepted" | "rejected" }` → 204; 400 on a bad body; 404 via `onError` when not pending; 409 when `ProposalBusyError`.

### `src/server/index.ts`
- `close()` wraps `agent.close()` in `try/finally` so clients are terminated and the server closes even if it rejects.

## TDD evidence

RED (tests written first, before any source change):

```
$ pnpm vitest run test/server/agent
 ❯ test/server/agent/hooks.test.ts (3 tests | 1 failed)
   × denyBoardWrites denies a Write under .blueprint/boards and allows src/x.ts
 ❯ test/server/agent/prompt.test.ts (5 tests | 3 failed)
   × composeUserMessage puts notes before the header and the text
   × the prompt explains propose and revise
   × SYSTEM_PROMPT_APPEND covers its topics in order
 ❯ test/server/agent/proposals.test.ts (7 tests | 1 failed)
   × a proposal cannot be decided or revised again while a revise is in flight
 ❯ test/server/agent/tools.test.ts (18 tests | 3 failed)
   × propose treats add ghosts as unknown ids, as the board reads do
   × a revise in flight holds off decisions on its proposal, and releases them on failure too
   × board reads hide add ghosts and list pending proposals
 ❯ test/server/agent/session.test.ts (18 tests | 5 failed)
   × send shows the typed text in the user event and sends the composed text
   × a second send during a turn is held by the session and handed over after the first result
   × a resumed run that throws before init drops the saved id and the next send starts fresh
   × messages still queued when a run throws are each reported as not sent
   × interrupt drops the messages still queued, so the SDK never gets them, and reports each as not sent

$ pnpm vitest run test/server/agentRoutes.test.ts
   × send returns 202 with the id and rejects empty text with 400
   × send forwards proposalId and 404s when it is not pending
   × proposal routes list pending proposals and record decisions
   × createAgent prefixes decision notes and refine requests to the next message
   × createAgent survives a torn proposals.jsonl: reports it, starts with nothing pending, and still appends
      Tests  5 failed | 6 passed (11)
```

Note on the Stop test: as first rewritten it passed against the old code, because `interrupt()` drained the `InputQueue` synchronously before the fake's background reader got a microtask.
I added a 10 ms wait before `interrupt()` (an initialized SDK takes whatever the prompt yields at once) plus `expect(runs[0].read).toEqual(["long"])`, after which it failed on the old code as it should.

GREEN:

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 85 files in 48ms. No fixes applied.
 Test Files  29 passed (29)
      Tests  167 passed (167)
```

No stderr output in the test run.
`pnpm build` prints only the pre-existing `(!) Some chunks are larger than 500 kB after minification.` warning.

## Tests changed or added
- `prompt.test.ts`: new notes test and propose/revise test; the topic-order test now uses more specific anchors (`selection header like`, `Diagrams must be`) because the new propose line mentions both "Mermaid" and "selection header" earlier in the prompt, and it checks the new lines' order.
- `hooks.test.ts`: denial text updated verbatim.
- `session.test.ts`: the fake query records every message it reads (`run.read`).
  The queued-send test now asserts the SDK has read only `first` until the first result and that statuses are exactly `starting, working, idle`.
  The run-throws and Stop tests no longer use `readLimit` (gating, not the fake, keeps the sends back); the Stop test also checks that a send after Stop runs after the stopped turn's result.
  New tests: `send(text, shown)`, and a held send after an error result.
  The resume-failure test expects the new message with the cause.
- `proposals.test.ts`: busy guard test.
- `tools.test.ts`: add ghost ids rejected; revise bracketing (decision refused mid round trip, released on success and on browser failure); pending line now names only this board (a `flow` proposal is added and must not appear).
- `agentRoutes.test.ts`: proposal routes (200/204/400/404/409); send with `proposalId` (202/404/400); wiring test with an `echoSdk` fake that answers each message with a result (needed now that sends are gated per turn) covering decision notes, the refine note, the user bubble showing typed text, refused refines keeping notes, and decisions on unknown ids; torn `proposals.jsonl` test that checks the status message, empty pending, and that `propose` through the real MCP tool (with a fake tab answering over the real `WsHub`) still appends.

## Manual verification

The brief names none.
I ran a smoke test against the built server (`dist/server/index.js`, `startServer` on a temp root with a seeded `proposals.jsonl`):

```
GET proposals 200 [{"id":"p_1","board":"main","title":"Cache",...}]
decide bad 400 {"error":"✖ Invalid option: expected one of \"accepted\"|\"rejected\"\n  → at decision"}
decide p_9 404 {"error":"proposal p_9 is not pending"}
send p_9 404 {"error":"proposal p_9 is not pending"}
decide p_1 204
GET proposals 200 []
closed
```

The log gained `{"event":"accepted",...,"id":"p_1"}`.
After appending a torn line and restarting, `/api/agent/state` returned `{"status":"error","message":"proposals.jsonl could not be read: proposals.jsonl line 3: Unterminated string in JSON at position 13 (line 1 column 14). Fix or delete .blueprint/proposals.jsonl.",...}` and the server stayed up.
I did not send a real message to Claude (that would run the SDK on the user's login); the composed-message path is covered by the wiring tests.

## Files changed
- `src/server/agent/prompt.ts`, `hooks.ts`, `session.ts`, `index.ts`, `proposals.ts`, `tools.ts`
- `src/server/agentRoutes.ts`, `src/server/index.ts`
- `test/server/agent/prompt.test.ts`, `hooks.test.ts`, `session.test.ts`, `proposals.test.ts`, `tools.test.ts`
- `test/server/agentRoutes.test.ts`

`src/ui/panel/ClaudePanel.tsx` is untouched (Task 9).

## Self-review findings
- Fixed during review: the pending check in `Agent.send` originally ran before `await header(...)`, so a decision could land between the check and the send; moved after the await.
- Fixed during review: a string-`replace` trick for the resume-failure message was replaced by a plain template.
- `decided()` checks not-pending before busy, so a busy-but-pending proposal is 409 and an unknown one is 404.
- The busy check runs inside the store's serial queue, so a decision queued just before `beginRevise` is refused too (conservative, harmless).
- When no board is open, `get_selection` returns the nothing-selected text with no pending line (no board is being read).

## Concerns
- `close()`: the brief says the `try/finally` makes clients terminate and the server close "even if the session hangs or rejects".
  `try/finally` covers a rejection; a `close()` that never settles would still block.
  Today `PlanSession.close()` does not await anything that can hang (it ends the input and calls `query.close()` synchronously), so this is fine in practice; a timeout race would be needed if that changes.
- "Keep the existing constant for the prefix": the required message (`The previous session could not be loaded (<cause>); starting fresh.`) does not share a literal prefix with `RESTORE_FAILED` (`previous session could not be loaded; starting fresh`), so I kept `RESTORE_FAILED` unchanged for the `restore()` path and added a `resumeFailed(cause)` template for the run-failure path.
  If the intent was for `restore()` failures to carry the cause too, that is a small follow-up.

## Fix round 1

Commit: `e5a3485 fix(proposals): survive a torn log tail and close the revise/decide window`

### What changed

1. Torn `proposals.jsonl` tail (Important).
   - `FileStore.readProposals` skips the last line when the file does not end with `\n` and that line is not valid JSON, with `console.warn("proposals.jsonl: ignoring a torn last line")`.
     Every other bad line still throws with its line number (a bad line mid-file, a bad last line that ends with `\n`, and whole JSON that fails the schema).
   - `FileStore.appendProposal` checks the tail first (`open` + `stat` + a one-byte positional read; the whole file is read only when the last byte is not `\n`).
     If the unterminated last line is valid JSON, it writes a leading `\n` as ruled.
     **Deviation:** if the unterminated last line is torn (not JSON), it truncates the file to drop that line instead of writing a leading `\n`.
     Reason: with only a leading `\n`, the torn line stays in the file but is no longer last, so the next `readProposals` throws on it and the ruling's own restart assertion (the appended proposal is pending on a second `createAgent`, and the log has exactly two well-formed lines) cannot pass.
     The dropped line was never applied (readProposals skips it and memory only changes after a successful append), so nothing is lost.
   - The agent-level test is split in two: a corrupt line that ends with `\n` still gives the startup error status, nothing pending, and appends still work; a torn tail warns, keeps `p_1` pending with status `idle`, and a proposal appended through the real `propose` tool is pending on a second `createAgent` over the same store; the log then has exactly two lines, both valid JSON.
2. Revise/decide window (Minor).
   `ProposalStore.beginRevise(id)` now returns a promise, runs through `serial()`, and calls `pendingOrThrow` (404) before the busy check (409).
   The `revise` tool awaits it before `checkIds` and calls `endRevise` in a `finally` that covers the id check, the browser round trip, and the log append.
3. 409 mapping (Minor).
   `statusFor` in `src/server/app.ts` maps `ProposalBusyError` to 409 alongside `ExistsError`; the decision route's local try/catch is gone.
4. Send gating assumption (Minor).
   Comment at `#hand` in `session.ts`: it assumes exactly one `result` per handed message; a batched turn or a dropped result would leave `busy` set and every held send waiting until a Stop or the run ends.

### Covering tests
- `test/server/files.test.ts`: "a torn last line is skipped with a warning, and the next append cuts it off"; "a whole last line missing only its newline is kept, and the next append starts a new line"; "a bad line that is not a torn tail still fails the read" (already passing, kept as the guard that only the torn tail is forgiven).
- `test/server/agentRoutes.test.ts`: "createAgent survives a corrupt proposals.jsonl: ..." and "a torn proposals.jsonl tail is skipped, and a proposal appended after it replays on restart"; the existing 409 route test now goes through `statusFor`.
- `test/server/agent/proposals.test.ts`: the busy test awaits `beginRevise`; new "beginRevise requires a pending proposal and queues behind a decision in flight".
- `test/server/agent/tools.test.ts`: new "revise holds off decisions from before it reads the board for id checks" (a decision during a gated `readBoard` is refused; a failed id check releases the proposal).

### RED

```
$ pnpm vitest run test/server/files.test.ts
   × a torn last line is skipped with a warning, and the next append cuts it off
   × a whole last line missing only its newline is kept, and the next append starts a new line
      Tests  2 failed | 16 passed (18)
$ pnpm vitest run test/server/agentRoutes.test.ts
   × a torn proposals.jsonl tail is skipped, and a proposal appended after it replays on restart
AssertionError: expected "warn" to be called with arguments: [ Array(1) ]
      Tests  1 failed | 11 passed (12)
$ pnpm vitest run test/server/agent/proposals.test.ts test/server/agent/tools.test.ts
   × a proposal cannot be decided or revised again while a revise is in flight
   × beginRevise requires a pending proposal and queues behind a decision in flight
   × revise holds off decisions from before it reads the board for id checks
      Tests  3 failed | 24 passed (27)
```

### GREEN

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run
Checked 85 files in 46ms. No fixes applied.
 Test Files  29 passed (29)
      Tests  173 passed (173)
```

No stderr output in the test run (the torn-tail warnings are spied and silenced in the tests that trigger them).

### Concerns
- The truncate-instead-of-newline deviation for a torn (non-JSON) tail described above; the leading `\n` is still written for an unterminated line that is valid JSON.
