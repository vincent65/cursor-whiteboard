import type { BoardFile } from "../../src/export/schema";
import {
  filesWithDataUrls,
  shouldSave,
  toSaveBody,
} from "../../src/ui/board/scene";

test("toSaveBody keeps elements and files and reduces appState to the persisted subset", () => {
  const body = toSaveBody(
    [{ id: "r1" }],
    {
      viewBackgroundColor: "#fff",
      collaborators: new Map(),
      selectedElementIds: { r1: true },
    },
    {},
  );
  expect(body.elements).toEqual([{ id: "r1" }]);
  expect(body.appState).toEqual({ viewBackgroundColor: "#fff" });
});

test("filesWithDataUrls fetches each asset and builds a data URL", async () => {
  const emptyBoard: BoardFile = {
    type: "excalidraw",
    version: 2,
    elements: [],
    appState: {},
    files: {},
  };
  const stored = {
    ...emptyBoard,
    files: {
      f1: {
        id: "f1",
        mimeType: "image/png",
        created: 1,
        asset: "assets/x.png",
      },
    },
  };
  const files = await filesWithDataUrls(
    stored,
    async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  );
  expect(files.f1.dataURL).toBe("data:image/png;base64,AQID");
});

test("shouldSave triggers on scene version and saved appState, not on zoom or scroll", () => {
  const prev = {
    version: 5,
    appState: {
      viewBackgroundColor: "#fff",
      gridSize: 20,
      gridModeEnabled: false,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
    },
  };
  const next = (patch: Record<string, unknown>, version = 5) => ({
    version,
    appState: { ...prev.appState, ...patch },
  });
  expect(shouldSave(prev, next({}))).toBe(false);
  expect(shouldSave(prev, next({ zoom: { value: 2 }, scrollX: 40 }))).toBe(
    false,
  );
  expect(shouldSave(prev, next({}, 6))).toBe(true);
  expect(shouldSave(prev, next({ viewBackgroundColor: "#ffc9c9" }))).toBe(true);
  expect(shouldSave(prev, next({ gridSize: 10 }))).toBe(true);
  expect(shouldSave(prev, next({ gridModeEnabled: true }))).toBe(true);
});
