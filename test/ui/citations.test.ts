import { citationHash } from "../../src/ui/plan/citations";

test("citationHash routes to the cited board element or doc heading", () => {
  expect(citationHash({ kind: "board", page: "main", id: "a1", raw: "" })).toBe(
    "#/boards/main?focus=a1",
  );
  // Doc citations name the file; the route names the doc.
  expect(
    citationHash({ kind: "doc", page: "notes.md", id: "caching", raw: "" }),
  ).toBe("#/docs/notes?focus=caching");
});
