**Finding 1 (Important, torn `proposals.jsonl` tail): ADDRESSED**, judged against the controller's corrected ruling.
- **Read side.** `src/server/files.ts` `readProposals` (around line 318) drops the last line only when it is non-empty and not valid JSON, and warns with the exact text `"proposals.jsonl: ignoring a torn last line"`.
  - Because the split is on `\n`, a non-empty last element can only exist when the file does not end with a newline. So "torn" really does mean unterminated.
  - Every other bad line still throws with its line number: a bad line in the middle, a bad last line that ends with `\n`, and a whole JSON line that fails the schema. `test/server/files.test.ts` "a bad line that is not a torn tail still fails the read" covers all three.
- **Append side.** `appendProposal` (around line 297) calls `unfinishedTail`. A tail that is not JSON is truncated at its byte offset `start`, and a valid JSON tail gets a leading `\n` instead.
  - The offset comes from `Buffer.lastIndexOf(0x0a)` on the raw bytes, so a multibyte UTF-8 character cut in half by the crash is still truncated correctly.
  - The append is safe from concurrent appends because every `appendProposal` goes through `ProposalStore.serial()`.
- **Tests.**
  - The unit tests check the exact file contents after the append: `${one}\n${two}\n` in both the torn case and the "valid line missing only its newline" case.
  - The agent-level test `test/server/agentRoutes.test.ts` "a torn proposals.jsonl tail is skipped, and a proposal appended after it replays on restart" covers the rest of the ruling. It appends through the real `propose` tool, builds a second `createAgent` on the same store, and asserts that `["p_1", added]` are pending. It also asserts the log has exactly 2 lines and both parse as JSON.
  - The earlier "corrupt log" behavior is kept as its own test, with a newline-terminated bad line.

**Finding 2 (Minor, revise/decide window): ADDRESSED**
- `src/server/agent/proposals.ts:62-69`: `beginRevise` now returns a promise and runs through `serial()`, calling `pendingOrThrow` and then `throwIfRevising`.
- `src/server/agent/tools.ts` (the revise handler) awaits `beginRevise(prev.id)` before `checkIds`. The `try/finally` that calls `endRevise` wraps `checkIds`, `apply`, `revised` and `return`.
- If `beginRevise` itself throws, the `finally` is never entered. That is correct: it does not clear a flag owned by a concurrent revise of the same id.
- **Tests.**
  - `test/server/agent/proposals.test.ts`, the new test "beginRevise requires a pending proposal and queues behind a decision in flight": a decision started first settles first, and the revise then gets a 404-type `NotFoundError`.
  - `test/server/agent/tools.test.ts`, the new test "revise holds off decisions from before it reads the board for id checks": it holds `readBoard` open and checks that a decision is refused in that window. It also checks that a failed id check releases the proposal.

**Finding 3 (Minor, 409 mapping): ADDRESSED**
- `src/server/app.ts:19-20`: `statusFor` now maps `ProposalBusyError` to 409 alongside `ExistsError`.
- `src/server/agentRoutes.ts` no longer has its own `try/catch` or the `ProposalBusyError` import.
- `test/server/agentRoutes.test.ts:147` still asserts 409 and the error body. That route test goes through `createApp`, so the response now comes from `app.onError` and `statusFor`.

**Finding 4 (Minor, send-gating assumption): ADDRESSED**
- `src/server/agent/session.ts`: the comment above `#hand` names the assumption (exactly one `result` per message handed to the SDK). It also names what breaks if the assumption fails: `busy` never clears and every held send waits until a Stop or the run ends.

**Tests:** the report names the covering tests and shows RED output (6 failing before the fix) and GREEN output (`pnpm check`: tsc, biome and vitest, 29 files and 173 tests passing). Those claims match the test code in the diff. I did not re-run anything.

### New Breakage in the Fix Diff
None.

### Out-of-Scope Observations
- **Nit:** in `src/server/files.ts`, `isJson` and `unfinishedTail` are inserted between `export class InvalidNameError` and `export class NotFoundError`, which splits the error-class block. Moving them below the error classes would read better.
- **Edge case, no action needed:** an unterminated last line that is valid JSON but fails the schema still makes reads throw. `appendProposal` then adds a `\n` after it, which leaves the bad line in the middle of the file. Startup reports the error either way, so this matches the existing "corrupt line" path.

### Verdict
All 4 findings are addressed and the fix introduced no new Critical or Important problems. This fix round passes.
