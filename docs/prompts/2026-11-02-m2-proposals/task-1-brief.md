### Task 1: Proposal schemas and the proposal log

**Files:**
- Create: `src/shared/proposals.ts`
- Modify: `src/server/files.ts`
- Test: `test/shared/proposals.test.ts`, `test/server/files.test.ts`

**Interfaces:**
- Produces in `src/shared/proposals.ts`:

```ts
import { z } from "zod";
export const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_diagram"), mermaid: z.string().min(1), near: z.array(z.string()).optional() }),
  z.object({ op: z.literal("add_note"), text: z.string().min(1), near: z.array(z.string()).optional() }),
  z.object({ op: z.literal("update"), id: z.string(), label: z.string().optional(),
             strokeColor: z.string().optional(), backgroundColor: z.string().optional() }),
  z.object({ op: z.literal("delete"), id: z.string() }),
]);
export type Op = z.infer<typeof Op>;
export const Propose = z.object({ title: z.string().optional(), ops: z.array(Op).min(1) });
export const Revise = z.object({ proposalId: z.string(), ops: z.array(Op).min(1) });
export type Proposal = { id: string; board: string; title: string | null; ops: Op[]; at: string };
export type Decision = "accepted" | "rejected";
export type ProposalLogEntry =
  | { event: "proposed" | "revised"; at: string; proposal: Proposal }
  | { event: Decision; at: string; id: string };
export const ProposalLogEntry: z.ZodType<ProposalLogEntry>;   // validates a parsed log line
export function referencedIds(ops: Op[]): string[];           // update.id, delete.id, and every near id, in order, without duplicates
```

- Produces on `FileStore`: `appendProposal(entry: ProposalLogEntry): Promise<void>` (appends one JSON line to `.blueprint/proposals.jsonl`, creating the file) and `readProposals(): Promise<ProposalLogEntry[]>` (a missing file is `[]`; a line that is not valid JSON or fails the schema throws `Error("proposals.jsonl line <n>: <reason>")`).

- [ ] **Step 1: Write the failing tests**

```ts
// test/shared/proposals.test.ts
test("Propose requires at least one op and rejects unknown ops", () => {
  expect(Propose.safeParse({ ops: [] }).success).toBe(false);
  expect(Propose.safeParse({ ops: [{ op: "paint", id: "a" }] }).success).toBe(false);
  expect(Propose.safeParse({ title: "t", ops: [{ op: "delete", id: "a" }] }).success).toBe(true);
});
test("referencedIds collects update, delete, and near ids once each", () => {
  const ops: Op[] = [
    { op: "add_diagram", mermaid: "flowchart LR\n a-->b", near: ["x", "y"] },
    { op: "update", id: "y", label: "new" },
    { op: "delete", id: "z" },
    { op: "add_note", text: "n", near: ["x"] },
  ];
  expect(referencedIds(ops)).toEqual(["x", "y", "z"]);
});
// test/server/files.test.ts
test("proposal log appends lines and reads them back; a missing file is empty", async () => {
  expect(await store.readProposals()).toEqual([]);
  const proposal = { id: "p_1", board: "main", title: null, ops: [{ op: "delete", id: "a" }], at: "2026-11-02T00:00:00.000Z" };
  await store.appendProposal({ event: "proposed", at: proposal.at, proposal });
  await store.appendProposal({ event: "accepted", at: proposal.at, id: "p_1" });
  expect(await store.readProposals()).toEqual([
    { event: "proposed", at: proposal.at, proposal },
    { event: "accepted", at: proposal.at, id: "p_1" },
  ]);
  expect((await readFile(join(store.dir, "proposals.jsonl"), "utf8")).trim().split("\n")).toHaveLength(2);
});
test("a corrupt proposal log line is reported with its line number", async () => {
  await writeFile(join(store.dir, "proposals.jsonl"), '{"event":"accepted","at":"x","id":"p_1"}\n{nope\n');
  await expect(store.readProposals()).rejects.toThrow("proposals.jsonl line 2");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/shared/proposals.test.ts test/server/files.test.ts -t "proposal"`
Expected: FAIL, module not found and `appendProposal is not a function`.

- [ ] **Step 3: Implement the schemas and the log**

`appendProposal` uses `appendFile` with a trailing newline. `readProposals` splits on newlines, skips blank lines, and validates each with `ProposalLogEntry`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/shared/proposals.test.ts test/server/files.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/proposals.ts src/server/files.ts test/shared/proposals.test.ts test/server/files.test.ts
git commit -m "feat(proposals): operation schemas and the proposal log"
```

---

