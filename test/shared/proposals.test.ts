import {
  checkRefs,
  type Op,
  Propose,
  referencedIds,
} from "../../src/shared/proposals.js";
import { isRef, refIndex } from "../../src/shared/refs.js";

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

test("add_node and add_arrow parse, $ references resolve only to earlier add_node ops", () => {
  const parsed = Propose.parse({
    ops: [
      { op: "delete", id: "ab" },
      { op: "add_node", label: "Cache", near: ["a"] },
      { op: "add_arrow", from: "a", to: "$1" },
      { op: "add_arrow", from: "$1", to: "b", label: "reads" },
    ],
  });
  expect(parsed.ops[1]).toEqual({
    op: "add_node",
    label: "Cache",
    kind: "box",
    near: ["a"],
  });
  expect(
    Propose.safeParse({ ops: [{ op: "add_node", label: "" }] }).success,
  ).toBe(false);
  expect(
    Propose.safeParse({
      ops: [{ op: "add_node", label: "x", kind: "hexagon" }],
    }).success,
  ).toBe(false);
  expect(referencedIds(parsed.ops)).toEqual(["ab", "a", "b"]);
  expect(() => checkRefs(parsed.ops)).not.toThrow();

  const node: Op = { op: "add_node", label: "n", kind: "box" };
  expect(() =>
    checkRefs([
      { op: "delete", id: "ab" },
      node,
      { op: "add_arrow", from: "$0", to: "a" },
    ]),
  ).toThrow("op 2: $0 must name an earlier add_node");
  expect(() =>
    checkRefs([node, { op: "add_arrow", from: "a", to: "$5" }]),
  ).toThrow("op 1: $5 must name an earlier add_node");
  expect(() =>
    checkRefs([{ op: "add_arrow", from: "$1", to: "a" }, node]),
  ).toThrow("op 0: $1 must name an earlier add_node");
  expect(() =>
    checkRefs([node, { op: "add_arrow", from: "$", to: "a" }]),
  ).toThrow("op 1: $ must name an earlier add_node");
});

test("refs are $ and a canonical index, and checkRefs uses exactly that", () => {
  expect(refIndex("$0")).toBe(0);
  expect(refIndex("$12")).toBe(12);
  for (const bad of ["$", "$01", "$-1", "$1.5", "$a", "1", "$1 "])
    expect(refIndex(bad)).toBeNull();
  expect(isRef("$01")).toBe(true);
  expect(isRef("abc")).toBe(false);
  const node: Op = { op: "add_node", label: "n", kind: "box" };
  expect(() =>
    checkRefs([node, node, { op: "add_arrow", from: "a", to: "$01" }]),
  ).toThrow("op 2: $01 must name an earlier add_node");
});

test("checkRefs rejects an arrow whose two ends are the same", () => {
  const node: Op = { op: "add_node", label: "n", kind: "box" };
  expect(() => checkRefs([{ op: "add_arrow", from: "a", to: "a" }])).toThrow(
    "op 0: an arrow needs two different ends",
  );
  expect(() =>
    checkRefs([node, { op: "add_arrow", from: "$0", to: "$0" }]),
  ).toThrow("op 1: an arrow needs two different ends");
});
