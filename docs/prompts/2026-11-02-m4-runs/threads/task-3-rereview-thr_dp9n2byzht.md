### Finding Verdicts

1. **ADDRESSED.** `src/server/runs/manager.ts:126-132`: `message()` now calls `#freshPrompt(live)`. When the session is fresh, it sends `${prompt}\n\n${text}` and passes `text` as `shown`, so the card shows only what the user typed. `#fresh` (around `manager.ts:194`) means "no session id and no turn in flight (`starting`/`working`)". It goes through `#promptInput` (around `manager.ts:200`), the same path `resume()` uses (`manager.ts:147-150`).
   - The re-check after the await holds up because `session.send` sets `starting` synchronously through `#start()` (`src/server/agent/session.ts:241`).
   - Both ruled cases are tested in `message with no usable session id sends the run prompt, then the text`: `sessionId: ""`, and a saved session that restore dropped.
   - Two more cases are covered: a later message once the session has an id is just the text, and so is a message during a launch's first turn (`a message during a launch's first turn...`).
2. **ADDRESSED.** `src/server/agent/hooks.ts:21-35`: `denyBoardWrites(roots: string | string[], reason)` resolves the path against `input.cwd` and denies if any root protects it. `manager.ts` passes `[this.#deps.root, record.worktree]`.
   - `test/server/agent/hooks.test.ts` covers all three ruled cases: relative `../../boards/x.excalidraw.json` from the worktree is denied, the absolute root path is denied, and worktree `src/x.ts` is allowed.
   - The manager launch test now hits the root's absolute board path through the run's hook.
3. **ADDRESSED.**
   - `src/shared/panel.ts`: the `error` event has optional `costUsd`.
   - `src/server/agent/events.ts:163-172`: the mapper sets it from `total_cost_usd`.
   - `manager.ts` `onEvent`: the cost is added for both `result` and `error` events when it is a number. A restore error event has no cost and is safely skipped.
   - The manager error test asserts `costUsd: 0.02` after the failure and `0.03` after the next process.
4. **ADDRESSED.**
   - `test/server/agent/fakeSdk.ts`: `textTurn` takes a running-total parameter.
   - New test `a process's running total is the run's cost, not the sum of its results` runs two turns in one query (`0.01` then `0.03`) and checks the record ends at `0.03`.
5. **ADDRESSED.** `manager.ts:23` and both call sites now use `INTERRUPTED_REASON`.
6. **ADDRESSED.** `manager.ts` `onEvent` begins with `if (this.#closing) return;`. Test `events after close are not broadcast` checks it.

### New Breakage in the Fix Diff
None.
- `resume()` now also treats a session with no id that is `starting`/`working` as not fresh. That cannot happen for a record already checked as interrupted, so behaviour there is unchanged.
- The cost base resets on `starting` and already includes an error's cost, so a restart after an error result does not count spend twice.

### Out-of-Scope Observations
- The fix round also loosened the round-0 concurrent-resume test to accept either order. The report attributes this to flakiness it found itself and says the re-check mutation is still caught. That is a reasonable fix.
- The report names the covering tests and shows the evidence: RED output, a mutation table, `pnpm check` with 317 passed, and 8 repeated runs of 127 tests. That evidence matches the diff.

### Verdict
The fix round is complete: all six findings are addressed and the fix diff introduces no new Critical or Important breakage.
