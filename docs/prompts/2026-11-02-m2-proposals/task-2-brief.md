### Task 2: The proposal store

**Files:**
- Create: `src/server/agent/proposals.ts`
- Test: `test/server/agent/proposals.test.ts`

**Interfaces:**
- Consumes: `FileStore.appendProposal`, `FileStore.readProposals`, `Proposal`, `Decision`, `ProposalLogEntry` from Task 1; `NotFoundError` from `src/server/files.ts`.
- Produces in `src/server/agent/proposals.ts`:

```ts
export class ProposalStore {
  constructor(files: Pick<FileStore, "appendProposal" | "readProposals">);
  load(): Promise<void>;                 // replays the log: proposed/revised set the pending record, accepted/rejected remove it
  pending(): Proposal[];                 // oldest first
  get(id: string): Proposal | undefined; // pending only
  newId(): string;                       // "p_" + 8 lowercase hex chars from randomBytes, never one already seen
  proposed(p: Proposal): Promise<void>;  // logs "proposed" and adds to pending
  revised(p: Proposal): Promise<void>;   // throws NotFoundError("proposal <id> is not pending") unless pending; logs "revised"; replaces the record
  decided(id: string, decision: Decision): Promise<Proposal>;  // throws NotFoundError unless pending; logs; removes; queues a note
  takeNotes(): string[];                 // drains notes queued by decided(), e.g. `[Proposal p_1 "Login flow" was accepted.]` or `[Proposal p_2 was rejected.]` when the title is null
}
```

- [ ] **Step 1: Write the failing tests**

```ts
test("load replays the log into pending, oldest first, with revisions replacing ops", async () => {
  // log: proposed p_1, proposed p_2, revised p_1 (new ops), accepted p_2
  expect(store.pending().map((p) => p.id)).toEqual(["p_1"]);
  expect(store.get("p_1")?.ops).toEqual(newOps);
  expect(store.get("p_2")).toBeUndefined();
});
test("proposed, revised, and decided write log entries and maintain pending", async () => {
  // proposed → pending has it and the log has a "proposed" line;
  // revised with other ops → log has "revised", pending shows the new ops;
  // decided accepted → log has "accepted", pending is empty, takeNotes() returns one note naming id and title, then []
});
test("revised and decided reject ids that are not pending", async () => {
  await expect(store.revised({ ...p, id: "p_9" })).rejects.toBeInstanceOf(NotFoundError);
  await expect(store.decided("p_9", "rejected")).rejects.toBeInstanceOf(NotFoundError);
});
test("newId never repeats an id seen in the log", async () => {
  // stub randomBytes or loop: ids are /^p_[0-9a-f]{8}$/ and distinct from the replayed ones
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/proposals.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `ProposalStore`**

A `Map<string, Proposal>` for pending, a `Set<string>` of every id seen, and a `string[]` of notes. Use a fake `files` object in tests (an in-memory array for the log).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent/proposals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/proposals.ts test/server/agent/proposals.test.ts
git commit -m "feat(proposals): the proposal store replays the log and tracks pending proposals"
```

---

