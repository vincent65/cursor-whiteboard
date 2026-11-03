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
- Placement of a connecting node: when an `add_node` is the endpoint of exactly two `add_arrow` ops of the same proposal whose other ends are two distinct existing elements, it is centered on the midpoint of those elements' centers and its `near` is ignored; every other `add_node` is placed beside the anchor. `BoardView` adds each new bound arrow to its targets' `boundElements` itself (Excalidraw 0.18.1's `repairBindings` does not), and arrow labels get a non-zero size so Excalidraw keeps them.
- `SYSTEM_PROMPT_APPEND`'s propose line lists the six ops and ends with: `To put a new node between two existing ones, delete their arrow, add_node the new one, and add_arrow from each side using $<index> to name the new node. A node between two existing ones needs no near.`

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

