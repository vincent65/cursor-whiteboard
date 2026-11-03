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

// An update ghost already shows its new label; the board reads the old one until it is accepted.
function labelBefore(e: ExcalidrawElement): string | undefined {
  const c = e.customData;
  const before = c?.ghost === "update" ? c.before : undefined;
  const label = (before as { label?: unknown } | undefined)?.label;
  return typeof label === "string" ? label.trim() : undefined;
}

export function excalidrawToBoardGraph(
  board: BoardFile,
  boardName: string,
): BoardGraph {
  // Pending proposals are not fact: add ghosts (with their labels) are left
  // out, update ghosts read as before, and delete ghosts stay until accepted.
  const added = new Set(
    board.elements
      .filter((e) => e.customData?.ghost === "add")
      .map((e) => e.id),
  );
  const live = board.elements.filter(
    (e) =>
      !e.isDeleted &&
      !added.has(e.id) &&
      !(e.containerId && added.has(e.containerId)),
  );
  const byId = new Map(live.map((e) => [e.id, e]));
  const graph: BoardGraph = {
    board: boardName,
    nodes: [],
    edges: [],
    loose: [],
  };

  // A text's own containerId is the single source of truth for bindings;
  // the container's boundElements may be stale or one-sided.
  const textByContainer = new Map<string, ExcalidrawElement>();
  for (const e of live) {
    if (
      e.type === "text" &&
      e.containerId &&
      byId.has(e.containerId) &&
      !textByContainer.has(e.containerId)
    ) {
      textByContainer.set(e.containerId, e);
    }
  }
  const boundText = (e: ExcalidrawElement): string =>
    textByContainer.get(e.id)?.text?.trim() ?? "";
  const liveId = (id: string | undefined): string | null =>
    id !== undefined && byId.has(id) ? id : null;

  for (const e of live) {
    if (e.type === "arrow") {
      graph.edges.push({
        id: e.id,
        from: liveId(e.startBinding?.elementId),
        to: liveId(e.endBinding?.elementId),
        label: labelBefore(e) ?? boundText(e),
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
    if (!kind || (e.containerId && textByContainer.get(e.containerId) === e)) {
      continue;
    }
    const node: BoardNode = {
      id: e.id,
      kind,
      label:
        labelBefore(e) ??
        (kind === "text"
          ? (e.text?.trim() ?? "")
          : kind === "frame"
            ? (e.name ?? "")
            : boundText(e)),
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
