// @vitest-environment jsdom
// Before Excalidraw, which needs a canvas as it loads.
import "./canvasStub";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import {
  renderMermaid,
  renderNode,
  renderNote,
  SUPPORTED,
} from "../../src/ui/board/mermaid";

// The real importer, wrapped so one test can reshape its answer.
vi.mock("@excalidraw/mermaid-to-excalidraw", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@excalidraw/mermaid-to-excalidraw")>();
  return {
    ...real,
    parseMermaidToExcalidraw: vi.fn(real.parseMermaidToExcalidraw),
  };
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

test("an empty files object is not an image diagram", async () => {
  const parse = vi.mocked(parseMermaidToExcalidraw);
  const real = parse.getMockImplementation() as typeof parseMermaidToExcalidraw;
  parse.mockImplementationOnce(async (definition, config) => ({
    ...(await real(definition, config)),
    files: {},
  }));
  const els = await renderMermaid("flowchart LR\n  A --> B");
  expect(els.some((e) => e.type === "arrow")).toBe(true);
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

// Sized to the label alone, a box's border touched its text; a drawn box has room.
test("renderNode leaves room around its label", () => {
  for (const kind of ["box", "ellipse", "diamond"] as const) {
    const [snug] = convertToExcalidrawElements(
      [
        {
          type: kind === "box" ? "rectangle" : kind,
          x: 0,
          y: 0,
          label: { text: "Read notes.json" },
        },
      ],
      { regenerateIds: true },
    );
    const [shape, label] = renderNode("Read notes.json", kind);
    expect(shape.width).toBe(snug.width + 40);
    expect(shape.height).toBe(snug.height + 30);
    expect((label as { text: string }).text).toBe("Read notes.json");
  }
});
