import { type Op, Propose, referencedIds } from "../../src/shared/proposals.js";

test("Propose requires at least one op and rejects unknown ops", () => {
  expect(Propose.safeParse({ ops: [] }).success).toBe(false);
  expect(Propose.safeParse({ ops: [{ op: "paint", id: "a" }] }).success).toBe(
    false,
  );
  expect(
    Propose.safeParse({ title: "t", ops: [{ op: "delete", id: "a" }] }).success,
  ).toBe(true);
});

test("referencedIds collects update, delete, and near ids once each", () => {
  const ops: Op[] = [
    { op: "add_diagram", mermaid: "flowchart LR\n a-->b", near: ["x", "y"] },
    { op: "update", id: "y", label: "new" },
    { op: "delete", id: "z" },
    { op: "add_note", text: "n", near: ["x"] },
  ];
  expect(referencedIds(ops)).toEqual(["x", "y", "z"]);
});
