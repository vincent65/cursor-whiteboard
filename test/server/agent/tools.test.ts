import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import {
  type BoardFile,
  type BoardGraph,
  type ExcalidrawElement,
  excalidrawToBoardGraph,
} from "../../../src/export/index.js";
import {
  createBoardTools,
  selectionGraph,
} from "../../../src/server/agent/tools.js";
import { type FileStore, NotFoundError } from "../../../src/server/files.js";

const el = (o: Partial<ExcalidrawElement>): ExcalidrawElement => ({
  id: "",
  type: "",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  isDeleted: false,
  ...o,
});

// Login -> Home, plus a lone Notes box and a freehand stroke.
const flow: BoardFile = {
  type: "excalidraw",
  version: 2,
  appState: {},
  files: {},
  elements: [
    el({
      id: "a",
      type: "rectangle",
      boundElements: [{ id: "ta", type: "text" }],
    }),
    el({ id: "ta", type: "text", text: "Login", containerId: "a" }),
    el({
      id: "b",
      type: "rectangle",
      boundElements: [{ id: "tb", type: "text" }],
    }),
    el({ id: "tb", type: "text", text: "Home", containerId: "b" }),
    el({
      id: "e",
      type: "arrow",
      startBinding: { elementId: "a" },
      endBinding: { elementId: "b" },
      endArrowhead: "arrow",
    }),
    el({
      id: "c",
      type: "rectangle",
      boundElements: [{ id: "tc", type: "text" }],
    }),
    el({ id: "tc", type: "text", text: "Notes", containerId: "c" }),
    el({ id: "d", type: "freedraw" }),
  ],
};
const empty: BoardFile = { ...flow, elements: [] };
const boards: Record<string, BoardFile> = { flow, zeta: empty };

const store = {
  readBoard: vi.fn(async (name: string) => {
    if (!boards[name]) throw new NotFoundError(`board ${name} not found`);
    return boards[name];
  }),
  listBoards: vi.fn(async () =>
    Object.keys(boards).map((name) => ({ name, updatedAt: "" })),
  ),
} as unknown as FileStore;

const PNG = "data:image/png;base64,iVBORw0KGgo=";

type Handler = (
  args: unknown,
  extra: unknown,
) => ReturnType<SdkMcpToolDefinition["handler"]>;

function setup(activeBoard: string | null = "flow") {
  const hub = { request: vi.fn(), activeBoard };
  const server = createBoardTools({ store, hub });
  // The SDK only exposes the live McpServer, whose registry is private.
  const tools = (
    server.instance as unknown as {
      _registeredTools: Record<string, { handler: Handler }>;
    }
  )._registeredTools;
  const call = (name: string, args: unknown) => tools[name].handler(args, {});
  return { hub, server, tools, call };
}

test("get_board returns markdown and the PNG from the browser, or a note when the browser fails", async () => {
  const { hub, server, tools, call } = setup();
  expect(server.name).toBe("blueprint");
  expect(Object.keys(tools).sort()).toEqual(["get_board", "get_selection"]);

  hub.request.mockResolvedValueOnce({ png: PNG });
  const ok = await call("get_board", {});
  expect(hub.request).toHaveBeenCalledWith({
    kind: "board.png",
    board: "flow",
  });
  expect(ok.content).toEqual([
    { type: "text", text: expect.stringContaining("# Board: flow") },
    { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
  ]);
  expect(ok.content[0]).toMatchObject({
    text: expect.stringContaining("Login"),
  });

  hub.request.mockRejectedValueOnce(new Error("no browser tab is connected"));
  const failed = await call("get_board", { board: "zeta" });
  expect(hub.request).toHaveBeenLastCalledWith({
    kind: "board.png",
    board: "zeta",
  });
  expect(failed.content).toHaveLength(1);
  const text = (failed.content[0] as { text: string }).text;
  expect(text).toMatch(/^# Board: zeta/);
  expect(text).toMatch(/\(No PNG: no browser tab is connected\)$/);
});

test("get_board fails clearly when there are no boards or the board is unknown", async () => {
  const { hub, call } = setup();
  vi.mocked(store.listBoards).mockResolvedValueOnce([]);
  await expect(call("get_board", {})).rejects.toThrow(
    "there are no boards yet",
  );
  await expect(call("get_board", { board: "nope" })).rejects.toThrow(
    "board nope not found",
  );
  expect(hub.request).not.toHaveBeenCalled();
});

test("get_board notes a malformed PNG data URL instead of sending a broken image", async () => {
  const { hub, call } = setup();
  hub.request.mockResolvedValueOnce({ png: "not a data url" });
  const result = await call("get_board", { board: "flow" });
  expect(result.content).toEqual([
    {
      type: "text",
      text: expect.stringMatching(/\(No PNG: malformed PNG data URL\)$/),
    },
  ]);
});

test("get_selection returns nothing-selected text, or the filtered graph markdown with the crop", async () => {
  const { hub, call } = setup();
  hub.request.mockResolvedValueOnce({ ids: [], png: null });
  const none = await call("get_selection", {});
  expect(hub.request).toHaveBeenCalledWith({ kind: "selection.snapshot" });
  expect(none.content).toEqual([
    { type: "text", text: "Nothing is selected on the board." },
  ]);

  hub.request.mockResolvedValueOnce({ ids: ["a", "b"], png: PNG });
  const picked = await call("get_selection", {});
  expect(picked.content).toEqual([
    { type: "text", text: expect.stringContaining("# Board: flow") },
    { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
  ]);
  const md = (picked.content[0] as { text: string }).text;
  expect(md).toContain("Login");
  expect(md).toContain("Home");
  expect(md).not.toContain("Notes");

  // Only a shape's bound label text: nothing in the graph is selected.
  hub.request.mockResolvedValueOnce({ ids: ["ta"], png: PNG });
  const labelOnly = await call("get_selection", {});
  expect(labelOnly.content).toEqual([
    { type: "text", text: "Nothing is selected on the board." },
  ]);

  hub.request.mockResolvedValueOnce({ ids: ["c"], png: null });
  const noCrop = await call("get_selection", {});
  expect(noCrop.content).toEqual([
    { type: "text", text: expect.stringContaining("Notes") },
  ]);
});

test("selectionGraph keeps only selected nodes, edges between them, and selected loose items", () => {
  const graph: BoardGraph = excalidrawToBoardGraph(flow, "flow");
  const ids = (g: BoardGraph) => ({
    nodes: g.nodes.map((n) => n.id),
    edges: g.edges.map((e) => [e.id, e.from, e.to]),
    loose: g.loose.map((l) => l.id),
  });

  // An unselected arrow between two selected boxes comes along.
  expect(ids(selectionGraph(graph, ["a", "b", "d"]))).toEqual({
    nodes: ["a", "b"],
    edges: [["e", "a", "b"]],
    loose: ["d"],
  });
  // A selected arrow keeps only the ends that are selected too.
  expect(ids(selectionGraph(graph, ["a", "e"]))).toEqual({
    nodes: ["a"],
    edges: [["e", "a", null]],
    loose: [],
  });
  expect(ids(selectionGraph(graph, ["c"]))).toEqual({
    nodes: ["c"],
    edges: [],
    loose: [],
  });
  expect(selectionGraph(graph, []).board).toBe("flow");
});
