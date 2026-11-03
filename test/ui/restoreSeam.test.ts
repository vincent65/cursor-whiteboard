// @vitest-environment jsdom
import { restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Proposal } from "../../src/shared/proposals";
import {
  applyProposal,
  type El,
  listBoundArrows,
} from "../../src/ui/board/ghosts";
import { renderNode } from "../../src/ui/board/mermaid";

// The seam BoardView's throughGhosts crosses: ghosts.ts output, then the real
// restore. Two bugs came from it (a zero-size arrow label dropped as
// invisibly small, arrows missing from their targets' boundElements).

// The same canvas and FontFace stubs as mermaid.test.ts.
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

const box = (id: string, x: number): El => ({
  id,
  type: "rectangle",
  x,
  y: 0,
  width: 100,
  height: 50,
  opacity: 100,
  strokeStyle: "solid",
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  groupIds: [],
  boundElements: [{ id: "ab", type: "arrow" }],
});

// Boxes a (0,0) and b (400,0), 100x50, joined by arrow ab.
const connected = (): El[] => [
  box("a", 0),
  box("b", 400),
  {
    ...box("ab", 100),
    type: "arrow",
    y: 25,
    width: 300,
    height: 0,
    boundElements: null,
    points: [
      [0, 0],
      [300, 0],
    ],
    startBinding: { elementId: "a", focus: 0, gap: 1 },
    endBinding: { elementId: "b", focus: 0, gap: 1 },
  },
];

const between: Proposal = {
  id: "p_1",
  board: "b",
  title: null,
  ops: [
    { op: "delete", id: "ab" },
    { op: "add_node", label: "Cache", kind: "box", near: ["a"] },
    { op: "add_arrow", from: "a", to: "$1" },
    { op: "add_arrow", from: "$1", to: "b", label: "reads" },
  ],
  at: "2026-11-02T00:00:00.000Z",
};

test("a between proposal survives the real restore with its label and bindings", () => {
  const node = renderNode("Cache", "box") as unknown as El[];
  const { elements } = applyProposal(
    connected(),
    between,
    new Map([[1, node]]),
    {
      selectedIds: [],
      viewport: { x: 0, y: 0, w: 1000, h: 800 },
    },
  );
  const restored = restoreElements(
    listBoundArrows(elements) as unknown as ExcalidrawElement[],
    null,
    { refreshDimensions: true, repairBindings: true },
  );
  const live = restored.filter((e) => !e.isDeleted);
  const byId = (id: string) => {
    const found = live.find((e) => e.id === id);
    if (!found) throw new Error(`no ${id}`);
    return found;
  };
  const shape = node.find((e) => !e.containerId) as El;
  const [into, out] = live.filter(
    (e) => e.type === "arrow" && e.id !== "ab",
  ) as Extract<ExcalidrawElement, { type: "arrow" }>[];

  expect(into.startBinding?.elementId).toBe("a");
  expect(into.endBinding?.elementId).toBe(shape.id);
  expect(out.startBinding?.elementId).toBe(shape.id);
  expect(out.endBinding?.elementId).toBe("b");

  const label = live.find((e) => e.type === "text" && e.containerId === out.id);
  expect(label).toMatchObject({ text: "reads" });

  const listed = (id: string) =>
    (byId(id).boundElements ?? []).map((b) => b.id);
  expect(listed("a")).toContain(into.id);
  expect(listed("b")).toContain(out.id);
  expect(listed(shape.id)).toEqual(expect.arrayContaining([into.id, out.id]));
});
