### Spec Compliance
- Spec compliant. Every item in the brief is in the diff:
  - **Prompt:** the three prompt lines are verbatim and sit after "Read boards only" (`src/server/agent/prompt.ts:7-9`). `composeUserMessage` drops empty parts and joins with a blank line (`prompt.ts:41-47`).
  - **Hook:** the denial reason is the new text (`src/server/agent/hooks.ts:7`).
  - **Agent:** `createAgent` builds one store, loads it and passes it to the tools (`src/server/agent/index.ts:67-72,111`). `send`, `pendingProposals` and `decideProposal` are added with the refine note verbatim (`index.ts:171-186`).
  - **Routes:** `SendBody.proposalId`, `GET /proposals`, and `POST /proposals/:id/decision` returning 204, 400 or 404 are all present (`src/server/agentRoutes.ts:10,48-62`).
  - **Session:** `send(text, shown)` and per-turn send gating are in (`src/server/agent/session.ts:172-185,256-268`). `interrupt()` drops the held sends (`session.ts:195`). The resume failure message now carries the cause (`session.ts:17-18,311`).
  - **Server close:** `close()` uses try/finally (`src/server/index.ts:86-94`).
- The three Task 3 rulings and the Task 1 torn-log ruling are implemented, and `task-4-dispatch.md:17-23` sanctions them. That covers the proposals.ts and tools.ts changes, which are outside the brief's own file list.
  - **Busy guard:** `beginRevise` and `endRevise`, with a 409 on a busy decision (`proposals.ts:62-70,76`, `agentRoutes.ts:56-60`).
  - **Ghost ids:** add ghosts count as unknown ids (`tools.ts:86-95`).
  - **Pending line:** it lists only the board being read (`tools.ts:72-79`).
  - **Torn log:** a failed load reports an error status and the server stays up (`index.ts:68-72`).
- Every test the brief lists exists and asserts what the brief says:
  - `prompt.test.ts:66-77`
  - `hooks.test.ts:31`
  - `agentRoutes.test.ts:103-163`, which also covers 409 and a bad `proposalId`
  - `agentRoutes.test.ts:484-535`, the wiring test, which seeds `proposals.jsonl` as Step 3 asks
- The existing queued-send and Stop tests were updated rather than deleted (`session.test.ts:233-291,782-829`).
- Cannot verify from the diff:
  - Whether the commit message has no co-author trailer. The diff shows only the subject line.
  - The `stopped` computation in `#consume`, which the hunk cuts off at `session.ts:~270`. I judged the interrupt path from the visible lines only.

### Strengths
- **Send gating is minimal and correct.** `busy` and `held` live on the `Run`, and `#turnEnded` hands the next held send to the SDK on every result path (`session.ts:257-268,290,298`).
  - This removed the old idle→working ponytail workaround for real, and the queued-send test now pins the statuses to exactly `starting, working, idle` (`session.test.ts:291`).
- **The Stop test was proven to fail before the fix.** The report notes that as first rewritten it passed against the old code. The implementer added the 10 ms wait and the `runs[0].read` assertion until it failed on the old code (`session.test.ts:808-810`).
- **`Agent.send` orders its checks carefully.** It awaits the selection header first, then checks the proposal is pending, then takes the notes, with no await in between (`index.ts:173-183`). The wiring test confirms that a refused refine keeps its notes for the next send (`agentRoutes.test.ts:522-532`).
- **`ProposalBusyError` is a typed subclass.** The dispatch asked for a bare `Error`. The subclass lets the route match by type instead of by message string.
- **The torn-log test runs the real path.** It calls the real MCP `propose` handler through a real `WsHub` with a fake browser tab (`agentRoutes.test.ts:537-596`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **After a torn log, the first new log line is silently lost, but the code comment and the test say appends still work.**
   - Where: the comment at `src/server/agent/index.ts:58-59` and the test at `test/server/agentRoutes.test.ts:537-596`.
   - What I checked: `FileStore.appendProposal` (`src/server/files.ts:260-262`) is a plain `appendFile` of `JSON + "\n"`. Nothing ensures the file already ends with a newline.
   - How it happens: a crash mid-append leaves a torn tail with no newline, which is the realistic way this file gets torn. The next `propose` then appends onto that tail, so line 2 becomes `{"event":"acc{"event":"proposed",...}`.
   - The result: that proposal can never be replayed. If the user follows the error message ("Fix or delete") and deletes the bad line, they delete the new proposal with it. If they leave the file alone, every restart again shows nothing pending.
   - The test only checks the in-memory `pendingProposals()`. It never re-reads the log, so it passes over the corruption it claims to rule out.
   - Fix: write a leading newline when the file does not end with one. Alternatively, have `readProposals` skip a torn final line with a warning, which is the usual way to read a JSONL log. Then extend the test to restart `createAgent` and check that the appended proposal comes back as pending.

#### Minor (Nice to Have)
1. **The revise/decide guard still leaves a small window.**
   - `revise` checks the proposal is pending (`tools.ts:~200`) and awaits `checkIds` (a disk read) before `beginRevise` (`tools.ts:213`). `beginRevise` itself does not check pending (`proposals.ts:62-65`).
   - A `decided()` that passed `throwIfRevising` and is mid-append, or one that finished in that gap, lets the browser redraw ghosts for an accepted or rejected proposal. `revised()` then fails with NotFoundError.
   - This matches the dispatch's wording ("bracket the browser round trip"), so it is not a spec miss.
   - Fix: run `beginRevise` through `serial()` with `pendingOrThrow`, and call it before `checkIds`.
2. **Busy and not-found errors map to status codes in different places.** `ProposalBusyError` maps to 409 inside the route (`agentRoutes.ts:56-60`), while `NotFoundError` maps to 404 through `app.onError`/`statusFor` (`src/server/app.ts:55-60`). Adding 409 to `statusFor` would remove the local try/catch.
3. **`close()` covers a rejection but not a hang.** The brief says "even if the session hangs or rejects". try/finally covers only the rejection, so a `close()` that never settles still blocks (`index.ts:87-94`). The report flags this itself. It is harmless today, because `PlanSession.close()` awaits nothing.
4. **Decision notes can be lost if `session.send` throws.** `Agent.send` takes the notes (`index.ts:177`) before calling `session.send`. If `#start()` throws synchronously (for example, `sdk.query` throws), the notes are dropped. Low risk.
5. **Send gating assumes exactly one `result` per message handed to the SDK** (`session.ts:256-268`). If the CLI ever finishes a turn without a result, `busy` stays true and every later send is held with no error shown. I cannot verify this against the SDK from the diff. A comment naming the assumption at `#hand` would help whoever debugs it later.

### Assessment
Task quality: Needs fixes
Reasoning: Everything the brief asks for is built and well tested, including the hard send-gating change. The torn-log path, though, claims appends still work when the first append after a torn tail is silently lost, and the test misses it because it never re-reads the log.
