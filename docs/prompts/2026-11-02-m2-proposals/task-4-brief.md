### Task 4: Prompt, guard copy, agent wiring, and proposal routes

**Files:**
- Modify: `src/server/agent/prompt.ts`, `src/server/agent/hooks.ts`, `src/server/agent/session.ts`, `src/server/agent/index.ts`, `src/server/agentRoutes.ts`, `src/server/index.ts`
- Test: `test/server/agent/prompt.test.ts`, `test/server/agent/hooks.test.ts`, `test/server/agent/session.test.ts`, `test/server/agentRoutes.test.ts`

**Interfaces:**
- Consumes: `ProposalStore` (Task 2), `createBoardTools` with `proposals` (Task 3), `Decision`, `Proposal` (Task 1).
- Produces in `src/server/agent/prompt.ts`:
  - `SYSTEM_PROMPT_APPEND` gains, after the "Read boards only" line, these lines verbatim:

```
- To add or change anything on the board, call propose with ops: add_diagram (Mermaid), add_note, update (label, strokeColor, backgroundColor), or delete. Use element ids from the selection header or get_board. Pass near ids to place additions beside them.
- Proposals appear as ghosts the user accepts or rejects. Never say a change is on the board until a message tells you it was accepted.
- To refine a proposal when asked, call revise with its proposalId and the complete new op list; revise replaces every ghost of that proposal.
```

  - `composeUserMessage(text: string, header: string, notes: string[] = []): string` joins the non-empty parts of `[...notes, header, text]` with a blank line.
- Produces in `src/server/agent/hooks.ts`: the denial reason becomes `Blueprint board files are read-only here. Propose changes with the propose tool instead.`
- Produces in `src/server/agent/index.ts`: `createAgent` builds `new ProposalStore(store)`, awaits `load()`, passes it to `createBoardTools`, and `Agent` gains:

```ts
send(text: string, selection?: { board: string; ids: string[] }, proposalId?: string): Promise<string>;
   // notes = proposals.takeNotes(); with proposalId: throws NotFoundError unless pending, then pushes
   // `[The user wants proposal ${id} refined. Call revise with proposalId ${id} and the complete new op list.]`
pendingProposals(): Proposal[];
decideProposal(id: string, decision: Decision): Promise<Proposal>;
```

- Produces in `src/server/agentRoutes.ts`: `SendBody` gains `proposalId: z.string().optional()`; `POST /send` returns 404 `{ error: "proposal <id> is not pending" }` when `agent.send` throws `NotFoundError`; `GET /proposals` returns `agent.pendingProposals()`; `POST /proposals/:id/decision` with body `{ decision: "accepted" | "rejected" }` returns 204, 400 on a bad body, 404 when not pending.
- Produces in `src/server/agent/session.ts`: `send(text: string, shown: string = text): string` emits the `user` event with `shown` (what the user typed) while `text` (notes, header, and typed text) goes to Claude; `createAgent` passes both. The panel then no longer needs to strip the selection header from user bubbles by regex (deferred from the milestone 1 review); Task 9, which owns `src/ui/panel/ClaudePanel.tsx`, removes that code and its test.
- Produces in `src/server/agent/session.ts` (carried from the milestone 1 final review):
  - sends are held by `PlanSession` itself and released to the SDK one per turn: a send while a turn runs stays in Blueprint's own queue until the previous `result` arrives, so `interrupt()` drops every pending send for real (the SDK otherwise writes queued sends to the CLI as soon as it initializes). The existing "queued send" and "Stop drops queued sends" tests are updated to this behaviour.
  - when a resumed run fails before its init message, the restore-failed message carries the cause: `The previous session could not be loaded (<error message>); starting fresh.`
- `src/server/index.ts`: `close()` wraps `agent.close()` in `try/finally` so clients are terminated and the server closes even if the session hangs or rejects (deferred from the milestone 1 review).

- [ ] **Step 1: Write the failing tests**

```ts
// prompt.test.ts
test("the prompt explains propose and revise", () => {
  expect(SYSTEM_PROMPT_APPEND).toMatch(/call propose with ops/);
  expect(SYSTEM_PROMPT_APPEND).toMatch(/call revise with its proposalId/);
});
test("composeUserMessage puts notes before the header and the text", () => {
  expect(composeUserMessage("hi", "[Selection]", ["[note]"])).toBe("[note]\n\n[Selection]\n\nhi");
  expect(composeUserMessage("hi", "", [])).toBe("hi");
});
// hooks.test.ts: the existing denial test expects the new reason text
// agentRoutes.test.ts
test("proposal routes list pending proposals and record decisions", async () => {
  // GET /api/agent/proposals → 200 [proposal]; POST .../p_1/decision {decision:"accepted"} → 204 and agent.decideProposal called;
  // POST .../p_9/decision → 404; POST .../p_1/decision {decision:"maybe"} → 400
});
test("send forwards proposalId and 404s when it is not pending", async () => {
  // POST /api/agent/send { text, proposalId: "p_1" } → 202 and agent.send called with "p_1"; a NotFoundError from send → 404
});
test("createAgent prefixes decision notes and refine requests to the next message", async () => {
  // using the fake sdk from the existing wiring test: decideProposal("p_1","accepted") then send("ok") → the user message starts with `[Proposal p_1`;
  // send("tighter", undefined, "p_2") with p_2 pending → the message contains `call revise with proposalId p_2`; with p_2 unknown → rejects NotFoundError
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/prompt.test.ts test/server/agent/hooks.test.ts test/server/agentRoutes.test.ts`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement**

Seed pending proposals in the wiring test by writing a `proposals.jsonl` into the temp store before `createAgent`.

- [ ] **Step 4: Run the tests and the full check**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/prompt.ts src/server/agent/hooks.ts src/server/agent/index.ts src/server/agentRoutes.ts src/server/index.ts test/server/agent/prompt.test.ts test/server/agent/hooks.test.ts test/server/agentRoutes.test.ts
git commit -m "feat(agent): proposal routes, refine and decision notes, and the proposal prompt"
```

---

