### Task 0: Server-side proposal reconcile on save

Carried from the milestone 2 final review: the browser rejects a proposal whose ghosts the user removed by hand, but three narrow gaps remain (a 409 during a revise is not retried, the browser's own state is not cleaned, and leaving the board within the grace period keeps the orphan). A server-side backstop closes all three, and it runs before compile reads the board.

**Files:**
- Modify: `src/server/agent/proposals.ts`, `src/server/routes.ts`, `src/server/app.ts`, `src/server/index.ts`
- Test: `test/server/agent/proposals.test.ts`, `test/server/routes.test.ts`

**Interfaces:**
- `ProposalStore.reconcile(board: string, elements: readonly { isDeleted?: boolean; customData?: Record<string, unknown> }[]): Promise<Proposal[]>`: for every pending proposal of `board` that is not being revised, if no non-deleted element carries `customData.proposalId === id` together with a `customData.ghost` tag, call `decided(id, "rejected")`; proposals whose record `at` is less than `RECONCILE_GRACE_MS = 5_000` before now are skipped (`proposed` and `revised` stamp the record and its log entry with the logging time, so the clock starts when the browser acknowledged the ghosts) (an autosave that left the browser before the ghosts were drawn must not reject a fresh proposal); returns the proposals it rejected.
- `routes(store, proposals?)` and `createApp(store, agent?, proposals?)`: after `PUT /boards/:name` writes the board, the route calls `proposals.reconcile(name, board.elements)` when a store is given; `startServer` passes the agent's store (expose it as `agent.proposals`).

- [ ] **Step 1: Write the failing tests**

```ts
test("reconcile rejects a pending proposal with no ghost left on the board and skips one being revised", async () => {
  // p_1 pending on "main" with no ghost elements → rejected and logged; p_2 pending with a ghost element → still pending; p_3 pending but beginRevise'd → still pending
});
test("PUT /api/boards/:name reconciles pending proposals of that board", async () => {
  // seed a pending proposal for "flow"; save a scene without its ghosts → GET /api/agent/proposals no longer lists it and the log has a rejected line
});
```

- [ ] **Step 2: Run the tests to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `pnpm check`** — pristine.
- [ ] **Step 5: Commit**

```bash
git add src/server/agent/proposals.ts src/server/routes.ts src/server/app.ts src/server/index.ts src/server/agent/index.ts test/server/agent/proposals.test.ts test/server/routes.test.ts
git commit -m "fix(proposals): reconcile pending proposals against the saved board"
```

---

