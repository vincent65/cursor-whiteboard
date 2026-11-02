import {
  type BoardFile,
  type ExcalidrawElement,
  excalidrawToBoardGraph,
} from "../../src/export/index.js";

function el(overrides: Partial<ExcalidrawElement>): ExcalidrawElement {
  return {
    id: "",
    type: "",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isDeleted: false,
    ...overrides,
  };
}

function board(
  elements: ExcalidrawElement[],
  files: BoardFile["files"] = {},
): BoardFile {
  return { type: "excalidraw", version: 2, elements, appState: {}, files };
}

test("rectangle with bound text becomes a box node with the text as label", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({
        id: "r1",
        type: "rectangle",
        boundElements: [{ id: "t1", type: "text" }],
      }),
      el({ id: "t1", type: "text", text: "API", containerId: "r1" }),
    ]),
    "main",
  );
  expect(g.nodes).toEqual([
    expect.objectContaining({
      id: "r1",
      kind: "box",
      label: "API",
      frameId: null,
      origin: "human",
    }),
  ]);
});

test("text with a live containerId labels the container even without boundElements", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "r1", type: "rectangle" }),
      el({ id: "t1", type: "text", text: "API", containerId: "r1" }),
    ]),
    "main",
  );
  expect(g.nodes).toEqual([
    expect.objectContaining({ id: "r1", kind: "box", label: "API" }),
  ]);
});

test("text listed in boundElements but with no containerId stays a standalone node", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({
        id: "r1",
        type: "rectangle",
        boundElements: [{ id: "t1", type: "text" }],
      }),
      el({ id: "t1", type: "text", text: "API", containerId: null }),
    ]),
    "main",
  );
  expect(g.nodes).toEqual([
    expect.objectContaining({ id: "r1", kind: "box", label: "" }),
    expect.objectContaining({ id: "t1", kind: "text", label: "API" }),
  ]);
});

test("a stale boundElements entry does not borrow another container's text", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({
        id: "r1",
        type: "rectangle",
        boundElements: [{ id: "t2", type: "text" }],
      }),
      el({
        id: "r2",
        type: "rectangle",
        boundElements: [{ id: "t2", type: "text" }],
      }),
      el({ id: "t2", type: "text", text: "DB", containerId: "r2" }),
    ]),
    "main",
  );
  expect(g.nodes.map((n) => [n.id, n.label])).toEqual([
    ["r1", ""],
    ["r2", "DB"],
  ]);
});

test("text whose container is deleted or missing stays a standalone node", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "r9", type: "rectangle", isDeleted: true }),
      el({ id: "t1", type: "text", text: "kept", containerId: "r9" }),
      el({ id: "t2", type: "text", text: "also kept", containerId: "nope" }),
    ]),
    "main",
  );
  expect(g.nodes.map((n) => [n.id, n.kind, n.label])).toEqual([
    ["t1", "text", "kept"],
    ["t2", "text", "also kept"],
  ]);
});

test("arrow bound at both ends becomes an edge with label and arrowheads", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "r1", type: "rectangle" }),
      el({ id: "r2", type: "rectangle" }),
      el({
        id: "a1",
        type: "arrow",
        startBinding: { elementId: "r1" },
        endBinding: { elementId: "r2" },
        startArrowhead: null,
        endArrowhead: "arrow",
        boundElements: [{ id: "t1", type: "text" }],
      }),
      el({ id: "t1", type: "text", text: "SQL", containerId: "a1" }),
    ]),
    "main",
  );
  expect(g.edges).toEqual([
    {
      id: "a1",
      from: "r1",
      to: "r2",
      label: "SQL",
      arrowheads: { start: false, end: true },
    },
  ]);
});

test("arrow bound to a deleted or missing element has a free end", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "r1", type: "rectangle" }),
      el({ id: "r9", type: "rectangle", isDeleted: true }),
      el({
        id: "a1",
        type: "arrow",
        startBinding: { elementId: "r1" },
        endBinding: { elementId: "r9" },
      }),
      el({
        id: "a2",
        type: "arrow",
        startBinding: { elementId: "nope" },
        endBinding: { elementId: "r1" },
      }),
    ]),
    "main",
  );
  expect(g.edges.map((e) => [e.from, e.to])).toEqual([
    ["r1", null],
    [null, "r1"],
  ]);
});

test("deleted elements are skipped entirely", () => {
  const g = excalidrawToBoardGraph(
    board([el({ id: "r1", type: "rectangle", isDeleted: true })]),
    "main",
  );
  expect(g).toEqual({ board: "main", nodes: [], edges: [], loose: [] });
});

test("frames become frame nodes and children carry frameId", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "fr1", type: "frame", name: "Backend" }),
      el({ id: "r1", type: "rectangle", frameId: "fr1" }),
    ]),
    "main",
  );
  expect(g.nodes).toEqual([
    expect.objectContaining({
      id: "fr1",
      kind: "frame",
      label: "Backend",
      frameId: null,
    }),
    expect.objectContaining({ id: "r1", kind: "box", frameId: "fr1" }),
  ]);
});

test("unbound text, images, freedraw and line are classified", () => {
  const g = excalidrawToBoardGraph(
    board(
      [
        el({ id: "t1", type: "text", text: "note", containerId: null }),
        el({ id: "img1", type: "image", fileId: "f1" }),
        el({ id: "d1", type: "freedraw" }),
        el({ id: "l1", type: "line" }),
      ],
      {
        f1: {
          id: "f1",
          mimeType: "image/png",
          created: 0,
          asset: "assets/abc.png",
        },
      },
    ),
    "main",
  );
  expect(g.nodes).toEqual([
    expect.objectContaining({ id: "t1", kind: "text", label: "note" }),
    expect.objectContaining({
      id: "img1",
      kind: "image",
      asset: "assets/abc.png",
    }),
  ]);
  expect(g.loose).toEqual([
    { id: "d1", kind: "draw" },
    { id: "l1", kind: "line" },
  ]);
});

test("customData origin ai is carried through", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "r1", type: "rectangle", customData: { origin: "ai" } }),
      el({ id: "r2", type: "rectangle", customData: { origin: "other" } }),
    ]),
    "main",
  );
  expect(g.nodes.map((n) => n.origin)).toEqual(["ai", "human"]);
});

test("node order follows element order", () => {
  const g = excalidrawToBoardGraph(
    board([
      el({ id: "e1", type: "ellipse" }),
      el({ id: "d1", type: "diamond" }),
      el({ id: "r1", type: "rectangle" }),
    ]),
    "main",
  );
  expect(g.nodes.map((n) => [n.id, n.kind])).toEqual([
    ["e1", "ellipse"],
    ["d1", "diamond"],
    ["r1", "box"],
  ]);
});
