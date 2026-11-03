# Milestone 2: Ghost Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `propose` and `revise` work end to end: Claude's operations arrive on the board as ghost shapes (Mermaid diagrams and notes beside the selection, in-place changes and deletions as ghost diffs), and the user accepts, rejects, or refines them from a floating toolbar, with every proposal and outcome logged.

**Architecture:** Proposals are lists of operations validated by shared Zod schemas. The server gains two tools, `propose` and `revise`, that validate element ids against the stored board, make a `proposal.apply` round trip to the open browser tab, and log the outcome through a `ProposalStore` that replays `.blueprint/proposals.jsonl` on start. The browser owns ghost state: every ghost element carries its proposal id, its kind, and a snapshot of the values it overwrote in `customData`, so the board file is the single source of truth, a reload rebuilds the toolbar from the scene, and undo works. Pure functions in `src/ui/board/ghosts.ts` place, apply, and decide proposals; `src/ui/board/mermaid.ts` turns Mermaid into Excalidraw elements with `@excalidraw/mermaid-to-excalidraw`; `BoardView` answers apply requests and hosts the toolbar; the panel's Refine flow sends the proposal id with the next message, and decisions reach Claude as a note on the next message.

**Tech Stack:** The milestone 1 stack plus `@excalidraw/mermaid-to-excalidraw` 3.2.x (lays diagrams out with Pele; needs `DOMParser` and a canvas `measureText`, so it runs in the browser and, with a stub, in jsdom tests).

**Spec:** `docs/build-plan.md` (sections 4 steps 4 to 7, 5 `proposals.jsonl`, 6.1 ghost styling and `customData`, 6.4 panel rows, 6.5 write tools, 8 row 2, 9, 10). Milestone 1 is on `main`; this plan builds on its interfaces: `createBoardTools`, `WsHub.request`, `PlanSession`, `createAgent`, `agentRoutes`, `ClaudePanel`, `SelectionProvider`, `BoardView`.

Calls made for this plan, in the spec's spirit where it is silent:

- Ghost state lives in element `customData` (`{ origin: "ai", proposalId, ghost, before }`), not in a separate browser store. The server's `ProposalStore` keeps ids, titles, and pending status by replaying the log, so the two agree after a restart.
- The spec's "pending badge" for updates is the toolbar's counts (`1 changed`), not a badge drawn per element.
- Board exports hide `add` ghosts (they do not exist yet) and append a line listing pending proposals, so Claude never mistakes its own ghosts for accepted shapes.
- Accept keeps the per-proposal group so a diagram stays a unit; reject deletes added elements with `isDeleted: true`, which Excalidraw's history can undo.
- The next user message after a decision starts with a note such as `[Proposal p_1a2b3c4d "Login flow" was accepted.]`, so Claude knows what landed.
- A tool failure in the browser (bad Mermaid, unknown id) changes nothing on the board and logs nothing: conversions happen before any scene mutation, and the server logs only after the browser acknowledges.

## Global Constraints

- Node 22.1 or later; TypeScript strict; ESM; server code uses NodeNext resolution with explicit `.js` extensions on relative imports.
- No API key anywhere. The SDK runs on the user's Claude Code login; Blueprint never reads, stores, or forwards credentials.
- Claude never edits board files directly: proposals are the only write path, and the `PreToolUse` guard from milestone 1 stays.
- AI edits are never applied without an accept step: every operation lands as a ghost first, and only `accepted` makes it real.
- Ghost styling: added elements at `opacity: 40` with `strokeStyle: "dashed"` and the proposal id appended to `groupIds` as the outermost group; updated elements with `strokeStyle: "dashed"`; deleted elements at `opacity: 40` with `strokeStyle: "dashed"` and `strokeColor: "#e03131"`. Ghosts are not locked.
- Every element Blueprint creates or accepts carries `customData.origin: "ai"` and `customData.proposalId`.
- Placement: beside the anchor's bounding box with an 80 pixel gap to the right, top-aligned; several additions in one proposal stack downward with a 40 pixel gap; with nothing to anchor on, centered in the viewport.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; anything the importer turns into an image is rejected with a message naming those five kinds.
- All agent output reaches the browser as typed WebSocket messages; commands go through HTTP routes so they are testable with `app.request()`.
- No "Claude Code" branding in UI copy; the panel is titled `Claude`.
- Every UI test file that renders components or hooks starts with `// @vitest-environment jsdom`.
- Commit messages use conventional commits and carry no co-author trailer.
- `pnpm check` (both typechecks, Biome, Vitest) stays pristine; `pnpm build` warns only about the pre-existing chunk size.

## Review Focus

1. Mermaid the importer rejects, or a pie or gantt chart it would turn into an image: the tool must fail with a message Claude can act on, and the board must not change. Pinned in Task 6 (importer errors) and Task 3 (a browser error becomes a tool error and logs nothing).
2. An operation naming an element that was deleted after Claude read the board: the server names the id in the error, and the browser re-checks before mutating so nothing is half-applied. Pinned in Task 3 and Task 5.
3. A reload, or a second tab, while ghosts are pending: the toolbar reappears from the scene, and accept or reject still work and still log. Pinned in Task 5 (`pendingProposals` reads persisted `customData`), Task 2 (replay), and Task 10.
4. `revise` after the user nudged the old ghosts: the old ghosts go, the new ones land beside the same anchor, and exactly one proposal stays pending. Pinned in Task 5 (replace) and Task 3 (`replace: true`).
5. `propose` while no board tab is open, or while the tab is slow: Claude gets a clear error within the timeout and the turn never hangs. Pinned in Task 3.

---

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

### Task 5: Ghost logic

**Files:**
- Create: `src/ui/board/ghosts.ts`
- Test: `test/ui/ghosts.test.ts`

**Interfaces:**
- Consumes: `Proposal`, `Op`, `Decision` from Task 1.
- Produces in `src/ui/board/ghosts.ts` (pure, no DOM, no Excalidraw import; tests use plain objects):

```ts
export type GhostKind = "add" | "update" | "delete";
export type Before = Partial<{ strokeStyle: string; opacity: number; strokeColor: string; backgroundColor: string; label: string; customData: Record<string, unknown> | undefined }>;
export type Ghost = { origin: "ai"; proposalId: string; ghost: GhostKind; before?: Before };
export type El = {                       // the slice of an Excalidraw element this module touches
  id: string; type: string; x: number; y: number; width: number; height: number;
  isDeleted?: boolean; opacity: number; strokeStyle: string; strokeColor: string; backgroundColor: string;
  groupIds: readonly string[]; containerId?: string | null; text?: string; originalText?: string;
  customData?: Record<string, unknown>;
};
export type Bounds = { x: number; y: number; w: number; h: number };
export type Viewport = Bounds;           // scene coordinates: x = -scrollX, y = -scrollY, w = width / zoom, h = height / zoom
export type Counts = { added: number; updated: number; deleted: number };

export function ghostOf(e: El): Ghost | null;
export function bounds(elements: readonly El[]): Bounds | null;              // of non-deleted elements; null when none
export function anchor(elements: readonly El[], nearIds: readonly string[], selectedIds: readonly string[]): Bounds | null;
   // bounds of the near ids that exist, else of the selected ids, else of everything
export function placeBeside(anchor: Bounds | null, viewport: Viewport, size: { w: number; h: number }, offsetY: number): { x: number; y: number };
   // anchor: x = anchor.x + anchor.w + 80, y = anchor.y + offsetY, where offsetY is the height of earlier additions in this proposal plus 40 per gap;
   // null anchor: the first addition is centered in the viewport and later ones stack below it
export function pendingProposals(elements: readonly El[]): { id: string; counts: Counts }[];   // first-seen order, non-deleted ghosts only
export function applyProposal(
  elements: readonly El[], proposal: Proposal, rendered: ReadonlyMap<number, El[]>,   // op index → converted elements at their native coordinates
  ctx: { selectedIds: readonly string[]; viewport: Viewport },
): { elements: El[]; ids: string[] };     // throws Error("unknown element id <id>") before touching anything
export function decideProposal(elements: readonly El[], id: string, decision: Decision): El[];
export function labelOf(elements: readonly El[], id: string): El | undefined;   // the bound text (containerId === id) or the element itself when it is text
```

  Rules `applyProposal` follows: additions are translated so each group's bounds start at `placeBeside(...)`, get the ghost style, `groupIds: [...groupIds, proposal.id]` (outermost last), and `customData: { origin: "ai", proposalId, ghost: "add" }`; `add` snapshots its rendered `strokeStyle` into `before`; `update` snapshots the current `strokeStyle`, each changed color, the label text, and `customData` into `before`, then applies the new values and `strokeStyle: "dashed"` (a label change sets `text` and `originalText` on the label element); `delete` snapshots `strokeStyle`, `opacity`, `strokeColor`, and `customData`, then applies the delete style. `decideProposal` on `accepted`: `add` → `opacity: 100`, `strokeStyle` restored from `before`, `customData: { origin: "ai", proposalId }`; `update` → restore only `strokeStyle` from `before`, keep the new values, `customData: { origin: "ai", proposalId }`; `delete` → `isDeleted: true` on the element and on its bound text. On `rejected`: `add` → `isDeleted: true`; `update` and `delete` → restore every `before` key, including the label text and `customData`.

- [ ] **Step 1: Write the failing tests**

```ts
test("add ops land beside the anchor with the ghost style, group, and tag", () => {
  // anchor element a at (0,0,100,50); rendered diagram at (10,10) with two shapes; after apply: min x === 180, min y === 0,
  // every added element has opacity 40, strokeStyle "dashed", groupIds.at(-1) === "p_1", customData.ghost === "add"; ids lists them
});
test("two additions stack downward with a 40px gap, and an empty board centers in the viewport", ...);
test("update snapshots before values, dashes the stroke, and rewrites the bound label", () => {
  // container b with bound text t "Old" → after update { label: "New", backgroundColor: "#fff" }: t.text === "New", t.originalText === "New",
  // b.strokeStyle === "dashed", b.customData.before deep-equals { strokeStyle: "solid", backgroundColor: "#eee", label: "Old", customData: undefined }
});
test("delete shows red dashed at opacity 40 and keeps the element", ...);
test("an unknown id throws before anything changes", () => {
  expect(() => applyProposal(els, { ...p, ops: [{ op: "delete", id: "nope" }] }, new Map(), ctx)).toThrow("unknown element id nope");
});
test("pendingProposals counts per proposal in first-seen order and ignores deleted ghosts", ...);
test("accept makes additions real, keeps updates, deletes deletions with their labels", ...);
test("reject removes additions and restores updates and deletions exactly", () => {
  // after reject the update target deep-equals its original object, including customData undefined
});
test("replace flow: rejecting p_1 then applying p_1 again leaves one pending proposal", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/ghosts.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `ghosts.ts`**

Never mutate inputs: return new element objects for touched elements and reuse untouched ones by reference.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui/ghosts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/ghosts.ts test/ui/ghosts.test.ts
git commit -m "feat(ui): ghost placement, application, and decisions as pure functions"
```

---

### Task 6: Mermaid to Excalidraw elements

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/ui/board/mermaid.ts`
- Test: `test/ui/mermaid.test.ts`

**Interfaces:**
- Produces in `src/ui/board/mermaid.ts`:

```ts
export const SUPPORTED = "only flowchart, sequence, class, ER, and state diagrams can become shapes";
export async function renderMermaid(definition: string): Promise<ExcalidrawElement[]>;
   // parseMermaidToExcalidraw(definition, { themeVariables: { fontSize: "16px" } }), then
   // convertToExcalidrawElements(elements, { regenerateIds: true }); throws Error(SUPPORTED) if the result has files or an image element;
   // parse errors propagate with the importer's message
export function renderNote(text: string): ExcalidrawElement[];
   // convertToExcalidrawElements([{ type: "text", x: 0, y: 0, text, fontSize: 16 }], { regenerateIds: true })
```

  `ExcalidrawElement` here is `@excalidraw/excalidraw/element/types`'s type; `BoardView` casts to `El` from Task 5 at the call site.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @excalidraw/mermaid-to-excalidraw@^3.2.0`
Expected: installs with `pele`; no peer warnings.

- [ ] **Step 2: Write the failing tests**

```ts
// @vitest-environment jsdom
// The importer measures labels on a canvas; jsdom has none, so stub measureText by character count.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({
    font: "", measureText: (t: string) => ({ width: t.length * 10, actualBoundingBoxAscent: 16, actualBoundingBoxDescent: 4 }),
  })) as never;
});
test("a flowchart becomes shapes, labels, and bound arrows with fresh ids", async () => {
  const els = await renderMermaid("flowchart LR\n  A[Login] --> B{Valid?}\n  B -->|yes| C[Home]");
  const types = els.map((e) => e.type);
  expect(types).toEqual(expect.arrayContaining(["rectangle", "diamond", "arrow", "text"]));
  expect(els.every((e) => !["A", "B", "C", "A_B"].includes(e.id))).toBe(true);
  const arrow = els.find((e) => e.type === "arrow") as { startBinding: { elementId: string } | null };
  expect(els.some((e) => e.id === arrow.startBinding?.elementId)).toBe(true);
});
test("a parse error propagates with the importer's message", async () => {
  await expect(renderMermaid("flowchart LR\n  A --> ")).rejects.toThrow(/Parse error/);
});
test("a diagram the importer draws as an image is rejected", async () => {
  await expect(renderMermaid('pie\n  "a": 1\n  "b": 2')).rejects.toThrow(SUPPORTED);
});
test("a note is one measured text element", () => {
  const [note] = renderNote("Cache lives here");
  expect(note.type).toBe("text");
  expect(note.width).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/mermaid.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `mermaid.ts`**

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm vitest run test/ui/mermaid.test.ts && pnpm build`
Expected: PASS; the build succeeds with only the chunk-size warning. If Vite needs the importer excluded from pre-bundling or the server bundle, note the setting in the report.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/ui/board/mermaid.ts test/ui/mermaid.test.ts
git commit -m "feat(ui): render Mermaid and notes into Excalidraw elements"
```

---

### Task 7: The proposals toolbar, the refine context, and the API client

**Files:**
- Create: `src/ui/board/ProposalsBar.tsx`, `src/ui/panel/refine.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/styles.css`
- Test: `test/ui/ProposalsBar.test.tsx`, `test/ui/refine.test.tsx`

**Interfaces:**
- Consumes: `Counts` (Task 5), `Proposal`, `Decision` (Task 1), routes from Task 4.
- Produces in `src/ui/api.ts`: `agentSend(text, selection?, proposalId?)` posts `{ text, selection, proposalId }`; `listProposals(): Promise<Proposal[]>`; `decideProposal(id: string, decision: Decision): Promise<void>`.
- Produces in `src/ui/panel/refine.tsx`: `RefineProvider`, `useRefine(): { target: { id: string; title: string | null } | null; setTarget(t: { id: string; title: string | null } | null): void }`. `App` wraps the shell in it next to `SelectionProvider`.
- Produces in `src/ui/board/ProposalsBar.tsx`:

```ts
export function ProposalsBar(props: {
  items: { id: string; title: string | null; counts: Counts }[];
  onDecide(id: string, decision: Decision): void;
  onRefine(id: string): void;
}): JSX.Element | null;   // null when items is empty
```

  One row per item: `Claude proposed <title or "changes"> · <parts>` where parts are the non-zero counts as `2 added`, `1 changed`, `1 removed` joined by `, `; then buttons `Accept`, `Reject`, `Refine`. Styles: `.proposals-bar` floats at the bottom center of `.board` (absolute, `bottom: 16px`, `left: 50%`, translated, surface background, border, radius, shadow); `.proposals-row`; `Accept` uses an accent-filled `.button-primary`.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
test("renders a row per proposal with counts and wires the buttons", async () => {
  // items: p_1 "Login flow" {2,0,0}; p_2 null {0,1,1}
  // text "Claude proposed Login flow · 2 added" and "Claude proposed changes · 1 changed, 1 removed" are present
  // clicking Accept in the first row calls onDecide("p_1", "accepted"); Reject in the second calls onDecide("p_2", "rejected"); Refine calls onRefine("p_2")
});
test("renders nothing without proposals", ...);
// refine.test.tsx: useRefine starts null; setTarget updates consumers
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/ProposalsBar.test.tsx test/ui/refine.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/ProposalsBar.tsx src/ui/panel/refine.tsx src/ui/api.ts src/ui/App.tsx src/ui/styles.css test/ui/ProposalsBar.test.tsx test/ui/refine.test.tsx
git commit -m "feat(ui): proposals toolbar, refine context, and proposal API calls"
```

---

### Task 8: Board integration

**Files:**
- Modify: `src/ui/board/BoardView.tsx`

**Interfaces:**
- Consumes: everything from Tasks 5, 6, and 7; `useRefine`; `CaptureUpdateAction`, `restoreElements`, `ExcalidrawImperativeAPI.updateScene`, `scrollToContent`.
- Produces: `BoardView` answers `proposal.apply` requests and renders `ProposalsBar`.

  Applying a request: refuse when `proposal.board !== name` (`board <x> is not open`) or the scene is still loading; for each `add_diagram` op `await renderMermaid(op.mermaid)` and for each `add_note` op `renderNote(op.text)` into the `rendered` map, so every conversion error happens before any mutation; then `elements = ex.getSceneElementsIncludingDeleted()`, with `replace` first `decideProposal(elements, id, "rejected")`; `applyProposal(...)` with the current selection ids and the viewport from `appState`; run the result through `restoreElements(next, null, { refreshDimensions: true, repairBindings: true })` so changed labels are re-measured; `ex.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY })`; `ex.scrollToContent(touched, { animate: true, fitToViewport: false })` only when some touched element lies outside the viewport; respond `{ elementIds }`.

  Deciding: `decideProposal` + `restoreElements` + `updateScene` as above, then `api.decideProposal(id, decision)`; a 404 (the server lost the record) is logged with `console.warn` and the local change stands.

  The bar's items come from `pendingProposals(latest.current.elements)` recomputed in `onChange` (memoized on scene version), with titles from a `Map<string, string | null>` filled by apply requests and by `api.listProposals()` on mount. `onRefine(id)` calls `setTarget({ id, title })`.

- [ ] **Step 1: Implement the wiring**

No new unit test: `BoardView` is not rendered in jsdom (Excalidraw needs a real canvas) and its logic lives in Tasks 5 to 7. Keep the request handling in a named `applyProposalRequest` function inside the file for readability.

- [ ] **Step 2: Build and verify by hand**

Run: `pnpm check && pnpm build && pnpm dev`
Then, with your real login and a board with two labeled boxes joined by an arrow: select all three and ask `Add a cache between these two`. Expected: a `proposing N changes` row, the arrow turns red dashed, a dashed diagram appears 80 pixels to the right of the selection, the bar reads `Claude proposed ... · 2 added, 1 removed` (counts as Claude chose), `Reject` restores the arrow and removes the ghosts, and `proposals.jsonl` has `proposed` and `rejected` lines. Then ask `Draw the login flow as a flowchart` with nothing selected: ghosts land right of all content; `Accept` makes them solid; reload the page before accepting another one to confirm the bar is rebuilt from the scene. Record every observation in the report.

- [ ] **Step 3: Commit**

```bash
git add src/ui/board/BoardView.tsx
git commit -m "feat(ui): the board applies proposals as ghosts and decides them"
```

---

### Task 8b: Arrow ids in the board export and typed API errors

Added during execution: the Task 8 real-login check showed that connected arrows have no ids in the board Markdown, so Claude cannot target them with `update` or `delete`; and the board view matched a 404 by its message text because `api.ts` throws without a status.

**Files:**
- Modify: `src/export/markdown.ts`, `test/export/fixtures/basic.md`, `src/server/agent/prompt.ts`, `src/ui/api.ts`, `src/ui/board/BoardView.tsx`
- Test: `test/export/markdown.test.ts`, `test/server/agent/prompt.test.ts`, `test/ui/api.test.ts`

**Interfaces:**
- `boardGraphToMarkdown` emits, right after the `<!-- ids: … -->` comment and only when there are connected arrows, a section `## Arrows` with one bullet per connected arrow in diagram order: `- <id>: "<from label>" (<fromId>) -> "<to label>" (<toId>)` plus ` label "<label>"` when the label is not blank (the same shape as the Unconnected arrows bullets). The golden `basic.md` gains that section.
- `SYSTEM_PROMPT_APPEND`'s propose line ends with `Element ids come from the selection header or get_board: nodes in its ids comment, arrows in its Arrows list.`
- `src/ui/api.ts` exports `class ApiError extends Error { status: number }`; `request()` throws it for every non-ok response; `BoardView` treats a decision failure as "the server lost the record" only when `err instanceof ApiError && err.status === 404`.
- `BoardView` decides server-first: it calls `api.decideProposal` before touching the scene; on success or on a 404 (the server lost the record) it applies `decideProposal` locally (warning on the 404); on a 409 (Claude is revising it) it applies nothing and shows `Decision failed: <message>`; any other error applies nothing. It also deletes the proposal's entry from the `titles` map once decided.

- [ ] **Step 1: Write the failing tests**

```ts
test("connected arrows are listed with their ids after the diagram", () => {
  // the basic fixture graph → the Markdown contains "## Arrows" and the bullet for the SQL edge with both node ids
});
test("the prompt tells Claude where arrow ids come from", () => { expect(SYSTEM_PROMPT_APPEND).toMatch(/arrows in its Arrows list/); });
// @vitest-environment jsdom  (api.test.ts)
test("request throws ApiError with the status and the server's message", async () => {
  // fetch mocked to return 404 { error: "proposal p_1 is not pending" } → rejects with ApiError, status 404, message from the body
});
```

- [ ] **Step 2: Run the tests to verify they fail**
- [ ] **Step 3: Implement and regenerate the golden by hand (edit `basic.md`; do not add a snapshot updater)**
- [ ] **Step 4: Run `pnpm check`** — pristine.
- [ ] **Step 5: Commit**

```bash
git add src/export/markdown.ts test/export/fixtures/basic.md test/export/markdown.test.ts src/server/agent/prompt.ts test/server/agent/prompt.test.ts src/ui/api.ts src/ui/board/BoardView.tsx test/ui/api.test.ts
git commit -m "feat(export): list connected arrows with ids, and typed API errors"
```

---

### Task 9: Refine from the panel

**Files:**
- Modify: `src/ui/panel/ClaudePanel.tsx`, `src/ui/styles.css`
- Test: `test/ui/ClaudePanel.test.tsx`

**Interfaces:**
- Consumes: `useRefine` (Task 7), `agentSend` with `proposalId` (Task 7).
- Produces: the `Stopped` result row shows its cost as `Stopped · $<cost> total`, matching the Done row (carried from the milestone 1 final review); the regex that strips a `[Selection on board …]` header from user bubbles, and its test, are removed (the server now sends the typed text as the user event, Task 4); while `target` is set the panel shows a chip above the composer, `Refining <id> · <title>` with an `×` button that clears it, focuses the textarea, sends the next message with `proposalId: target.id`, and clears the target after the send resolves. Tool rows for `propose` and `revise` already read `proposing 2 changes` and `revising p_…` through `summarizeTool`.

- [ ] **Step 1: Write the failing tests**

```tsx
test("a refine target shows a chip, sends the proposal id, and clears", async () => {
  // render inside RefineProvider with a test button that calls setTarget({ id: "p_1", title: "Login flow" })
  // chip text "Refining p_1 · Login flow"; typing "tighter" + Enter → agentSend("tighter", <selection or undefined>, "p_1"); chip gone afterwards
});
test("the chip's × clears the target without sending", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/ClaudePanel.test.tsx`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panel/ClaudePanel.tsx src/ui/styles.css test/ui/ClaudePanel.test.tsx
git commit -m "feat(ui): refine a proposal from the panel"
```

---

### Task 11: Connecting operations

Added during execution: the acceptance run showed that Claude could not express the spec's own scenario ("Add a cache between these two"): a diagram's nodes get fresh ids, so nothing could join a new shape to existing shapes. Two operations close that gap, and `revise` learns to retitle.

**Files:**
- Modify: `src/shared/proposals.ts`, `src/server/agent/tools.ts`, `src/server/agent/proposals.ts`, `src/server/agent/prompt.ts`, `src/ui/board/ghosts.ts`, `src/ui/board/mermaid.ts`, `src/ui/board/BoardView.tsx`
- Test: `test/shared/proposals.test.ts`, `test/server/agent/tools.test.ts`, `test/server/agent/proposals.test.ts`, `test/server/agent/prompt.test.ts`, `test/ui/ghosts.test.ts`, `test/ui/mermaid.test.ts`

**Interfaces:**
- `Op` gains two members:

```ts
z.object({ op: z.literal("add_node"), label: z.string().min(1), kind: z.enum(["box", "ellipse", "diamond"]).default("box"), near: z.array(z.string()).optional() }),
z.object({ op: z.literal("add_arrow"), from: z.string(), to: z.string(), label: z.string().optional() }),
```

  `from` and `to` are element ids, or `$<i>` naming an earlier `add_node` op of the same proposal (`$0` is the first op). `referencedIds` skips `$` references. `export function checkRefs(ops: Op[]): void` throws `Error("op <i>: $<j> must name an earlier add_node")` for a bad reference; the tools call it before `checkIds`, and `Revise` gains `title: z.string().optional()`, which replaces the record's title when given (`ProposalStore.revised` takes the new title).
- `renderNode(label: string, kind: "box" | "ellipse" | "diamond"): ExcalidrawElement[]` in `src/ui/board/mermaid.ts` converts `[{ type: <rectangle|ellipse|diamond>, x: 0, y: 0, label: { text: label } }]` with `regenerateIds: true` (one shape plus its bound text).
- `applyProposal` handles `add_node` like `add_note` (rendered group placed beside the anchor; `ids` records the shape's id per op index so `$i` resolves to it) and `add_arrow` after every other op: it resolves both ends to element bounds (existing non-deleted elements, or the placed node), builds one arrow element with `type: "arrow"`, `x`/`y` at the start border point, `points: [[0, 0], [dx, dy]]` to the end border point (the line between the two centers intersected with each bounding box), `startBinding`/`endBinding: { elementId, focus: 0, gap: 1 }`, `startArrowhead: null`, `endArrowhead: "arrow"`, the ghost style, the proposal group, and `customData` tagged `add`; a label becomes a bound text element (`containerId` set, placed at the arrow's midpoint) tagged the same way. The target elements' `boundElements` are not patched by this module; `restoreElements(…, { repairBindings: true })` in `BoardView` does that.
- `SYSTEM_PROMPT_APPEND`'s propose line lists the six ops and ends with: `To put a new node between two existing ones, delete their arrow, add_node the new one, and add_arrow from each side using $<index> to name the new node.`

- [ ] **Step 1: Write the failing tests**

```ts
test("add_node and add_arrow parse, $ references resolve only to earlier add_node ops", ...);   // checkRefs ok for [$0 after add_node], throws for $1 naming a delete and for $5 out of range
test("revise can retitle", ...);     // store.revised(p with new title) → pending title changes; tool passes title through
test("add_node is placed beside the anchor and add_arrow binds both ends", () => {
  // elements a (0,0,100,50) and b (300,0,100,50); ops: delete the arrow ab, add_node "Cache", add_arrow a→$1, add_arrow $1→b
  // the node lands at x 180 (80px gap); both arrows have startBinding/endBinding elementIds matching, points span between border points, ghost style, group, tag; counts.added === 3
});
test("a $ reference to a missing node throws before anything changes", ...);
test("renderNode makes a shape with a bound label", ...);
test("the prompt names add_node, add_arrow, and the $ reference", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**
- [ ] **Step 3: Implement**, then verify by hand with the real login: select the two boxes and their arrow and ask `Add a cache between these two`. Expected: the arrow turns red dashed, a dashed Cache box appears between with two dashed arrows bound to the boxes, the bar reads `3 added, 1 removed`, Accept leaves solid bound arrows that follow the boxes when dragged.
- [ ] **Step 4: Run `pnpm check`** — pristine.
- [ ] **Step 5: Commit**

```bash
git add src/shared/proposals.ts src/server/agent/tools.ts src/server/agent/proposals.ts src/server/agent/prompt.ts src/ui/board/ghosts.ts src/ui/board/mermaid.ts src/ui/board/BoardView.tsx test/shared/proposals.test.ts test/server/agent test/ui/ghosts.test.ts test/ui/mermaid.test.ts
git commit -m "feat(proposals): add_node and add_arrow connect new shapes to existing ones"
```

---

### Task 10: Milestone acceptance

**Files:** none expected.

- [ ] **Step 1: Full check and build**

Run: `pnpm check && pnpm build`
Expected: pristine apart from the chunk-size warning.

- [ ] **Step 2: Acceptance on a scratch repository with the real login**

Run `node dist/cli/index.js --no-open` in a fresh git repository and open the app. Draw two labeled boxes joined by an arrow. Then:

1. Select all three and ask `Add a cache between these two`. Expected: ghosts as in Task 8; `Reject` restores everything; `proposals.jsonl` logs `proposed` then `rejected`.
2. Ask `Draw the login flow as a flowchart` with nothing selected. Expected: ghosts to the right of all content; `Accept` makes them solid, grouped, and tagged `origin: "ai"` in the board file; the next message you send starts, in the server log or transcript, with the acceptance note.
3. Select one box and ask `Rename this to Dashboard and make it green`. Expected: a dashed box with the new label and color, the bar reads `1 changed`; press `Refine`, type `keep the old color`, Enter. Expected: a `revising p_…` row, the ghost is replaced in place, still one proposal pending; `Accept`.
4. Ask for a pie chart. Expected: a failed `proposing` row with the supported-kinds message and Claude recovering in text.
5. With a proposal pending, restart the server and reload. Expected: the bar reappears; `Accept` logs `accepted`.

Record every observation in the report and fix only what the run reveals, with `pnpm check` green and conventional commits.

- [ ] **Step 3: Commit any fixes**

Only if Step 2 required changes.
