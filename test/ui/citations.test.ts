import { citationHash, citationMarks } from "../../src/ui/plan/citations";

test("citationHash routes to the cited board element or doc heading", () => {
  expect(citationHash({ kind: "board", page: "main", id: "a1", raw: "" })).toBe(
    "#/boards/main?focus=a1",
  );
  // Doc citations name the file; the route names the doc.
  expect(
    citationHash({ kind: "doc", page: "notes.md", id: "caching", raw: "" }),
  ).toBe("#/docs/notes?focus=caching");
});

test("citationMarks finds every citation with its hash", () => {
  const text =
    "Auth [[board:main#a1]] and [[doc:notes.md#caching]], again [[board:main#a1]].";
  const marks = citationMarks(text);
  expect(marks.map((m) => text.slice(m.from, m.to))).toEqual([
    "[[board:main#a1]]",
    "[[doc:notes.md#caching]]",
    "[[board:main#a1]]",
  ]);
  expect(marks.map((m) => m.hash)).toEqual([
    "#/boards/main?focus=a1",
    "#/docs/notes?focus=caching",
    "#/boards/main?focus=a1",
  ]);
  expect(citationMarks("no citations here")).toEqual([]);
});
