// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import mermaid from "mermaid";
import {
  type BoardEdge,
  type BoardNode,
  boardGraphToMarkdown,
} from "../../src/export/index.js";

const node = (
  id: string,
  label: string,
  overrides: Partial<BoardNode> = {},
): BoardNode => ({
  id,
  kind: "box",
  label,
  frameId: null,
  bounds: { x: 0, y: 0, w: 0, h: 0 },
  origin: "human",
  ...overrides,
});

const edge = (
  id: string,
  from: string,
  to: string,
  start: boolean,
  end: boolean,
  label = "",
): BoardEdge => ({ id, from, to, label, arrowheads: { start, end } });

const mermaidBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "");

test("every mermaid block the renderer produces parses with the real Mermaid parser", async () => {
  mermaid.initialize({ startOnLoad: false });
  // jsdom swaps the global URL, which readFile rejects, so build a path instead.
  const golden = await readFile(
    join(import.meta.dirname, "fixtures/basic.md"),
    "utf8",
  );
  const rendered = boardGraphToMarkdown({
    board: "main",
    nodes: [
      node("fr", 'Frame "x" | [y]', { kind: "frame" }),
      node("a", 'Say "hi" | [x]', { frameId: "fr" }),
      node("b", "B", { frameId: "fr" }),
      node("d", "Valid?", { kind: "diamond" }),
      node("e", "Done", { kind: "ellipse" }),
    ],
    edges: [
      edge("x1", "a", "b", true, true, 'both "q" | [z]'),
      edge("x2", "b", "d", false, false, "none"),
      edge("x3", "d", "e", true, false),
      edge("x4", "a", "e", false, true),
    ],
    loose: [],
  });
  const blocks = [...mermaidBlocks(golden), ...mermaidBlocks(rendered)];
  expect(blocks).toHaveLength(2);
  for (const block of blocks) {
    await expect(mermaid.parse(block)).resolves.toBeTruthy();
  }
});
