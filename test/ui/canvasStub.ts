// jsdom has no 2D canvas, and Excalidraw probes one as it loads, so tests that
// import Excalidraw import this first. Text measures 10px per character.
globalThis.FontFace = class {} as never;
HTMLCanvasElement.prototype.getContext = (() => ({
  font: "",
  measureText: (t: string) => ({
    width: t.length * 10,
    actualBoundingBoxAscent: 16,
    actualBoundingBoxDescent: 4,
  }),
})) as never;
