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

