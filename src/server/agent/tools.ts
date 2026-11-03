import {
  createSdkMcpServer,
  type McpSdkServerConfigWithInstance,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  type BoardGraph,
  boardGraphToMarkdown,
  excalidrawToBoardGraph,
} from "../../export/index.js";
import type { FileStore } from "../files.js";
import type { WsHub } from "../ws.js";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export function selectionGraph(graph: BoardGraph, ids: string[]): BoardGraph {
  const picked = new Set(ids);
  const keep = (id: string | null) =>
    id !== null && picked.has(id) ? id : null;
  return {
    board: graph.board,
    nodes: graph.nodes.filter((n) => picked.has(n.id)),
    // A selected arrow, or an unselected one whose both ends are selected.
    edges: graph.edges
      .filter(
        (e) =>
          picked.has(e.id) || (keep(e.from) !== null && keep(e.to) !== null),
      )
      .map((e) => ({ ...e, from: keep(e.from), to: keep(e.to) })),
    loose: graph.loose.filter((l) => picked.has(l.id)),
  };
}

// "data:image/png;base64,AAAA" -> an MCP image block.
function image(dataUrl: string): Content {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0)
    throw new Error("malformed PNG data URL");
  const mimeType = dataUrl.slice(5, comma).split(";")[0];
  return { type: "image", data: dataUrl.slice(comma + 1), mimeType };
}

export function createBoardTools(deps: {
  store: FileStore;
  hub: Pick<WsHub, "request" | "activeBoard">;
}): McpSdkServerConfigWithInstance {
  const { store, hub } = deps;
  const graphOf = async (board: string) =>
    excalidrawToBoardGraph(await store.readBoard(board), board);

  const getBoard = tool(
    "get_board",
    "Read a Blueprint board as Markdown (a Mermaid diagram plus a list of other elements) and a PNG of it. Defaults to the first board by name.",
    { board: z.string().optional().describe("Board name, e.g. main") },
    async (args) => {
      const board = args.board ?? (await store.listBoards())[0]?.name;
      if (!board) throw new Error("there are no boards yet");
      const text = boardGraphToMarkdown(await graphOf(board));
      // Only a tab showing this board can render it; anything else would wait out the timeout.
      if (hub.activeBoard !== board) {
        const note = `(No PNG: board ${board} is not open)`;
        return { content: [{ type: "text", text: `${text}\n${note}` }] };
      }
      try {
        const { png } = await hub.request<{ png: string }>({
          kind: "board.png",
          board,
        });
        return { content: [{ type: "text", text }, image(png)] };
      } catch (err) {
        const note = `(No PNG: ${(err as Error).message})`;
        return { content: [{ type: "text", text: `${text}\n${note}` }] };
      }
    },
  );

  const getSelection = tool(
    "get_selection",
    "Read the elements the user has selected on the open board, as Markdown plus a PNG crop of them.",
    {},
    async () => {
      const nothing = {
        content: [
          { type: "text" as const, text: "Nothing is selected on the board." },
        ],
      };
      // No board open (a doc or the sidebar only): nothing can be selected, so don't ask.
      const board = hub.activeBoard;
      if (board === null) return nothing;
      const snap = await hub.request<{ ids: string[]; png: string | null }>({
        kind: "selection.snapshot",
      });
      const graph =
        snap.ids.length === 0
          ? null
          : selectionGraph(await graphOf(board), snap.ids);
      // Ids outside the graph (e.g. only a shape's bound label text) select nothing.
      if (!graph || (graph.nodes.length === 0 && graph.edges.length === 0))
        return nothing;
      const text = boardGraphToMarkdown(graph);
      const content: Content[] = [{ type: "text", text }];
      if (snap.png) content.push(image(snap.png));
      return { content };
    },
  );

  return createSdkMcpServer({
    name: "blueprint",
    tools: [getBoard, getSelection],
  });
}
