import { readFile } from "node:fs/promises";
import {
  type BoardEdge,
  BoardFile,
  type BoardGraph,
  type BoardNode,
  boardGraphToMarkdown,
  excalidrawToBoardGraph,
  mermaidLabel,
} from "../../src/export/index.js";

const fixture = (name: string) =>
  new URL(`./fixtures/${name}`, import.meta.url);

function node(
  id: string,
  label: string,
  overrides: Partial<BoardNode> = {},
): BoardNode {
  return {
    id,
    kind: "box",
    label,
    frameId: null,
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    origin: "human",
    ...overrides,
  };
}

function edge(
  id: string,
  from: string | null,
  to: string | null,
  arrowheads: BoardEdge["arrowheads"] = { start: false, end: true },
  label = "",
): BoardEdge {
  return { id, from, to, label, arrowheads };
}

function graph(
  nodes: BoardNode[],
  edges: BoardEdge[] = [],
  loose: BoardGraph["loose"] = [],
): BoardGraph {
  return { board: "main", nodes, edges, loose };
}

test("golden: basic board renders exactly", async () => {
  const board = BoardFile.parse(
    JSON.parse(await readFile(fixture("basic.excalidraw.json"), "utf8")),
  );
  expect(boardGraphToMarkdown(excalidrawToBoardGraph(board, "main"))).toBe(
    await readFile(fixture("basic.md"), "utf8"),
  );
});

test("connected arrows are listed with their ids after the diagram", async () => {
  const board = BoardFile.parse(
    JSON.parse(await readFile(fixture("basic.excalidraw.json"), "utf8")),
  );
  const md = boardGraphToMarkdown(excalidrawToBoardGraph(board, "main"));
  expect(md).toContain(
    '<!-- ids: n1=fr1 n2=r1 n3=r2 n4=e1 -->\n\n## Arrows\n\n- a1: "API" (r1) -> "Postgres" (r2) label "SQL"\n',
  );
  expect(boardGraphToMarkdown(graph([node("a", "A")]))).not.toContain(
    "## Arrows",
  );
});

test("labels are escaped for Mermaid", () => {
  expect(mermaidLabel('Say "hi" | [x]\nnext')).toBe(
    "Say #quot;hi#quot; #124; #91;x#93; next",
  );
  expect(mermaidLabel("   ")).toBe("(unlabeled)");
});

test("both arrowheads render <-->, none renders ---, start-only is reversed", () => {
  const md = boardGraphToMarkdown(
    graph(
      [node("a", "A"), node("b", "B"), node("c", "C")],
      [
        edge("x1", "a", "b", { start: true, end: true }),
        edge("x2", "b", "c", { start: false, end: false }, "plain"),
        edge("x3", "a", "c", { start: true, end: false }),
      ],
    ),
  );
  expect(md).toContain('  n1 <--> n2\n  n2 ---|"plain"| n3\n  n3 --> n1\n');
});

test("a frame with no connected children is not a subgraph; its nodes list under Other elements with (in <frame>)", () => {
  const md = boardGraphToMarkdown(
    graph(
      [
        node("fr1", "Ideas", { kind: "frame" }),
        node("r1", "Cache", { frameId: "fr1" }),
        node("a", "A"),
        node("b", "B"),
      ],
      [edge("x1", "a", "b")],
    ),
  );
  expect(md).not.toContain("subgraph");
  expect(md).toContain("<!-- ids: n1=a n2=b -->");
  expect(md).toContain(
    "## Other elements\n\n- [frame] Ideas (fr1)\n- [box] Cache (r1) (in Ideas)\n",
  );
});

test('diamond renders n{"label"}', () => {
  const md = boardGraphToMarkdown(
    graph(
      [node("d", "Valid?", { kind: "diamond" }), node("b", "B")],
      [edge("x1", "d", "b")],
    ),
  );
  expect(md).toContain('  n1{"Valid?"}\n');
});

test("a board with no edges has no Diagram section and no ids comment", () => {
  const md = boardGraphToMarkdown(
    graph(
      [node("r1", "Lonely")],
      [],
      [
        { id: "d1", kind: "draw" },
        { id: "d2", kind: "draw" },
        { id: "l1", kind: "line" },
      ],
    ),
  );
  expect(md).toBe(
    "# Board: main\n\n## Other elements\n\n- [box] Lonely (r1)\n- 2 freehand strokes, 1 line\n",
  );
});
