import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BoardFile } from "../../src/export/schema.js";
import {
  assertSlug,
  ExistsError,
  FileStore,
  InvalidNameError,
  InvalidSceneError,
  NotFoundError,
} from "../../src/server/files.js";
import type { IncomingScene } from "../../src/shared/types.js";

let root: string;
let store: FileStore;
let boardPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-files-"));
  store = new FileStore(root);
  boardPath = join(store.dir, "boards", "main.excalidraw.json");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const rect = (id: string) => ({
  id,
  type: "rectangle",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  seed: 42,
});

const scene = (overrides: Partial<IncomingScene> = {}): IncomingScene => ({
  elements: [rect("r1")],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
  ...overrides,
});

test("init creates the directories and appends gitignore lines once", async () => {
  await store.init();
  await store.init();
  for (const d of ["boards", "docs", "assets", "tasks", "export", "worktrees"])
    expect(existsSync(join(store.dir, d))).toBe(true);
  const gi = await readFile(join(root, ".gitignore"), "utf8");
  expect(gi.match(/\.blueprint\/export\//g)).toHaveLength(1);
  expect(gi.match(/\.blueprint\/worktrees\//g)).toHaveLength(1);
});

test("assertSlug accepts a-z0-9- and rejects the rest", () => {
  for (const ok of ["main", "api-v2", "x1"])
    expect(() => assertSlug(ok)).not.toThrow();
  for (const bad of ["Main", "a b", "../x", "a/b", "-a", ""])
    expect(() => assertSlug(bad)).toThrow(InvalidNameError);
});

test("createBoard writes an empty scene and refuses duplicates", async () => {
  await store.init();
  const created = await store.createBoard("main");
  expect(created.elements).toEqual([]);
  const onDisk = BoardFile.parse(JSON.parse(await readFile(boardPath, "utf8")));
  expect(onDisk).toEqual({
    type: "excalidraw",
    version: 2,
    source: "blueprint",
    elements: [],
    appState: {},
    files: {},
  });
  await expect(store.createBoard("main")).rejects.toThrow(ExistsError);
  await expect(store.createBoard("Bad Name")).rejects.toThrow(InvalidNameError);
});

test("writeBoard extracts a dataURL image to assets by sha256 and rewrites the reference", async () => {
  await store.init();
  await store.createBoard("main");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const stored = await store.writeBoard(
    "main",
    scene({
      files: {
        f1: {
          id: "f1",
          mimeType: "image/png",
          created: 1,
          dataURL: `data:image/png;base64,${png.toString("base64")}`,
        },
      },
    }),
  );
  const sha = createHash("sha256").update(png).digest("hex");
  expect(stored.files.f1).toEqual({
    id: "f1",
    mimeType: "image/png",
    created: 1,
    asset: `assets/${sha}.png`,
  });
  expect(await readFile(join(store.dir, "assets", `${sha}.png`))).toEqual(png);
  expect(JSON.parse(await readFile(boardPath, "utf8")).files.f1.asset).toBe(
    `assets/${sha}.png`,
  );
  expect(await readFile(boardPath, "utf8")).not.toContain("base64");
  expect(await store.readAsset(`${sha}.png`)).toEqual(png);
});

test("writeBoard extracts a large image whose payload exceeds 5 MB", async () => {
  await store.init();
  await store.createBoard("main");
  const bytes = randomBytes(4 * 1024 * 1024);
  const payload = bytes.toString("base64");
  expect(payload.length).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  const stored = await store.writeBoard(
    "main",
    scene({
      files: {
        f1: {
          id: "f1",
          mimeType: "image/png",
          created: 1,
          dataURL: `data:image/png;base64,${payload}`,
        },
      },
    }),
  );
  const sha = createHash("sha256").update(bytes).digest("hex");
  expect(stored.files.f1.asset).toBe(`assets/${sha}.png`);
  const written = await readFile(join(store.dir, "assets", `${sha}.png`));
  expect(createHash("sha256").update(written).digest("hex")).toBe(sha);
});

test("writeBoard keeps existing asset references and element ids untouched", async () => {
  await store.init();
  await store.createBoard("main");
  const asset = {
    id: "f1",
    mimeType: "image/png",
    created: 1,
    asset: "assets/abc.png",
  };
  const elements = [
    rect("keep-me-1"),
    rect("Xy_9-zz"),
    { ...rect("img"), type: "image", fileId: "f1" },
  ];
  await store.writeBoard("main", scene({ elements, files: { f1: asset } }));
  const back = await store.readBoard("main");
  expect(back.elements.map((e) => e.id)).toEqual([
    "keep-me-1",
    "Xy_9-zz",
    "img",
  ]);
  expect(back.elements[0]).toMatchObject({ seed: 42 });
  expect(back.files.f1).toEqual(asset);
  expect(back.appState).toEqual({ viewBackgroundColor: "#ffffff" });
});

test("writeBoard rejects a malformed dataURL and writes nothing", async () => {
  await store.init();
  await store.createBoard("main");
  const before = await readFile(boardPath, "utf8");
  const bad = (dataURL: string, mimeType = "image/png") =>
    store.writeBoard(
      "main",
      scene({
        files: {
          ok: {
            id: "ok",
            mimeType: "image/png",
            created: 1,
            dataURL: `data:image/png;base64,${Buffer.from("fine").toString("base64")}`,
          },
          f1: { id: "f1", mimeType, created: 1, dataURL },
        },
      }),
    );
  await expect(bad("data:image/png;base64,***")).rejects.toThrow(
    InvalidSceneError,
  );
  for (const payload of ["A", "AAAAA", "AAAA==", "AAAA=====", "AB"])
    await expect(bad(`data:image/png;base64,${payload}`)).rejects.toThrow(
      InvalidSceneError,
    );
  await expect(
    bad("data:image/tiff;base64,AAAA", "image/tiff"),
  ).rejects.toThrow(InvalidSceneError);
  await expect(bad("data:image/png;base64,AAAA", "image/jpeg")).rejects.toThrow(
    InvalidSceneError,
  );
  await expect(
    store.writeBoard("main", scene({ elements: [{ type: "rectangle" }] })),
  ).rejects.toThrow(InvalidSceneError);
  expect(await readFile(boardPath, "utf8")).toBe(before);
  expect(await readdir(join(store.dir, "assets"))).toEqual([]);
});

test("writes are atomic: no temp files remain and content is complete", async () => {
  await store.init();
  await store.createBoard("main");
  await store.createDoc("notes");
  const big = "x".repeat(1_000_000);
  await Promise.all([
    ...Array.from({ length: 10 }, (_, i) =>
      store.writeBoard("main", scene({ elements: [rect(`r${i}`)] })),
    ),
    ...Array.from({ length: 10 }, () => store.writeDoc("notes", big)),
    store.writeExport("boards/main.md", "# main\n"),
  ]);
  for (const d of ["boards", "docs", "assets", "export/boards"])
    expect(
      (await readdir(join(store.dir, d))).filter((f) => f.includes(".tmp-")),
    ).toEqual([]);
  const board = BoardFile.parse(JSON.parse(await readFile(boardPath, "utf8")));
  expect(board.elements).toHaveLength(1);
  expect(await readFile(boardPath, "utf8")).toMatch(/\n}\n$/);
  expect(await store.readDoc("notes")).toBe(big);
  expect(await readFile(join(store.dir, "export/boards/main.md"), "utf8")).toBe(
    "# main\n",
  );
  await expect(
    store.writeExport("../boards/main.excalidraw.json", "x"),
  ).rejects.toThrow(InvalidNameError);
});

test("docs round trip and list with updatedAt", async () => {
  await store.init();
  await store.createDoc("zeta");
  await store.createDoc("api");
  expect(await store.readDoc("api")).toBe("");
  await store.writeDoc("api", "# API\n");
  expect(await store.readDoc("api")).toBe("# API\n");
  await expect(store.createDoc("api")).rejects.toThrow(ExistsError);
  const docs = await store.listDocs();
  expect(docs.map((d) => d.name)).toEqual(["api", "zeta"]);
  for (const d of docs)
    expect(new Date(d.updatedAt).toISOString()).toBe(d.updatedAt);
  await store.createBoard("main");
  expect((await store.listBoards()).map((b) => b.name)).toEqual(["main"]);
});

test("readBoard and readDoc throw NotFoundError", async () => {
  await store.init();
  await expect(store.readBoard("missing")).rejects.toThrow(NotFoundError);
  await expect(store.readDoc("missing")).rejects.toThrow(NotFoundError);
  await expect(store.writeBoard("missing", scene())).rejects.toThrow(
    NotFoundError,
  );
  await expect(store.writeDoc("missing", "x")).rejects.toThrow(NotFoundError);
  await expect(store.readAsset(`${"0".repeat(64)}.png`)).rejects.toThrow(
    NotFoundError,
  );
  await expect(
    store.readAsset("../boards/main.excalidraw.json"),
  ).rejects.toThrow(NotFoundError);
  await expect(store.readBoard("../x")).rejects.toThrow(InvalidNameError);
});

test("wasWrittenRecently is true right after a write and false after the window", async () => {
  await store.init();
  await store.createDoc("notes");
  const doc = join(store.dir, "docs", "notes.md");
  expect(store.wasWrittenRecently(doc, 1000)).toBe(true);
  expect(
    store.wasWrittenRecently(join(store.dir, "docs", "other.md"), 1000),
  ).toBe(false);
  await new Promise((r) => setTimeout(r, 30));
  expect(store.wasWrittenRecently(doc, 10)).toBe(false);
});

test("sessions file round-trips and defaults when missing", async () => {
  await store.init();
  expect(await store.readSessions()).toEqual({ plan: null, runs: [] });
  const s = {
    plan: { sessionId: "abc", updatedAt: "2026-11-02T00:00:00.000Z" },
    runs: [],
  };
  await store.writeSessions(s);
  expect(await store.readSessions()).toEqual(s);
  expect(
    JSON.parse(await readFile(join(store.dir, "sessions.json"), "utf8")),
  ).toEqual(s);
});

test("a corrupt sessions file is reported, not silently replaced", async () => {
  await store.init();
  await writeFile(join(store.dir, "sessions.json"), "{not json");
  await expect(store.readSessions()).rejects.toThrow();
});
