# Task 4 findings, round 1 (from review thr_th229emvwy, with controller rulings)

## Important
1. After a torn `proposals.jsonl` tail (a crash mid-append leaves a last line with no newline), the next `appendProposal` writes onto that tail, so the new proposal can never be replayed; the test only checked in-memory pending state. Ruling, both halves:
   - `FileStore.appendProposal` writes a leading `\n` first when the file exists and its last byte is not `\n` (one `stat` plus a one-byte read, or read the tail; keep it simple).
   - `FileStore.readProposals` skips a torn final line (the last line, only when the file does not end with `\n`, and only when it is not valid JSON) with `console.warn("proposals.jsonl: ignoring a torn last line")`; every other bad line still throws as Task 1 specified.
   - Extend the torn-log test: after the append, build a second `createAgent` on the same store and assert the appended proposal is pending there; also assert the log now has exactly two well-formed lines.

## Minor (fix in this round)
2. The revise/decide guard leaves a window: `beginRevise` runs after `checkIds` (a disk read) and does not check pending. Ruling: `beginRevise` runs through `serial()` with `pendingOrThrow`, and the `revise` tool calls it before `checkIds` (and `endRevise` in a `finally`).
3. `ProposalBusyError` maps to 409 inside the route while `NotFoundError` maps through `statusFor`. Ruling: add the 409 mapping to `statusFor` in `src/server/app.ts` and drop the route's local try/catch.
4. Send gating assumes exactly one `result` per message handed to the SDK. Ruling: add a comment at `#hand` naming that assumption and what breaks if it fails (held sends never released).

## Minor (deferred, do not address)
- `close()` covers a rejection, not a hang (PlanSession.close awaits nothing today).
- Decision notes are lost if `session.send` throws synchronously.

## Controller correction after the fix (for the re-reviewer)
Finding 1's "write a leading newline" was wrong as stated: it would leave the torn line in the middle of the file, where reads must still throw. The implementer's variant is the accepted ruling: `appendProposal` truncates a torn last line that is not valid JSON before appending (it was never loaded, so nothing is lost), and writes a leading newline only when the last line is valid JSON without its newline; `readProposals` skips only a torn final line with a warning. Judge finding 1 against this.
