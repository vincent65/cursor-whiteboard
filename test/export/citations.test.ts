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
    new Map([
      ["board:main#r1", "API"],
      ["board:main#a1", ""],
      ["board:main#d1", ""],
      ["doc:api.md#auth-flow", "Auth Flow"],
      ["doc:api.md#tokens", "Tokens"],
    ]),
  );
});

test("a repeated heading slug keeps the first heading's text", () => {
  expect(
    buildCitationIndex({ boards: {}, docs: { "a.md": "# Setup\n## setup" } }),
  ).toEqual(new Map([["doc:a.md#setup", "Setup"]]));
});

test("unknown citations are removed from the text and reported", () => {
  const r = dropUnknownCitations(
    "x [[board:main#r1]] y [[board:main#zzz]]",
    new Set(["board:main#r1"]),
  );
  expect(r.text).toBe("x [[board:main#r1]] y");
  expect(r.dropped.map((c) => c.raw)).toEqual(["[[board:main#zzz]]"]);
});

test("an unknown citation goes with one adjacent separator", () => {
  const index = new Set(["board:main#a"]);
  const clean = (text: string) => dropUnknownCitations(text, index).text;
  expect(clean("See A, B, [[board:main#x]], [[board:main#y]].")).toBe(
    "See A, B.",
  );
  expect(clean("(see [[board:main#x]])")).toBe("");
  expect(clean("Login (see [[board:main#x]]; [[doc:a.md#y]]) fast.")).toBe(
    "Login fast.",
  );
  expect(clean("Login (see [[board:main#a]], [[board:main#x]]) fast.")).toBe(
    "Login (see [[board:main#a]]) fast.",
  );
  expect(clean("Login [[board:main#x]] fast.")).toBe("Login fast.");
  expect(clean("[[board:main#x]], [[board:main#a]] first")).toBe(
    "[[board:main#a]] first",
  );
  expect(clean("- Login [[board:main#x]]\n- Home")).toBe("- Login\n- Home");
});

test("an unknown citation leading a list takes the comma after it", () => {
  const index = new Set(["board:main#a"]);
  const clean = (text: string) => dropUnknownCitations(text, index).text;
  expect(clean("Statement [[board:main#x]], [[board:main#a]].")).toBe(
    "Statement [[board:main#a]].",
  );
  expect(clean("Login (see [[board:main#x]], [[board:main#a]]) fast.")).toBe(
    "Login (see [[board:main#a]]) fast.",
  );
  expect(clean("See [[board:main#x]], [[board:main#y]], A.")).toBe("See A.");
});
