import type { BoardGraph } from "../../export/index.js";

export const SYSTEM_PROMPT_APPEND = `You are planning inside Blueprint, a whiteboard beside the user's code.

- The plan lives in \`.blueprint/\`: boards in \`boards/\`, docs in \`docs/\`, the compiled spec in \`spec.md\`, and tasks in \`tasks/\`.
- Read boards only with the get_board and get_selection tools. Never edit board files or their assets directly.
- When a user message starts with a selection header like [Selection on board "...": ...], "this" means those elements.
- Diagrams must be flowchart, sequence, class, ER, or state Mermaid; only those import as editable shapes.
- Put long descriptions in a doc under \`.blueprint/docs/\` and leave a short note on the board.
- The user sees your tool calls only as short rows, so put everything they need in your text answer.`;

const quote = (text: string) =>
  JSON.stringify(text.replace(/\s+/g, " ").trim());

export function selectionHeader(
  board: string,
  graph: BoardGraph,
  ids: string[],
): string {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = new Map(graph.edges.map((e) => [e.id, e]));
  const loose = new Map(graph.loose.map((l) => [l.id, l]));
  // Ids with no element in the graph (e.g. a shape's bound label text) are skipped.
  const items = ids.flatMap((id) => {
    const n = nodes.get(id);
    if (n) return [`${id} ${n.kind} ${quote(n.label)}`];
    const e = edges.get(id);
    if (e)
      return [
        `${id} arrow ${quote(e.label)} (${e.from ?? "?"}→${e.to ?? "?"})`,
      ];
    const l = loose.get(id);
    return l ? [`${id} ${l.kind}`] : [];
  });
  if (items.length === 0) return "";
  return `[Selection on board ${JSON.stringify(board)}: ${items.join("; ")}]`;
}

export function composeUserMessage(text: string, header: string): string {
  return header ? `${header}\n\n${text}` : text;
}
