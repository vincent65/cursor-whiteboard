### Task 3: The propose and revise tools

**Files:**
- Modify: `src/shared/messages.ts`, `src/server/agent/tools.ts`, `src/server/agent/events.ts`
- Test: `test/server/agent/tools.test.ts`, `test/server/agent/events.test.ts`

**Interfaces:**
- Consumes: `ProposalStore` (Task 2); `Propose`, `Revise`, `Proposal`, `referencedIds` (Task 1); `WsHub.request`, `WsHub.activeBoard`, `FileStore.readBoard`.
- Produces in `src/shared/messages.ts`, added to `ServerMessage`:

```ts
| { type: "request"; id: string; kind: "proposal.apply"; proposal: Proposal; replace: boolean }
```

  The browser answers with payload `{ elementIds: string[] }` (every element the proposal touched) or an error string.

- Produces in `src/server/agent/tools.ts`: `createBoardTools(deps: { store: FileStore; hub: Pick<WsHub, "request" | "activeBoard">; proposals: ProposalStore })` now registers four tools. `propose` takes `Propose.shape`, `revise` takes `Revise.shape`. Both:
  1. Require `hub.activeBoard`; otherwise throw `Error("open a board in the browser first")`.
  2. Read the stored board and throw `Error("unknown element id <id>")` for the first id from `referencedIds(ops)` with no non-deleted element.
  3. Build the `Proposal` (`propose` mints `proposals.newId()` and uses `title ?? null`; `revise` requires `proposals.get(proposalId)` and keeps its title, else throws `NotFoundError("proposal <id> is not pending")`).
  4. `await hub.request({ kind: "proposal.apply", proposal, replace: <false | true> }, { timeoutMs: 30_000 })`; a rejection propagates as the tool error with the browser's message.
  5. Only then `proposals.proposed(p)` or `proposals.revised(p)`.
  6. Return `{ content: [{ type: "text", text: JSON.stringify({ proposalId: p.id }) }] }`.

  `get_board` and `get_selection` drop elements whose `customData.ghost === "add"` before building the graph, and when `proposals.pending()` is not empty append `\n\nPending proposals: p_1 (2 ops), p_2 (1 op)` to their text.

- Produces in `src/server/agent/events.ts`: `summarizeTool` returns `proposing 3 changes` / `proposing 1 change` for `mcp__blueprint__propose` and `revising p_1a2b3c4d` for `mcp__blueprint__revise`.

- [ ] **Step 1: Write the failing tests**

```ts
test("propose validates ids against the stored board and logs nothing on failure", async () => {
  // board has element "a"; ops update "zzz" → rejects with "unknown element id zzz"; hub.request not called; log empty
});
test("propose round-trips to the browser, logs, and returns the proposal id", async () => {
  // fake hub.request records the body and resolves { elementIds: ["g1"] }
  // result text parses to { proposalId: /^p_[0-9a-f]{8}$/ }; body.kind === "proposal.apply", body.replace === false, body.proposal.ops === ops
  // proposals.pending() has one record with board "main" and title "Cache"
});
test("a browser failure becomes the tool error and leaves nothing pending", async () => {
  // hub.request rejects Error("Parse error on line 2") → the tool rejects with that message; pending is empty; log is empty
});
test("revise requires a pending proposal and replaces in place", async () => {
  // unknown id → rejects "proposal p_9 is not pending"
  // pending p_1 → request body.replace === true, body.proposal.id === "p_1", title kept; log gains "revised"
});
test("propose without an open board fails fast", async () => {
  // hub.activeBoard null → rejects "open a board in the browser first"
});
test("board reads hide add ghosts and list pending proposals", async () => {
  // stored board: "a" (human) and "g" with customData { ghost: "add", proposalId: "p_1" }; pending p_1 with 2 ops
  // get_board text does not mention g's label and ends with "Pending proposals: p_1 (2 ops)"
});
// events.test.ts
test("summarizeTool names proposals", () => {
  expect(summarizeTool("mcp__blueprint__propose", { ops: [1, 2, 3] })).toBe("proposing 3 changes");
  expect(summarizeTool("mcp__blueprint__propose", { ops: [1] })).toBe("proposing 1 change");
  expect(summarizeTool("mcp__blueprint__revise", { proposalId: "p_1a2b3c4d", ops: [] })).toBe("revising p_1a2b3c4d");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/tools.test.ts test/server/agent/events.test.ts`
Expected: FAIL, `propose` not registered and summaries fall through to the raw name.

- [ ] **Step 3: Implement the tools and summaries**

Reuse the existing test helpers in `tools.test.ts` for the fake store and hub; give the fake `ProposalStore` a real instance backed by an in-memory log.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/messages.ts src/server/agent/tools.ts src/server/agent/events.ts test/server/agent/tools.test.ts test/server/agent/events.test.ts
git commit -m "feat(agent): propose and revise tools with a browser round trip"
```

---

