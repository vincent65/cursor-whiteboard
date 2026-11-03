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
import { type Task, taskToMarkdown } from "../../src/shared/tasks.js";
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

test("isOwnWrite matches the store's last write by content, not by time", async () => {
  await store.init();
  await store.createDoc("notes");
  await store.writeDoc("notes", "mine");
  const doc = join(store.dir, "docs", "notes.md");
  expect(await store.isOwnWrite(doc)).toBe(true);
  expect(await store.isOwnWrite(join(store.dir, "docs", "other.md"))).toBe(
    false,
  );

  // An outside edit right after the store's own write is not an echo.
  await writeFile(doc, "theirs");
  expect(await store.isOwnWrite(doc)).toBe(false);
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

test("proposal log appends lines and reads them back; a missing file is empty", async () => {
  await store.init();
  expect(await store.readProposals()).toEqual([]);
  const proposal = {
    id: "p_1",
    board: "main",
    title: null,
    ops: [{ op: "delete" as const, id: "a" }],
    at: "2026-11-02T00:00:00.000Z",
  };
  await store.appendProposal({ event: "proposed", at: proposal.at, proposal });
  await store.appendProposal({ event: "accepted", at: proposal.at, id: "p_1" });
  expect(await store.readProposals()).toEqual([
    { event: "proposed", at: proposal.at, proposal },
    { event: "accepted", at: proposal.at, id: "p_1" },
  ]);
  expect(
    (await readFile(join(store.dir, "proposals.jsonl"), "utf8"))
      .trim()
      .split("\n"),
  ).toHaveLength(2);
});

test("a corrupt proposal log line is reported with its line number", async () => {
  await store.init();
  await writeFile(
    join(store.dir, "proposals.jsonl"),
    '{"event":"accepted","at":"x","id":"p_1"}\n{nope\n',
  );
  await expect(store.readProposals()).rejects.toThrow("proposals.jsonl line 2");
});

test("a torn last line is skipped with a warning, and the next append cuts it off", async () => {
  await store.init();
  const path = join(store.dir, "proposals.jsonl");
  const one = '{"event":"accepted","at":"x","id":"p_1"}';
  const two = '{"event":"rejected","at":"x","id":"p_2"}';
  await writeFile(path, `${one}\n{"event":"acc`);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await store.readProposals()).toEqual([JSON.parse(one)]);
  expect(warn).toHaveBeenCalledWith(
    "proposals.jsonl: ignoring a torn last line",
  );

  await store.appendProposal(JSON.parse(two));
  expect(await readFile(path, "utf8")).toBe(`${one}\n${two}\n`);
  warn.mockClear();
  expect(await store.readProposals()).toEqual([
    JSON.parse(one),
    JSON.parse(two),
  ]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("a whole last line missing only its newline is kept, and the next append starts a new line", async () => {
  await store.init();
  const path = join(store.dir, "proposals.jsonl");
  const one = '{"event":"accepted","at":"x","id":"p_1"}';
  const two = '{"event":"rejected","at":"x","id":"p_2"}';
  await writeFile(path, one);
  expect(await store.readProposals()).toEqual([JSON.parse(one)]);
  await store.appendProposal(JSON.parse(two));
  expect(await readFile(path, "utf8")).toBe(`${one}\n${two}\n`);
});

test("a bad line that is not a torn tail still fails the read", async () => {
  await store.init();
  const path = join(store.dir, "proposals.jsonl");
  await writeFile(
    path,
    '{"event":"acc\n{"event":"accepted","at":"x","id":"p_1"}',
  );
  await expect(store.readProposals()).rejects.toThrow("proposals.jsonl line 1");
  // Ends with a newline, so it is not torn.
  await writeFile(
    path,
    '{"event":"accepted","at":"x","id":"p_1"}\n{"event":"acc\n',
  );
  await expect(store.readProposals()).rejects.toThrow("proposals.jsonl line 2");
  // Whole JSON that fails the schema is corrupt, not torn.
  await writeFile(path, '{"event":"maybe"}');
  await expect(store.readProposals()).rejects.toThrow("proposals.jsonl line 1");
});

const t = (slug: string, dependsOn: string[] = []): Task => ({
  slug,
  title: slug,
  body: `Do ${slug}.\n`,
  dependsOn,
  files: [],
  acceptance: [],
  sources: [],
});

test("spec is null until written, then read back", async () => {
  await store.init();
  expect(await store.readSpec()).toBeNull();
  await writeFile(join(store.dir, "spec.md"), "## Goals\n");
  expect(await store.readSpec()).toBe("## Goals\n");
});

test("replaceTasks writes numbered files in dependency order and removes old ones", async () => {
  await store.init();
  await writeFile(join(store.dir, "tasks", "99-old.md"), "stale");
  await writeFile(join(store.dir, "tasks", "notes.txt"), "keep");
  const files = await store.replaceTasks([t("c", ["a"]), t("a")]);
  expect(files.map((f) => f.file)).toEqual(["01-a.md", "02-c.md"]);
  expect(files[1].task).toEqual(t("c", ["a"]));
  expect((await readdir(join(store.dir, "tasks"))).sort()).toEqual([
    "01-a.md",
    "02-c.md",
    "notes.txt",
  ]);
  expect(await store.listTasks()).toEqual(files);
  expect((await store.listTasks())[1].task.dependsOn).toEqual(["a"]);
});

test("replaceTasks with a cycle changes nothing", async () => {
  await store.init();
  await writeFile(join(store.dir, "tasks", "01-old.md"), "stale");
  await expect(
    store.replaceTasks([t("a", ["b"]), t("b", ["a"])]),
  ).rejects.toThrow("depend on each other");
  expect(await readdir(join(store.dir, "tasks"))).toEqual(["01-old.md"]);
});

test("replaceTasks refuses a slug that is not a safe file name", async () => {
  await store.init();
  await expect(store.replaceTasks([t("../x")])).rejects.toThrow(
    InvalidNameError,
  );
  expect(await readdir(join(store.dir, "tasks"))).toEqual([]);
});

test("listTasks names a bad file and a file whose slug does not match its name", async () => {
  await store.init();
  const tasks = join(store.dir, "tasks");
  await writeFile(join(tasks, "01-a.md"), taskToMarkdown(t("a")));
  await writeFile(join(tasks, "02-b.md"), "no frontmatter");
  await expect(store.listTasks()).rejects.toThrow(
    /^task file 02-b\.md: task frontmatter/,
  );
  await writeFile(join(tasks, "02-b.md"), taskToMarkdown(t("c")));
  await expect(store.listTasks()).rejects.toThrow(
    /^task file 02-b\.md has slug c$/,
  );
});

test("citationIndex covers board elements and doc headings", async () => {
  await store.init();
  await store.createBoard("main");
  await store.writeBoard("main", scene({ elements: [rect("e1")] }));
  await store.createDoc("api");
  await store.writeDoc("api", "# Auth Flow\n\n## Tokens\n");
  expect(await store.citationIndex()).toEqual(
    new Map([
      ["board:main#e1", ""],
      ["doc:api.md#auth-flow", "Auth Flow"],
      ["doc:api.md#tokens", "Tokens"],
    ]),
  );
});

test("a .blueprint/ deleted while the server runs lists as empty, reads as not found, and comes back on the next write", async () => {
  await store.init();
  await store.createBoard("main");
  await rm(store.dir, { recursive: true, force: true });

  expect(await store.listBoards()).toEqual([]);
  expect(await store.listDocs()).toEqual([]);
  expect(await store.listTasks()).toEqual([]);
  await expect(store.readBoard("main")).rejects.toThrow(NotFoundError);
  await expect(store.readDoc("notes")).rejects.toThrow(NotFoundError);

  await store.createBoard("main");
  await store.createDoc("notes");
  await store.replaceTasks([]);
  await store.writeSessions({ plan: null, runs: [] });
  await store.appendProposal({
    event: "accepted",
    at: "2026-11-03T00:00:00.000Z",
    id: "p_1",
  });
  expect((await store.listBoards()).map((b) => b.name)).toEqual(["main"]);
  expect((await store.listDocs()).map((d) => d.name)).toEqual(["notes"]);
  expect(await store.readProposals()).toHaveLength(1);
  for (const d of ["boards", "docs", "assets", "tasks", "export", "worktrees"])
    expect(existsSync(join(store.dir, d))).toBe(true);
});
