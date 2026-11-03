import {
  blobToDataUrl,
  sameIds,
  selectedIds,
} from "../../src/ui/board/snapshot";

test("selectedIds keeps element order and drops deleted elements", () => {
  expect(
    selectedIds({ selectedElementIds: { b: true, a: true, z: true } }, [
      { id: "a" },
      { id: "b" },
      { id: "z", isDeleted: true },
    ]),
  ).toEqual(["a", "b"]);
});

test("blobToDataUrl encodes bytes", async () => {
  expect(
    await blobToDataUrl(
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    ),
  ).toBe("data:image/png;base64,AQID");
});

test("sameIds compares as ordered lists", () => {
  expect(sameIds([], [])).toBe(true);
  expect(sameIds(["a", "b"], ["a", "b"])).toBe(true);
  expect(sameIds(["a", "b"], ["b", "a"])).toBe(false);
  expect(sameIds(["a"], ["a", "b"])).toBe(false);
});
