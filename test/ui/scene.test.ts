import type { BoardFile } from "../../src/export/schema";
import { filesWithDataUrls, toSaveBody } from "../../src/ui/board/scene";

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
