### Spec Compliance
- Spec compliant, with two documented deviations:
  - **Queued-turn status:** between the first turn's `result` and the queued turn's first streamed message, status reads `idle` (`src/server/agent/session.ts:200-208`). The brief says status stays `working` while a user message is being processed. This is Minor; Task 12 should confirm it against the real CLI.
  - **Transcript dedup:** the transcript removes duplicates by event id (`session.ts:79-80, 223-229`), so a partial `assistant_text` is replaced by its final version instead of using one of the 500 slots. I count this as a sensible reading of "last 500 events", not as extra scope.
- **Interfaces:** `SessionDeps` and `PlanSession` match the brief's Interfaces block exactly: names, parameter shapes, `Partial<Options>`, getters, and return types (`session.ts:18-26, 73-170`).
- **Query call:**
  - The SDK user message has the mandated shape (`session.ts:138-142`).
  - `includePartialMessages: true` is set.
  - `cwd` is spread after `deps.options`, so the options cannot override it (`session.ts:161-166`).
  - `resume` is set only when a session id is known.
  - `settingSources` is left untouched.
  - Event ids come from `randomUUID` and timestamps are ISO strings.
- **Tests:** all 5 tests the brief lists exist and assert what it says.
  - Test 1 checks the event kinds user, partial, final, result and the status sequence starting→working→idle (`test/server/agent/session.test.ts:136-180`).
  - Tests 2-5 are at `:182-232`, `:234-262`, `:300-372` and `:374-394`.
  - There are 2 extra tests, for the error result and the 500-event cap. Both are in scope.
- **Type check:** `pnpm check` runs `tsc` for both projects (`package.json:15`), so the SDK types the code relies on are compiler-verified. I also checked them in the SDK's `sdk.d.ts`:
  - `Query.close()` exists.
  - `interrupt()` returns `Promise<...>`.
  - `getSessionMessages(id, options)` returns `SessionMessage[]`.
  - The error result has `errors: string[]`.
- **Cannot verify from the diff:**
  - The SDK message order the mapper's id scheme assumes (implementer's concern 3).
  - Whether the CLI batches queued messages (concern 1).
  - The `result` subtype after an interrupt (concern 2).
  - All three depend on the real SDK and are deferred to Task 12.

### Strengths
- Each run gets its own `InputQueue` and its own mapper. The `this.#run !== run` guards (`session.ts:186, 211`) stop a replaced run from emitting stale events.
- `#setStatus` only fires `onStatus` when the status or message actually changes (`session.ts:232-237`). The test asserts the exact transitions.
- The fake `query` reads the prompt iterable in the background, as the real SDK does. That makes the queue-order test meaningful: it asserts `first, echo first, second, r0, echo second, r1`, not just counts.
- The implementer's report clearly lists the SDK assumptions that remain unverified.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The consume-loop error path orphans the live query** (`session.ts:210-215`).
   - The `catch` sets `this.#run = undefined` without calling `run.input.end()` or `run.query.close()`.
   - The catch handles more than SDK failures. It also catches a throw from `mapper.map(msg)` (an unexpected message shape) and from `deps.onEvent`, `onStatus` or `onSessionId` (for example, a Task 8 WebSocket broadcast failing).
   - In those cases the CLI subprocess is still alive. Its input generator also stays pending forever.
   - Because `#run` is already cleared, the next `send` → `#start` → `#stopRun` never closes the old process.
   - Failure scenario: `onEvent` throws once. The session shows `error`, and the user sends again. Two CLI processes are now running, and one is never reaped.
   - Fix: call `this.#stopRun()` in the catch instead of `this.#run = undefined`. Add a test where `onEvent` throws and assert `runs[0].close` was called.
2. **A query that ends without throwing wedges the session** (`session.ts:182-209`).
   - If the `for await` loop finishes normally, nothing resets `#run` or the status. That happens when the CLI exits cleanly or the SDK iterator returns without `close()` being called.
   - `#run` still points at the dead run.
   - The next `send` takes the `idle → working` branch (`session.ts:136`) and pushes into an input queue nobody reads.
   - No `result` ever comes, so the status stays `working` indefinitely, and no error is shown.
   - Fix: after the loop, `if (this.#run === run)` stop the run and set `error` (for example "Claude session ended"), so the next `send` restarts with `resume`. Add a test whose fake query returns after one turn.

#### Minor (Nice to Have)
1. **A failed restore leaves a partial transcript** (`session.ts:103-126`). Restored events go straight into `#transcript` as they are mapped. If entry N throws (for example, `savedPrompt` hits a null block or the mapper rejects a `SessionMessage` cast through `unknown`), entries 0..N-1 stay in the transcript. They are followed by "starting fresh", and `sessionId` is cleared. The user then sees history that Claude no longer has. Fix: build the restored events into a local array and commit it only on success.
2. **An empty content array restores as a blank user event** (`session.ts:67-70`). `savedPrompt` turns `content: []` into an empty-text `user` event, because `[].some(...)` is false. Fix: treat an empty array as "not a prompt".
3. **An error result with no messages gives an empty status message** (`session.ts:199`). `msg.errors.join("\n")` produces `onStatus("error", "")` when `errors` is empty. Fix: fall back to the subtype.
4. **Queued messages are silently dropped on a thrown error** (`session.ts:210-215`). Messages queued behind a thrown turn already emitted their `user` events but are never processed or reported. The same happens when a `send` during `error` status restarts the run while a queued turn is still running on the old one.
5. **`send` after `close` starts a new query** (`session.ts:134-135`). Since `stopped` with no run takes the `!this.#run` branch, the session silently restarts. A guard that throws or does nothing would make the `stopped` state final. The implementer flagged this (concern 7).
6. **Queued-turn `idle` flicker, and no test for it.** The flicker is covered by the `ponytail:` comment at `session.ts:205-207`. No test asserts the status sequence across a queued turn, so whatever Task 12 decides has no regression guard.

### Assessment
Task quality: Needs fixes
Reasoning: The interface, the status rules and every required test match the brief, but the consumer loop handles termination incompletely. It orphans the CLI process when the loop throws, and it wedges in `working` when the query ends without throwing. Both need small fixes with a test each before Task 8 builds on this.
