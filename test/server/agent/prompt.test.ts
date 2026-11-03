import type { BoardGraph } from "../../../src/export/index.js";
import {
  composeUserMessage,
  SYSTEM_PROMPT_APPEND,
  selectionHeader,
} from "../../../src/server/agent/prompt.js";

const bounds = { x: 0, y: 0, w: 10, h: 10 };
const graph: BoardGraph = {
  board: "flow",
  nodes: [
    {
      id: "a",
      kind: "box",
      label: "Login",
      frameId: null,
      bounds,
      origin: "human",
    },
    {
      id: "b",
      kind: "ellipse",
      label: "Home\npage",
      frameId: null,
      bounds,
      origin: "human",
    },
  ],
  edges: [
    {
      id: "e",
      from: "a",
      to: "b",
      label: "ok",
      arrowheads: { start: false, end: true },
    },
    {
      id: "f",
      from: null,
      to: "b",
      label: "",
      arrowheads: { start: false, end: true },
    },
  ],
  loose: [{ id: "d", kind: "draw" }],
};

test("selectionHeader renders ids, kinds, labels, and arrow ends; empty ids give empty string", () => {
  expect(selectionHeader("flow", graph, [])).toBe("");
  expect(
    selectionHeader("flow", graph, ["a", "b", "e", "f", "d", "gone"]),
  ).toBe(
    '[Selection on board "flow": a box "Login"; b ellipse "Home page"; e arrow "ok" (a→b); f arrow "" (?→b); d draw]',
  );
});

test("composeUserMessage puts the header and a blank line before the text", () => {
  expect(composeUserMessage("fix this", "[Selection]")).toBe(
    "[Selection]\n\nfix this",
  );
  expect(composeUserMessage("hello", "")).toBe("hello");
});

test("SYSTEM_PROMPT_APPEND covers its topics in order", () => {
  const order = [
    ".blueprint/",
    "spec.md",
    "tasks/",
    "get_board",
    "selection header",
    "Mermaid",
    "long descriptions",
    ".blueprint/docs/",
    "short rows",
  ].map((s) => SYSTEM_PROMPT_APPEND.indexOf(s));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((x, y) => x - y));
  for (const kind of ["flowchart", "sequence", "class", "ER", "state"])
    expect(SYSTEM_PROMPT_APPEND).toContain(kind);
});
