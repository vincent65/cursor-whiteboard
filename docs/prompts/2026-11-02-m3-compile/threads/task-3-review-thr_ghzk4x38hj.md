### Spec Compliance
- Spec compliant. I compared `COMPILE_INSTRUCTION` (`src/server/agent/prompt.ts:232-236`) with the brief character by character, and it matches.
- `Agent.compile()` (`src/server/agent/index.ts:192-206`) sends through the shared `send` path, so notes, the `loadErrors` reset and `riding` all apply. The shown text is `Compile the plan into spec.md` (`:198`), and it returns the user event id.
- A compile that is already pending returns the same id without sending again (`??=` at `:194`). The pending compile is cleared by the next `result` event (`:96`).
- `POST /compile` returns 202 `{ id }` (`src/server/agentRoutes.ts:263`).
- All three brief tests exist and assert what the brief says:
  - `test/server/agent/prompt.test.ts:304`: the section order as one exact substring, both citation forms, and 5 lines.
  - `test/server/agentRoutes.test.ts:372`: the route returns 202 with the id.
  - `test/server/agentRoutes.test.ts:403`: two concurrent compiles plus one sequential compile give the same id and one message. After a result, compile sends again with a new id.
- Beyond the brief, the pending compile is also cleared on `error`/`stopped` status (`index.ts:109`), and there is an extra test (`agentRoutes.test.ts:438`). Both are justified: without them, a run that ends with no result would leave Compile returning a stale id forever. I don't count either as scope creep.
- Cannot verify from the diff: the reported `pnpm check` and `pnpm vitest run test/server` results. I did not re-run them. The report gives clean RED/GREEN output with no warnings.

### Strengths
- Storing the pending compile as a promise instead of an id closes a real race. `send` awaits `header()` before `session.send`, so with an id-only guard a double-click would send twice. The `Promise.all` in the test covers this.
- Moving `send` into a local function with a `shown` parameter reuses the whole send path, including note requeue on throw. The public `Agent.send` signature is unchanged (`index.ts:191`).
- I checked a specific doubt: is the "after a result" step in the test really exercising the result path, or the `stopped` status path? In `src/server/agent/session.ts:191-206,286-316`, the run is initialized, so `interrupt()` calls `query.interrupt()`. `stallingSdk` (`agentRoutes.test.ts:559-593`) then emits a `success` result, which goes through the mapper as `kind: "result"`. So the test does exercise the result-clearing path as claimed.
- The known shortcut (any result clears the pending compile) has a `ponytail:` comment that states its limit (`index.ts:94-95`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **A failed send can clear a newer compile (`src/server/agent/index.ts:199-201`).** The `.catch` sets `compiling = undefined` without checking that `compiling` is still this same promise. The problem sequence is:
  1. Compile A is waiting on `header()`.
  2. A result from an earlier turn arrives and clears `compiling` (`:96`).
  3. Compile B starts.
  4. A's `session.send` throws, and the catch clears B's promise.
  5. A third click then sends a duplicate compile.

  The window is very narrow and the outcome is harmless (spec.md gets rewritten). The fix is one line: bind the promise and only clear when `compiling === p`.
- **Test name doesn't match its file (`test/server/agentRoutes.test.ts:403, 438`).** Both agent-behaviour tests drive `createAgent` directly, not HTTP, yet they live in the routes test file. The brief allows this, and the file already holds other agent wiring tests such as `:604`. Noted only for consistency with the file's name.

### Assessment
Task quality: Approved
Reasoning: Every brief requirement is implemented and tested, and the instruction text matches the brief exactly. The extra clearing on `error`/`stopped` fixes a real stuck-state bug, and the only finding is a narrow, harmless race on a failed send.
