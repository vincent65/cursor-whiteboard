import type { BoardGraph, BoardNode } from "./schema.js";

const SHAPES: Record<BoardNode["kind"], [string, string]> = {
  box: ['["', '"]'],
  ellipse: ['(("', '"))'],
  diamond: ['{"', '"}'],
  text: ['["', '"]'],
  image: ['["', '"]'],
  frame: ['["', '"]'],
};

/** Collapses whitespace so a label fits on one line. */
function plain(text: string): string {
  return text.replace(/\s+/g, " ").trim() || "(unlabeled)";
}

export function mermaidLabel(text: string): string {
  return plain(text)
    .replaceAll('"', "#quot;")
    .replaceAll("|", "#124;")
    .replaceAll("[", "#91;")
    .replaceAll("]", "#93;");
}

const nodeLabel = (n: BoardNode): string =>
  n.kind === "image" ? (n.asset ?? n.label) : n.label;

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function boardGraphToMarkdown(graph: BoardGraph): string {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  // An end bound to something that is not a node (e.g. an embed) is free.
  const end = (id: string | null) => (id !== null && nodes.has(id) ? id : null);
  const edges = graph.edges.map((e) => ({
    ...e,
    from: end(e.from),
    to: end(e.to),
  }));
  const linked = edges.flatMap((e) =>
    e.from !== null && e.to !== null ? [{ ...e, from: e.from, to: e.to }] : [],
  );
  const free = edges.filter((e) => e.from === null || e.to === null);

  const connected = new Set(linked.flatMap((e) => [e.from, e.to]));
  const subgraphs = new Set(
    graph.nodes.flatMap((n) =>
      connected.has(n.id) &&
      n.frameId !== null &&
      nodes.get(n.frameId)?.kind === "frame"
        ? [n.frameId]
        : [],
    ),
  );
  const ids = new Map<string, string>();
  for (const n of graph.nodes) {
    if (connected.has(n.id) || subgraphs.has(n.id)) {
      ids.set(n.id, `n${ids.size + 1}`);
    }
  }
  const sid = (id: string): string => ids.get(id) ?? "";
  const shape = (n: BoardNode): string => {
    const [open, close] = SHAPES[n.kind];
    return `${sid(n.id)}${open}${mermaidLabel(nodeLabel(n))}${close}`;
  };
  const framed = (n: BoardNode): boolean =>
    n.frameId !== null && subgraphs.has(n.frameId);

  const side = (id: string | null): string => {
    const n = id === null ? undefined : nodes.get(id);
    return n ? `"${plain(nodeLabel(n))}" (${n.id})` : "(free)";
  };
  const arrow = (e: (typeof edges)[number]): string =>
    `- ${e.id}: ${side(e.from)} -> ${side(e.to)}${e.label.trim() ? ` label "${plain(e.label)}"` : ""}`;

  const sections = [`# Board: ${graph.board}`];

  if (linked.length > 0) {
    const lines = ["flowchart LR"];
    for (const n of graph.nodes) {
      if (!ids.has(n.id) || framed(n)) continue;
      if (!subgraphs.has(n.id)) {
        lines.push(`  ${shape(n)}`);
        continue;
      }
      lines.push(`  subgraph ${sid(n.id)}["${mermaidLabel(n.label)}"]`);
      for (const child of graph.nodes) {
        if (ids.has(child.id) && child.frameId === n.id) {
          lines.push(`    ${shape(child)}`);
        }
      }
      lines.push("  end");
    }
    for (const e of linked) {
      const { start, end: head } = e.arrowheads;
      const [a, b] = start && !head ? [e.to, e.from] : [e.from, e.to];
      const link = start && head ? "<-->" : start || head ? "-->" : "---";
      const label = e.label.trim() ? `|"${mermaidLabel(e.label)}"|` : "";
      lines.push(`  ${sid(a)} ${link}${label} ${sid(b)}`);
    }
    const idList = [...ids].map(([id, s]) => `${s}=${id}`).join(" ");
    sections.push(
      `## Diagram\n\n\`\`\`mermaid\n${lines.join("\n")}\n\`\`\`\n\n<!-- ids: ${idList} -->`,
    );
    sections.push(`## Arrows\n\n${linked.map(arrow).join("\n")}`);
  }

  if (free.length > 0) {
    sections.push(`## Unconnected arrows\n\n${free.map(arrow).join("\n")}`);
  }

  const bullets = graph.nodes
    .filter((n) => !ids.has(n.id))
    .map((n) => {
      const frame = n.frameId === null ? undefined : nodes.get(n.frameId);
      const inFrame = frame ? ` (in ${plain(frame.label)})` : "";
      return `- [${n.kind}] ${plain(nodeLabel(n))} (${n.id})${inFrame}`;
    });
  if (graph.loose.length > 0) {
    const draws = graph.loose.filter((l) => l.kind === "draw").length;
    bullets.push(
      `- ${plural(draws, "freehand stroke")}, ${plural(graph.loose.length - draws, "line")}`,
    );
  }
  if (bullets.length > 0) {
    sections.push(`## Other elements\n\n${bullets.join("\n")}`);
  }

  return `${sections.join("\n\n")}\n`;
}
