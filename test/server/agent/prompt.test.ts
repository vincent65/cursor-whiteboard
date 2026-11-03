import type { BoardGraph } from "../../../src/export/index.js";
import {
  COMPILE_INSTRUCTION,
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

test("composeUserMessage puts notes before the header and the text", () => {
  expect(composeUserMessage("hi", "[Selection]", ["[note]"])).toBe(
    "[note]\n\n[Selection]\n\nhi",
  );
  expect(composeUserMessage("hi", "", [])).toBe("hi");
  expect(composeUserMessage("hi", "", ["[a]", "[b]"])).toBe("[a]\n\n[b]\n\nhi");
});

test("the prompt explains propose and revise", () => {
  expect(SYSTEM_PROMPT_APPEND).toMatch(/call propose with ops/);
  expect(SYSTEM_PROMPT_APPEND).toMatch(/call revise with its proposalId/);
});

test("the prompt tells Claude where arrow ids come from", () => {
  expect(SYSTEM_PROMPT_APPEND).toMatch(/arrows in its Arrows list/);
});

test("SYSTEM_PROMPT_APPEND covers its topics in order", () => {
  const order = [
    ".blueprint/",
    "spec.md",
    "tasks/",
    "get_board",
    "call propose with ops",
    "ghosts the user accepts or rejects",
    "call revise with its proposalId",
    "selection header like",
    "Diagrams must be",
    "long descriptions",
    ".blueprint/docs/",
    "short rows",
  ].map((s) => SYSTEM_PROMPT_APPEND.indexOf(s));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((x, y) => x - y));
  for (const kind of ["flowchart", "sequence", "class", "ER", "state"])
    expect(SYSTEM_PROMPT_APPEND).toContain(kind);
});

test("the prompt names add_node, add_arrow, and the $ reference", () => {
  expect(SYSTEM_PROMPT_APPEND).toMatch(/add_node/);
  expect(SYSTEM_PROMPT_APPEND).toMatch(/add_arrow/);
  expect(SYSTEM_PROMPT_APPEND).toContain(
    "To put a new node between two existing ones, delete their arrow, add_node the new one, and add_arrow from each side using $<index> to name the new node.",
  );
  expect(SYSTEM_PROMPT_APPEND).toContain(
    "A node between two existing ones needs no near.",
  );
});

test("COMPILE_INSTRUCTION names the six sections in order and the citation grammar", () => {
  expect(COMPILE_INSTRUCTION).toContain(
    "exactly these level-2 sections in this order: Goals, Architecture, Interfaces, Constraints, Acceptance criteria, Open questions.",
  );
  expect(COMPILE_INSTRUCTION).toContain("[[board:<board>#<elementId>]]");
  expect(COMPILE_INSTRUCTION).toContain("[[doc:<file>#<heading-slug>]]");
  expect(COMPILE_INSTRUCTION).toContain(".blueprint/export/boards/*.md");
  expect(COMPILE_INSTRUCTION.split("\n")).toHaveLength(5);
});
