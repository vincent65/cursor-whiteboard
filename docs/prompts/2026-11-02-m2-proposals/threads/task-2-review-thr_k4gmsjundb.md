### Spec Compliance
- Spec compliant. `ProposalStore` in `src/server/agent/proposals.ts:13-102` has exactly the interface the brief asks for:
  - `load`, `pending`, `get`, `newId`, `proposed`, `revised`, `decided` and `takeNotes` all exist.
  - The constructor takes `Pick<FileStore, "appendProposal" | "readProposals">`.
  - `NotFoundError` comes from `../files.js`.
  - Relative imports use `.js`.
- Replay works as the brief says. In `proposals.ts:93-101`, `proposed` and `revised` set the record, and the decision events delete it.
  - I checked `src/shared/proposals.ts:43-45`: `ProposalLogEntry` has exactly two variants. So the `"proposal" in entry` / else narrowing in `apply` is complete.
- `pending()` returns the oldest first because it uses Map insertion order. A `revised` keeps the proposal's original slot (`proposals.ts:30-32`).
- `newId` is `p_` plus `randomBytes(4).toString("hex")`. It loops until it finds an id not in `seen` and then adds the new id to `seen` (`proposals.ts:38-44`).
- The error message is exactly `proposal <id> is not pending` (`proposals.ts:83`).
- The note format matches the brief: `[Proposal p_1 "Login flow" was accepted.]`, or `[Proposal p_2 was rejected.]` when the title is null (`proposals.ts:63-64`).
- All four tests the brief lists exist and assert what the brief says (`test/server/agent/proposals.test.ts:40, 55, 88, 107`). There are two extra tests: the null-title note (`:81`) and concurrent decisions (`:126`).
- Extra beyond the brief: the `serial` promise queue (`proposals.ts:18-19, 75-79`).
  - It is justified. Without it, a double-clicked Accept would log `accepted` twice.
  - It is small, and the race test at `test:126-137` covers it.
  - I accept it and am not counting it as scope creep.
- Only the two files the brief lists were changed. The commit message is conventional and has no co-author trailer.
- Cannot verify from the diff: that `pnpm check` is clean (146 tests, Biome clean). This relies on the report. The test file uses `test`, `expect` and `vi` as globals, which only works if Vitest globals are enabled. The reported passing run implies they are.

### Strengths
- `log()` (`proposals.ts:86-91`) appends to disk before it changes memory. A failed append therefore leaves memory consistent with the log, and the replay path and the live path share the same `apply`.
- `serial()` uses `run.catch(() => {})` so a rejected mutation does not stop the queue, and the original rejection still reaches the caller.
- The `newId` test mocks `node:crypto` with queued bytes and falls back to the real function. It exercises collisions against both a decided id and a still-pending id, which is better than looping on real randomness.
- The not-pending test also checks an already-decided id and asserts that nothing was appended (`test:104`).

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- `test/server/agent/proposals.test.ts:107-124`: no test covers the `this.seen.add(id)` inside `newId` (`proposals.ts:42`). That line is what stops two `newId()` calls made before a `proposed()` from colliding, and the report claims it. Queuing the same bytes twice, as in `newId() !== newId()`, would pin it down.
- `test/server/agent/proposals.test.ts:10`: the module-level `queued` array is never reset between tests. If the `newId` test fails before draining it, the leftover bytes can leak into later tests. Adding `afterEach(() => { queued.length = 0; })` would make the tests independent.
- `proposals.ts:52-56`: `revised` does not check that `p.board` matches the pending record's board, so a revision could move a proposal to another board. The brief does not require this check. Note it for the route layer (later task) that validates revise input.
- `proposals.ts:26-28`: `load()` does not go through `serial`. It is harmless today because replay is idempotent and runs at startup. It is still worth a line in the class comment saying "call `load()` once, before any mutation."

### Assessment
Task quality: Approved
Reasoning: The store matches the brief's interface, replay semantics, id format, error text and note format exactly, and the tests check real behaviour against an in-memory log. The one addition beyond the brief, the serialization queue, is small, tested, and fixes a real double-accept race.
