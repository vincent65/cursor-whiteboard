# Task 6 report: PlanSession on the Agent SDK

Status: DONE_WITH_CONCERNS
Commit: `593c44a feat(agent): plan session with streaming input, status, and resume`

## What I implemented

`src/server/agent/session.ts` exports `SessionDeps` and `PlanSession` with exactly the brief's shape.

- **Input stream.** A private `InputQueue` class is a promise-based queue. `push` adds an `SDKUserMessage` and wakes the waiting consumer. `end` stops the generator. Each query run has its own queue. The pushed message is `{ type: "user", message: { role: "user", content: text }, parent_tool_use_id: null }`.
- **Query lifecycle.** The first `send` (or the first `send` after an error) calls `deps.query` once with `{ ...deps.options, cwd, includePartialMessages: true, resume? }`. `resume` is set whenever a session id is known (from the constructor's `resumeId` or from an init message). Before a new run starts, the old run's input is ended and `query.close()` is called on it.
- **Consumer loop.** Every message goes through a per-run `SdkEventMapper`. Its events go to `onEvent` and the transcript. Messages with `parent_tool_use_id` set are passed through unchanged. Each time the session id changes, the init message calls `onSessionId`. If the loop belongs to a run that has since been replaced, it stops without emitting anything.
- **Status.**
  - The first send sets `starting`.
  - The init message moves `starting` to `working`. A turn is always in flight at that point because the query only starts on a send.
  - A success `result` sets `idle`.
  - An error `result` sets `error` with `errors.join("\n")`.
  - A thrown loop emits an `error` event, sets `error` with the error message, and drops the run.
  - The next `send` after either kind of error starts a fresh query with `resume`.
  - A `send` while `idle` with a live run sets `working`.
  - A `stream_event` or `assistant` message that arrives while `idle` sets `working`. This covers queued turns.
  - `close` sets `stopped`.
  - `onStatus` fires only when the status or its message changes.
- **Queueing.** `send` always emits its `user` event right away and pushes onto the run's queue, so messages sent during a turn keep their order.
- **Transcript.** A `Map` keyed by event id, in arrival order, capped at 500 by evicting the oldest entry. Partial and final `assistant_text` events share an id, so only the latest version is kept. This keeps a streamed reply from filling the cap.
- **restore().**
  - Calls `getSessionMessages(resumeId, { dir: cwd })`.
  - Saved user prompts (string content, or content made only of text blocks) become `user` events with `id = uuid`. Every other saved message goes through one fresh `SdkEventMapper`.
  - All restored events go into the transcript only, without calling `onEvent`. Status ends `idle` and no query starts.
  - If the call throws or returns no messages, it emits the error event `"previous session could not be loaded; starting fresh"` and clears the session id, so the next query starts without `resume`.
- **interrupt()** calls `query.interrupt()` on the live run. It does nothing when there is no run.
- **close()** ends the input stream, calls `query.close()`, and sets `stopped`.

## TDD evidence

RED, with the test written first:

```
$ pnpm vitest run test/server/agent/session.test.ts
 FAIL  test/server/agent/session.test.ts [ test/server/agent/session.test.ts ]
Error: Cannot find module '../../../src/server/agent/session.js' imported from .../test/server/agent/session.test.ts
 Test Files  1 failed (1)
```

The first run after implementing had 2 failures, and both were mistakes in the tests.
The queue test expected the second `user` event before "echo first", but the scripted turn streams its text before the gate.
The error-result test keyed its script on the per-run turn index, so the new query's first turn failed again.
I fixed both tests, then made the queue assertion stricter: it now checks the order `first, echo first, second, r0, echo second, r1`, which proves the second turn runs after the first result.

GREEN:

```
$ pnpm vitest run test/server/agent/session.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ pnpm check
Checked 63 files in 27ms. No fixes applied.
 Test Files  19 passed (19)
      Tests  90 passed (90)
```

`pnpm check` produced no warnings, errors, or stderr.
The only issue it raised before that was biome formatting in my two new files, which `biome check --write` fixed.

Tests cover the 5 named in the brief, plus "an error result sets status error and the next send starts a fresh query with resume" and "the transcript keeps the last 500 events".

## Fake query and SDK message order (for Task 12 to confirm)

The fake `query` reads the prompt iterable in the background, the way the real SDK's `streamInput` does: it pulls each message as soon as it is available.
It then yields the scripted messages for each received user message, in order.
`interrupt` and `close` are `vi.fn()`s.

**Assumed SDK order with `includePartialMessages: true`, which Task 12 must confirm against the real SDK:**
`message_start`, `content_block_start`, the `content_block_delta`s, then **one `assistant` message holding only that finished block**, then `content_block_stop`, `message_stop`, and `result`.
The mapper's id scheme for final text depends on this order.

## Manual verification

The brief does not name any.
I did not run the real SDK; that is Task 12's acceptance.

## Files changed

- `src/server/agent/session.ts` (new)
- `test/server/agent/session.test.ts` (new)

## Self-review findings and concerns

1. **Status between queued turns (needs Task 12 to check).** The SDK writes each user message to the CLI as soon as it is sent. I could not verify whether the CLI runs queued messages as separate turns (one `result` each) or batches them. So the status does not count sends against results, because that would stay `working` forever if the CLI batches them. Instead, `result` sets `idle` and the next `stream_event` or `assistant` sets `working`. The cost: a queued second turn can read `idle` for a moment between the first result and its first streamed message. A `ponytail:` comment in the code marks this.
2. **Interrupt probably shows as an error.** If the real SDK ends an interrupted turn with a non-success `result` (likely `error_during_execution`), the status becomes `error`, an error event appears, and the next send restarts the query with `resume`. That works, but it is noisy for a deliberate interrupt. Task 12 should check the real result subtype. If it is an error, the fix is to treat a non-success result that follows `interrupt()` as `idle`.
3. **Restored text ids can collide.** Claude Code saves each content block of an API message as its own transcript entry. With no stream events, the mapper gives each restored text block the id `msg.id:0`. One API message with two text blocks therefore collapses to one transcript entry on restore. This is rare in practice (a `tool_use` ends a message, and `thinking` blocks are skipped). Fixing it needs a mapper change in `events.ts`, which is outside this task's file list.
4. **Restored user prompts are handled in the session, not the mapper.** The mapper drops user messages with string content, as it should for live streaming. So `restore` turns saved prompts into `user` events itself. Otherwise the restored transcript would have no user side.
5. **Restored timestamps are the restore time.** `SessionMessage` has no timestamp field.
6. **An empty `getSessionMessages` result counts as a failed load.** The SDK returns `[]` for a session it cannot find, and resuming that session would fail anyway.
7. **`send` after `close`** starts a new query. Nothing in the brief forbids this. Task 8 should not call `send` on a closed session.
8. **`close` does not wait for the consumer loop to finish.** The loop stops emitting as soon as its run is replaced or dropped, so nothing leaks after `close`.
9. **Initial status is `idle`.** `AgentStatus` has no "not started" value. `restore` therefore does not call `onStatus` when it ends `idle`; Task 8 should read `session.status` after `restore()`.

## Fix round 1

Commit: `fix(agent): close the query on loop errors and recover when it ends on its own`

### What changed

`#consume` in `src/server/agent/session.ts` now ends every run the same way, whether the loop threw or finished without throwing.
The catch only records the error message.
After the loop, if the run is still the live one, the method does three things:
- It calls `#stopRun()`, which ends the input generator, calls `query.close()`, and clears `#run`.
- It emits an `error` event.
- It sets status `error` with that message.

When the loop finishes without throwing, the message is `Claude session ended`.
In both cases the next `send` starts a fresh query with `resume`.
- **Important #1:** a throw from `mapper.map`, `onEvent`, `onStatus`, or `onSessionId` no longer leaves the old CLI process and its input generator running.
- **Important #2:** a query that ends without an error no longer leaves the session stuck in `working`.

### Covering tests (`test/server/agent/session.test.ts`)

- "a throwing event handler closes the run and the next send starts exactly one new query".
  `onEvent` throws once, on the first `assistant_text`.
  The test asserts status `error` with `broadcast failed`, that `runs[0].close` was called, and that the first run's input ended.
  It then asserts the next `send` makes `query` called exactly twice in total, with `resume: "sess-1"`.
- "a query that ends on its own sets error and the next send starts a new query with resume".
  The fake query takes a new `endAfter` option and returns after one turn.
  The test asserts status `error` with `Claude session ended`, a matching `error` event, and `runs[0].close` called.
  It then asserts the next `send` starts a second query with `resume: "sess-1"` that answers its turn.

The test helpers `setup` and `fakeQuery` gained two options: an `onEvent` hook and `endAfter`.

### RED (new tests run against the previous `session.ts`, kept aside with git stash)

```
$ pnpm vitest run test/server/agent/session.test.ts
   × a throwing event handler closes the run and the next send starts exactly one new query
   × a query that ends on its own sets error and the next send starts a new query with resume
      Tests  2 failed | 7 passed (9)
```

### GREEN

```
$ pnpm vitest run test/server/agent/session.test.ts
      Tests  9 passed (9)

$ pnpm check
 Test Files  19 passed (19)
      Tests  92 passed (92)
```

`pnpm check` produced no type, lint, or format errors, no warnings, and no stderr.
