import {
  buildCitationIndex,
  dropUnknownCitations,
  headingSlugs,
  parseCitations,
} from "../../src/export/citations.js";
import type { BoardGraph } from "../../src/export/schema.js";

test("parses board and doc citations", () => {
  expect(
    parseCitations("see [[board:main#r1]] and [[doc:api.md#auth-flow]]"),
  ).toEqual([
    { kind: "board", page: "main", id: "r1", raw: "[[board:main#r1]]" },
    {
      kind: "doc",
      page: "api.md",
      id: "auth-flow",
      raw: "[[doc:api.md#auth-flow]]",
    },
  ]);
});

test("heading slugs follow GitHub rules", () => {
  expect(
    headingSlugs("# Auth Flow\n## Step 2: Tokens!\ntext\n### A  B"),
  ).toEqual(["auth-flow", "step-2-tokens", "a--b"]);
});

test("index keys are board:<name>#<id> for nodes, edges and loose, and doc:<file>#<slug>", () => {
  const main: BoardGraph = {
    board: "main",
    nodes: [
      {
        id: "r1",
        kind: "box",
        label: "API",
        frameId: null,
        bounds: { x: 0, y: 0, w: 0, h: 0 },
        origin: "human",
      },
    ],
    edges: [
      {
        id: "a1",
        from: "r1",
        to: null,
        label: "",
        arrowheads: { start: false, end: true },
      },
    ],
    loose: [{ id: "d1", kind: "draw" }],
  };
  expect(
    buildCitationIndex({
      boards: { main },
      docs: { "api.md": "# Auth Flow\n## Tokens" },
    }),
  ).toEqual(
    new Set([
      "board:main#r1",
      "board:main#a1",
      "board:main#d1",
      "doc:api.md#auth-flow",
      "doc:api.md#tokens",
    ]),
  );
});

test("unknown citations are removed from the text and reported", () => {
  const r = dropUnknownCitations(
    "x [[board:main#r1]] y [[board:main#zzz]]",
    new Set(["board:main#r1"]),
  );
  expect(r.text).toBe("x [[board:main#r1]] y ");
  expect(r.dropped.map((c) => c.raw)).toEqual(["[[board:main#zzz]]"]);
});
