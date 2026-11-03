import { expect, test } from "vitest";
import { focusTargets } from "../../src/ui/board/focus";

test("focusTargets keeps existing, non-deleted ids in focus order", () => {
  expect(
    focusTargets(
      [{ id: "a" }, { id: "b", isDeleted: true }, { id: "c" }],
      ["c", "b", "zz", "a"],
    ),
  ).toEqual(["c", "a"]);
  expect(focusTargets([{ id: "a" }], undefined)).toEqual([]);
});
