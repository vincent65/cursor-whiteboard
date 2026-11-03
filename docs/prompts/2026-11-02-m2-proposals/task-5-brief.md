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
  // every added element has opacity 40, strokeStyle "dashed", groupIds[0] === "p_1", customData.ghost === "add"; ids lists them
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

