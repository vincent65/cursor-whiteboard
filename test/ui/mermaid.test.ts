// @vitest-environment jsdom
import {
  renderMermaid,
  renderNode,
  renderNote,
  SUPPORTED,
} from "../../src/ui/board/mermaid";

// The importer measures labels on a canvas; jsdom has none, so stub measureText by character count.
// Excalidraw's font registry also constructs a FontFace per font, which jsdom lacks.
beforeAll(() => {
  globalThis.FontFace = class {} as never;
  HTMLCanvasElement.prototype.getContext = (() => ({
    font: "",
    measureText: (t: string) => ({
      width: t.length * 10,
      actualBoundingBoxAscent: 16,
      actualBoundingBoxDescent: 4,
    }),
  })) as never;
});

test("a flowchart becomes shapes, labels, and bound arrows with fresh ids", async () => {
  const els = await renderMermaid(
    "flowchart LR\n  A[Login] --> B{Valid?}\n  B -->|yes| C[Home]",
  );
  const types = els.map((e) => e.type);
  expect(types).toEqual(
    expect.arrayContaining(["rectangle", "diamond", "arrow", "text"]),
  );
  expect(els.every((e) => !["A", "B", "C", "A_B"].includes(e.id))).toBe(true);
  const arrow = els.find((e) => e.type === "arrow") as {
    startBinding: { elementId: string } | null;
  };
  expect(els.some((e) => e.id === arrow.startBinding?.elementId)).toBe(true);
});

test("a parse error propagates with the importer's message", async () => {
  await expect(renderMermaid("flowchart LR\n  A --> ")).rejects.toThrow(
    /Parse error/,
  );
});

test("a diagram the importer draws as an image is rejected", async () => {
  await expect(renderMermaid('pie\n  "a": 1\n  "b": 2')).rejects.toThrow(
    SUPPORTED,
  );
});

test("a note is one measured text element", () => {
  const [note] = renderNote("Cache lives here");
  expect(note.type).toBe("text");
  expect(note.width).toBeGreaterThan(0);
});

test("renderNode makes a shape with a bound label", () => {
  for (const [kind, type] of [
    ["box", "rectangle"],
    ["ellipse", "ellipse"],
    ["diamond", "diamond"],
  ] as const) {
    const els = renderNode("Cache", kind);
    expect(els).toHaveLength(2);
    const [shape, label] = els;
    expect(shape.type).toBe(type);
    expect(label).toMatchObject({ type: "text", containerId: shape.id });
    expect((label as { originalText: string }).originalText).toBe("Cache");
    expect(shape.boundElements).toEqual([{ type: "text", id: label.id }]);
    expect(shape.width).toBeGreaterThan(0);
  }
  expect(renderNode("x", "box")[0].id).not.toBe(renderNode("x", "box")[0].id);
});
