import { expect, test } from "vitest";
import { fitsInView, focusTargets } from "../../src/ui/board/focus";

test("focusTargets keeps existing, non-deleted ids in focus order", () => {
  expect(
    focusTargets(
      [{ id: "a" }, { id: "b", isDeleted: true }, { id: "c" }],
      ["c", "b", "zz", "a"],
    ),
  ).toEqual(["c", "a"]);
  expect(focusTargets([{ id: "a" }], undefined)).toEqual([]);
});

test("fitsInView compares the box at the current zoom with the viewport", () => {
  const view = { width: 1200, height: 800 };
  expect(fitsInView({ width: 100, height: 50 }, view, 1)).toBe(true);
  expect(fitsInView({ width: 3000, height: 200 }, view, 1)).toBe(false);
  expect(fitsInView({ width: 1000, height: 50 }, view, 2)).toBe(false);
});
