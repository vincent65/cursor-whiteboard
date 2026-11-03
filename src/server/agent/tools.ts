import {
  createSdkMcpServer,
  type McpSdkServerConfigWithInstance,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  type BoardFile,
  type BoardGraph,
  boardGraphToMarkdown,
  excalidrawToBoardGraph,
} from "../../export/index.js";
import {
  checkRefs,
  type Op,
  type Proposal,
  Propose,
  Revise,
  referencedIds,
} from "../../shared/proposals.js";
import { type FileStore, NotFoundError } from "../files.js";
import type { WsHub } from "../ws.js";
import type { ProposalStore } from "./proposals.js";

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

// The board as it stands without pending additions; Claude learns of those from the pending line.
function withoutAddGhosts(file: BoardFile): BoardFile {
  const elements = file.elements.filter((e) => e.customData?.ghost !== "add");
  return { ...file, elements };
}

export function createBoardTools(deps: {
  store: FileStore;
  hub: Pick<WsHub, "request" | "activeBoard">;
  proposals: ProposalStore;
}): McpSdkServerConfigWithInstance {
  const { store, hub, proposals } = deps;
  const graphOf = async (board: string) =>
    excalidrawToBoardGraph(
      withoutAddGhosts(await store.readBoard(board)),
      board,
    );
  const withPending = (text: string, board: string) => {
    const pending = proposals.pending().filter((p) => p.board === board);
    if (pending.length === 0) return text;
    const list = pending.map(
      (p) => `${p.id} (${p.ops.length} op${p.ops.length === 1 ? "" : "s"})`,
    );
    return `${text}\n\nPending proposals on this board: ${list.join(", ")}`;
  };

  const openBoard = (): string => {
    if (hub.activeBoard === null)
      throw new Error("open a board in the browser first");
    return hub.activeBoard;
  };
  // Add ghosts are not on the board yet, so ops cannot point at them (the reads hide them too).
  const checkIds = async (board: string, ops: Op[]) => {
    const live = new Set(
      withoutAddGhosts(await store.readBoard(board))
        .elements.filter((e) => !e.isDeleted)
        .map((e) => e.id),
    );
    const unknown = referencedIds(ops).find((id) => !live.has(id));
    if (unknown !== undefined) throw new Error(`unknown element id ${unknown}`);
  };
  // The browser draws the ghosts before anything is logged, so a proposal it
  // cannot draw (say, a Mermaid parse error) fails the tool and leaves no trace.
  const apply = (proposal: Proposal, replace: boolean) =>
    hub.request<{ elementIds: string[] }>(
      { kind: "proposal.apply", proposal, replace },
      { timeoutMs: 30_000 },
    );
  const answer = (p: Proposal) => ({
    content: [
      { type: "text" as const, text: JSON.stringify({ proposalId: p.id }) },
    ],
  });

  const getBoard = tool(
    "get_board",
    "Read a Blueprint board as Markdown (a Mermaid diagram plus a list of other elements) and a PNG of it. Defaults to the first board by name.",
    { board: z.string().optional().describe("Board name, e.g. main") },
    async (args) => {
      const board = args.board ?? (await store.listBoards())[0]?.name;
      if (!board) throw new Error("there are no boards yet");
      const text = withPending(
        boardGraphToMarkdown(await graphOf(board)),
        board,
      );
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
      // No board open (a doc or the sidebar only): nothing can be selected, so don't ask.
      const board = hub.activeBoard;
      const nothingText = "Nothing is selected on the board.";
      const nothing = {
        content: [
          {
            type: "text" as const,
            text:
              board === null ? nothingText : withPending(nothingText, board),
          },
        ],
      };
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
      const text = withPending(boardGraphToMarkdown(graph), board);
      const content: Content[] = [{ type: "text", text }];
      if (snap.png) content.push(image(snap.png));
      return { content };
    },
  );

  const propose = tool(
    "propose",
    "Propose changes to the open board. They appear as ghosts the user accepts or rejects; nothing is real until accepted. Returns the proposal id.",
    Propose.shape,
    async (args) => {
      const board = openBoard();
      checkRefs(args.ops);
      await checkIds(board, args.ops);
      const p: Proposal = {
        id: proposals.newId(),
        board,
        title: args.title ?? null,
        ops: args.ops,
        at: new Date().toISOString(),
      };
      await apply(p, false);
      await proposals.proposed(p);
      return answer(p);
    },
  );

  const revise = tool(
    "revise",
    "Replace every ghost of a pending proposal with a complete new op list, and its title if one is given. Returns the proposal id.",
    Revise.shape,
    async (args) => {
      const board = openBoard();
      const prev = proposals.get(args.proposalId);
      if (!prev)
        throw new NotFoundError(`proposal ${args.proposalId} is not pending`);
      // Its ghosts live on its own board; a revision must never redraw them elsewhere.
      if (prev.board !== board)
        throw new Error(
          `proposal ${prev.id} belongs to board ${prev.board}, which is not open`,
        );
      // A decision arriving mid revise is refused rather than racing the id check or redraw.
      await proposals.beginRevise(prev.id);
      try {
        checkRefs(args.ops);
        await checkIds(board, args.ops);
        const p: Proposal = {
          ...prev,
          title: args.title ?? prev.title,
          ops: args.ops,
          at: new Date().toISOString(),
        };
        await apply(p, true);
        await proposals.revised(p);
        return answer(p);
      } finally {
        proposals.endRevise(prev.id);
      }
    },
  );

  return createSdkMcpServer({
    name: "blueprint",
    tools: [getBoard, getSelection, propose, revise],
  });
}
