### Task 2: Export schema and BoardGraph

**Files:**
- Create: `src/export/schema.ts`, `src/export/boardGraph.ts`, `src/export/index.ts`
- Test: `test/export/boardGraph.test.ts`

**Interfaces:**
- Produces (from `src/export/schema.ts`): Zod schemas and inferred types `ExcalidrawElement`, `BoardFileAsset`, `BoardFile`, `BoardNode`, `BoardEdge`, `BoardLoose`, `BoardGraph`.
- Produces (from `src/export/boardGraph.ts`): `excalidrawToBoardGraph(board: BoardFile, boardName: string): BoardGraph`.

- [ ] **Step 1: Write the schemas**

```ts
export const ExcalidrawElement = z.object({
  id: z.string(), type: z.string(), isDeleted: z.boolean().optional(),
  x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  text: z.string().optional(), containerId: z.string().nullable().optional(),
  boundElements: z.array(z.object({ id: z.string(), type: z.string() })).nullable().optional(),
  startBinding: z.object({ elementId: z.string() }).loose().nullable().optional(),
  endBinding: z.object({ elementId: z.string() }).loose().nullable().optional(),
  startArrowhead: z.string().nullable().optional(), endArrowhead: z.string().nullable().optional(),
  frameId: z.string().nullable().optional(), name: z.string().nullable().optional(),
  fileId: z.string().nullable().optional(), customData: z.record(z.string(), z.unknown()).optional(),
}).loose();
export const BoardFileAsset = z.object({ id: z.string(), mimeType: z.string(), created: z.number(), asset: z.string() });
export const BoardFile = z.object({
  type: z.literal("excalidraw"), version: z.number(), source: z.string().optional(),
  elements: z.array(ExcalidrawElement),
  appState: z.record(z.string(), z.unknown()).default({}),
  files: z.record(z.string(), BoardFileAsset).default({}),
});
export const BoardNode = z.object({
  id: z.string(), kind: z.enum(["box", "ellipse", "diamond", "text", "image", "frame"]),
  label: z.string(), frameId: z.string().nullable(), asset: z.string().optional(),
  bounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  origin: z.enum(["human", "ai"]),
});
export const BoardEdge = z.object({
  id: z.string(), from: z.string().nullable(), to: z.string().nullable(), label: z.string(),
  arrowheads: z.object({ start: z.boolean(), end: z.boolean() }),
});
export const BoardLoose = z.object({ id: z.string(), kind: z.enum(["draw", "line"]) });
export const BoardGraph = z.object({ board: z.string(), nodes: z.array(BoardNode), edges: z.array(BoardEdge), loose: z.array(BoardLoose) });
```

- [ ] **Step 2: Write the failing tests**

Build elements with a small `el(overrides)` helper in the test file that fills required numeric fields with zeros.

```ts
test("rectangle with bound text becomes a box node with the text as label", () => {
  const g = excalidrawToBoardGraph(board([
    el({ id: "r1", type: "rectangle", boundElements: [{ id: "t1", type: "text" }] }),
    el({ id: "t1", type: "text", text: "API", containerId: "r1" }),
  ]), "main");
  expect(g.nodes).toEqual([expect.objectContaining({ id: "r1", kind: "box", label: "API", frameId: null, origin: "human" })]);
});
test("arrow bound at both ends becomes an edge with label and arrowheads", () => {
  // r1, r2 as above; a1 with startBinding r1, endBinding r2, endArrowhead "arrow", bound text "SQL"
  expect(g.edges).toEqual([{ id: "a1", from: "r1", to: "r2", label: "SQL", arrowheads: { start: false, end: true } }]);
});
test("arrow bound to a deleted or missing element has a free end", () => {
  // a1 endBinding points at r9 which has isDeleted true; a2 startBinding points at "nope"
  expect(g.edges.map(e => [e.from, e.to])).toEqual([["r1", null], [null, "r1"]]);
});
test("deleted elements are skipped entirely", ...);          // isDeleted rectangle produces no node
test("frames become frame nodes and children carry frameId", ...);  // frame fr1 name "Backend", rectangle with frameId fr1
test("unbound text, images, freedraw and line are classified", () => {
  // text t1 (containerId null) -> node kind text label from text
  // image img1 fileId "f1", board.files.f1.asset "assets/abc.png" -> node kind image, asset "assets/abc.png"
  // freedraw d1 -> loose draw; line l1 -> loose line
});
test("customData origin ai is carried through", ...);
test("node order follows element order", ...);
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run test/export/boardGraph.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `excalidrawToBoardGraph` in `src/export/boardGraph.ts`**

Rules the tests do not fully determine: skip any element with `isDeleted`; a container's label is the trimmed `text` of its bound text element; kinds map rectangle to box, ellipse to ellipse, diamond to diamond, unbound text to text, image to image, frame to frame; arrows become edges whose `from` and `to` are the binding's `elementId` only when that element exists and is not deleted; `arrowheads.start` is `Boolean(startArrowhead)` and `arrowheads.end` is `Boolean(endArrowhead)`; freedraw becomes loose `draw` and line becomes loose `line`; other types are ignored; `origin` is `"ai"` only when `customData.origin === "ai"`; image `asset` comes from `board.files[fileId].asset`.
Export everything from `src/export/index.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run test/export/boardGraph.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/export test/export/boardGraph.test.ts
git commit -m "feat(export): board schema and Excalidraw to BoardGraph"
```

---

