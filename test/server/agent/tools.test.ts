import type { SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import {
  type BoardFile,
  type BoardGraph,
  type ExcalidrawElement,
  excalidrawToBoardGraph,
} from "../../../src/export/index.js";
import { ProposalStore } from "../../../src/server/agent/proposals.js";
import {
  createBoardTools,
  selectionGraph,
} from "../../../src/server/agent/tools.js";
import { type FileStore, NotFoundError } from "../../../src/server/files.js";
import type {
  Op,
  Proposal,
  ProposalLogEntry,
} from "../../../src/shared/proposals.js";

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
// A human box beside an add ghost, whose label is tagged like the box.
const ghost = { origin: "ai", proposalId: "p_1", ghost: "add" };
const ghosted: BoardFile = {
  ...flow,
  elements: [
    flow.elements[0],
    flow.elements[1],
    el({
      id: "g",
      type: "rectangle",
      boundElements: [{ id: "tg", type: "text" }],
      customData: ghost,
    }),
    el({
      id: "tg",
      type: "text",
      text: "Cache",
      containerId: "g",
      customData: ghost,
    }),
  ],
};
const boards: Record<string, BoardFile> = { flow, zeta: empty, ghosted };

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
  const log: ProposalLogEntry[] = [];
  const proposals = new ProposalStore({
    appendProposal: async (entry) => {
      log.push(entry);
    },
    readProposals: async () => [...log],
  });
  const server = createBoardTools({ store, hub, proposals });
  // The SDK only exposes the live McpServer, whose registry is private.
  const tools = (
    server.instance as unknown as {
      _registeredTools: Record<string, { handler: Handler }>;
    }
  )._registeredTools;
  const call = (name: string, args: unknown) => tools[name].handler(args, {});
  return { hub, server, tools, call, proposals, log };
}

const ops: Op[] = [
  { op: "add_diagram", mermaid: "flowchart LR\n  A --> B", near: ["a"] },
  { op: "update", id: "b", label: "Dashboard" },
];
const pending = (id: string, board = "flow"): Proposal => ({
  id,
  board,
  title: "Cache",
  ops,
  at: "2026-11-02T00:00:00.000Z",
});
const resultId = (result: Awaited<ReturnType<Handler>>) =>
  JSON.parse((result.content[0] as { text: string }).text).proposalId;

test("get_board returns markdown and the PNG from the browser, or a note when the browser fails", async () => {
  const { hub, server, tools, call } = setup();
  expect(server.name).toBe("blueprint");
  expect(Object.keys(tools).sort()).toEqual([
    "get_board",
    "get_selection",
    "propose",
    "revise",
  ]);

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

  hub.activeBoard = "zeta";
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

test("get_board asks for a PNG only when the board is the one open in the tab", async () => {
  for (const activeBoard of [null, "flow"]) {
    const { hub, call } = setup(activeBoard);
    const result = await call("get_board", { board: "zeta" });
    expect(hub.request).not.toHaveBeenCalled();
    expect(result.content).toEqual([
      {
        type: "text",
        text: expect.stringMatching(
          /^# Board: zeta[\s\S]*\(No PNG: board zeta is not open\)$/,
        ),
      },
    ]);
  }
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

test("get_selection answers nothing-selected without asking the browser when no board is open", async () => {
  const { hub, call } = setup(null);
  const result = await call("get_selection", {});
  expect(hub.request).not.toHaveBeenCalled();
  expect(result.content).toEqual([
    { type: "text", text: "Nothing is selected on the board." },
  ]);
});

test("propose validates ids against the stored board and logs nothing on failure", async () => {
  const { hub, call, proposals, log } = setup();
  await expect(
    call("propose", { ops: [{ op: "update", id: "zzz", label: "x" }] }),
  ).rejects.toThrow("unknown element id zzz");
  await expect(
    call("propose", { ops: [{ op: "add_note", text: "x", near: ["a", "q"] }] }),
  ).rejects.toThrow("unknown element id q");
  expect(hub.request).not.toHaveBeenCalled();
  expect(log).toEqual([]);
  expect(proposals.pending()).toEqual([]);
});

test("propose rejects ids of deleted elements", async () => {
  boards.gone = { ...flow, elements: [el({ id: "a", isDeleted: true })] };
  const { hub, call } = setup("gone");
  await expect(
    call("propose", { ops: [{ op: "delete", id: "a" }] }),
  ).rejects.toThrow("unknown element id a");
  expect(hub.request).not.toHaveBeenCalled();
  delete boards.gone;
});

test("propose round-trips to the browser, logs, and returns the proposal id", async () => {
  const { hub, call, proposals, log } = setup();
  hub.request.mockResolvedValueOnce({ elementIds: ["g1"] });
  const result = await call("propose", { title: "Cache", ops });
  const id = resultId(result);
  expect(id).toMatch(/^p_[0-9a-f]{8}$/);
  expect(hub.request).toHaveBeenCalledTimes(1);
  const [body, opts] = hub.request.mock.calls[0];
  expect(body).toMatchObject({ kind: "proposal.apply", replace: false });
  expect(body.proposal).toMatchObject({ id, board: "flow", title: "Cache" });
  expect(body.proposal.ops).toBe(ops);
  expect(opts).toEqual({ timeoutMs: 30_000 });
  expect(proposals.pending()).toEqual([body.proposal]);
  expect(log.map((e) => e.event)).toEqual(["proposed"]);

  // No title: null, not undefined.
  hub.request.mockResolvedValueOnce({ elementIds: ["g2"] });
  const untitled = await call("propose", { ops });
  expect(proposals.get(resultId(untitled))?.title).toBeNull();
});

test("a browser failure becomes the tool error and leaves nothing pending", async () => {
  const { hub, call, proposals, log } = setup();
  hub.request.mockRejectedValueOnce(new Error("Parse error on line 2"));
  await expect(call("propose", { ops })).rejects.toThrow(
    "Parse error on line 2",
  );
  expect(proposals.pending()).toEqual([]);
  expect(log).toEqual([]);
});

test("revise requires a pending proposal and replaces in place", async () => {
  const { hub, call, proposals, log } = setup();
  await expect(call("revise", { proposalId: "p_9", ops })).rejects.toThrow(
    "proposal p_9 is not pending",
  );
  await expect(
    call("revise", { proposalId: "p_9", ops }),
  ).rejects.toBeInstanceOf(NotFoundError);

  await proposals.proposed(pending("p_1"));
  const newOps: Op[] = [{ op: "delete", id: "c" }];
  hub.request.mockResolvedValueOnce({ elementIds: ["c"] });
  const result = await call("revise", { proposalId: "p_1", ops: newOps });
  expect(resultId(result)).toBe("p_1");
  const [body, opts] = hub.request.mock.calls[0];
  expect(body).toMatchObject({ kind: "proposal.apply", replace: true });
  expect(body.proposal).toMatchObject({
    id: "p_1",
    board: "flow",
    title: "Cache",
    ops: newOps,
  });
  expect(opts).toEqual({ timeoutMs: 30_000 });
  expect(log.map((e) => e.event)).toEqual(["proposed", "revised"]);
  expect(proposals.get("p_1")?.ops).toEqual(newOps);
});

test("revise refuses a proposal whose board is not the open one", async () => {
  const { hub, call, proposals, log } = setup();
  await proposals.proposed(pending("p_1", "zeta"));
  await expect(call("revise", { proposalId: "p_1", ops })).rejects.toThrow(
    "proposal p_1 belongs to board zeta, which is not open",
  );
  expect(hub.request).not.toHaveBeenCalled();
  expect(log.map((e) => e.event)).toEqual(["proposed"]);
});

test("revise keeps the pending record when the browser fails", async () => {
  const { hub, call, proposals, log } = setup();
  await proposals.proposed(pending("p_1"));
  hub.request.mockRejectedValueOnce(new Error("Parse error on line 2"));
  await expect(
    call("revise", { proposalId: "p_1", ops: [{ op: "delete", id: "c" }] }),
  ).rejects.toThrow("Parse error on line 2");
  expect(proposals.get("p_1")?.ops).toBe(ops);
  expect(log.map((e) => e.event)).toEqual(["proposed"]);
});

test("propose without an open board fails fast", async () => {
  const { hub, call } = setup(null);
  await expect(call("propose", { ops })).rejects.toThrow(
    "open a board in the browser first",
  );
  await expect(call("revise", { proposalId: "p_1", ops })).rejects.toThrow(
    "open a board in the browser first",
  );
  expect(hub.request).not.toHaveBeenCalled();
});

test("board reads hide add ghosts and list pending proposals", async () => {
  const { hub, call, proposals } = setup("ghosted");
  // Before anything is pending, no line at all.
  hub.request.mockResolvedValueOnce({ png: PNG });
  const before = await call("get_board", { board: "ghosted" });
  expect((before.content[0] as { text: string }).text).not.toContain(
    "Pending proposals",
  );

  await proposals.proposed(pending("p_1", "ghosted"));
  await proposals.proposed({
    ...pending("p_2", "ghosted"),
    ops: [{ op: "delete", id: "a" }],
  });
  hub.request.mockResolvedValueOnce({ png: PNG });
  const board = await call("get_board", { board: "ghosted" });
  const text = (board.content[0] as { text: string }).text;
  expect(text).toContain("Login");
  expect(text).not.toContain("Cache");
  expect(text).toMatch(/\n\nPending proposals: p_1 \(2 ops\), p_2 \(1 op\)$/);

  hub.request.mockResolvedValueOnce({ ids: ["a", "g"], png: null });
  const selection = await call("get_selection", {});
  const selected = (selection.content[0] as { text: string }).text;
  expect(selected).toContain("Login");
  expect(selected).not.toContain("Cache");
  expect(selected).toMatch(/Pending proposals: p_1 \(2 ops\), p_2 \(1 op\)$/);
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
