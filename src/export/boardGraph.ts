import type {
  BoardFile,
  BoardGraph,
  BoardNode,
  ExcalidrawElement,
} from "./schema.js";

const NODE_KINDS: Partial<Record<string, BoardNode["kind"]>> = {
  rectangle: "box",
  ellipse: "ellipse",
  diamond: "diamond",
  text: "text",
  image: "image",
  frame: "frame",
};

const LOOSE_KINDS = { freedraw: "draw", line: "line" } as const;

export function excalidrawToBoardGraph(
  board: BoardFile,
  boardName: string,
): BoardGraph {
  const live = board.elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const graph: BoardGraph = {
    board: boardName,
    nodes: [],
    edges: [],
    loose: [],
  };

  const boundText = (e: ExcalidrawElement): string => {
    const ref = e.boundElements?.find((b) => b.type === "text");
    return (ref && byId.get(ref.id)?.text?.trim()) ?? "";
  };
  const liveId = (id: string | undefined): string | null =>
    id !== undefined && byId.has(id) ? id : null;

  for (const e of live) {
    if (e.type === "arrow") {
      graph.edges.push({
        id: e.id,
        from: liveId(e.startBinding?.elementId),
        to: liveId(e.endBinding?.elementId),
        label: boundText(e),
        arrowheads: {
          start: Boolean(e.startArrowhead),
          end: Boolean(e.endArrowhead),
        },
      });
      continue;
    }
    if (e.type === "freedraw" || e.type === "line") {
      graph.loose.push({ id: e.id, kind: LOOSE_KINDS[e.type] });
      continue;
    }
    const kind = NODE_KINDS[e.type];
    // Text bound to a live container is that container's label, not a node.
    if (!kind || (kind === "text" && liveId(e.containerId ?? undefined))) {
      continue;
    }
    const node: BoardNode = {
      id: e.id,
      kind,
      label:
        kind === "text"
          ? (e.text?.trim() ?? "")
          : kind === "frame"
            ? (e.name ?? "")
            : boundText(e),
      frameId: e.frameId ?? null,
      bounds: { x: e.x, y: e.y, w: e.width, h: e.height },
      origin: e.customData?.origin === "ai" ? "ai" : "human",
    };
    const asset = e.fileId ? board.files[e.fileId]?.asset : undefined;
    if (asset !== undefined) node.asset = asset;
    graph.nodes.push(node);
  }
  return graph;
}
