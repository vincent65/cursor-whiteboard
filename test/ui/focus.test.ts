import { expect, test } from "vitest";
import { fitsInView, focusTargets, leftInset } from "../../src/ui/board/focus";

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

// Excalidraw docks its properties panel on the left only in its desktop layout; an
// editor under 730 px wide (or under 1000 by 500) gets the compact one, with no panel.
test("leftInset leaves room for the properties panel only where it opens", () => {
  expect(leftInset({ width: 840, height: 800 }, false)).toBe(232);
  expect(leftInset({ width: 840, height: 800 }, true)).toBe(0);
  expect(leftInset({ width: 680, height: 800 }, false)).toBe(0);
  expect(leftInset({ width: 900, height: 480 }, false)).toBe(0);
  expect(leftInset({ width: 1200, height: 480 }, false)).toBe(232);
});
