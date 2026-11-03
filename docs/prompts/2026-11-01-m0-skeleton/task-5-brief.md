### Task 5: FileStore

**Files:**
- Create: `src/server/files.ts`
- Modify: `src/shared/types.ts`
- Test: `test/server/files.test.ts`

**Interfaces:**
- Consumes: `BoardFile`, `BoardFileAsset` from Task 2.
- Produces in `src/shared/types.ts`, so the UI can import them without touching server code:

```ts
export type IncomingFile = { id: string; mimeType: string; created: number; dataURL?: string; asset?: string };
export type IncomingScene = { elements: unknown[]; appState: Record<string, unknown>; files: Record<string, IncomingFile> };
```

- Produces in `src/server/files.ts`:

```ts
export class InvalidNameError extends Error {}
export class NotFoundError extends Error {}
export class ExistsError extends Error {}
export class InvalidSceneError extends Error {}
export function assertSlug(name: string): void;
export class FileStore {
  constructor(root: string);
  readonly dir: string;                       // <root>/.blueprint
  init(): Promise<void>;
  listBoards(): Promise<{ name: string; updatedAt: string }[]>;
  createBoard(name: string): Promise<BoardFile>;
  readBoard(name: string): Promise<BoardFile>;
  writeBoard(name: string, scene: IncomingScene): Promise<BoardFile>;
  listDocs(): Promise<{ name: string; updatedAt: string }[]>;
  createDoc(name: string): Promise<void>;
  readDoc(name: string): Promise<string>;
  writeDoc(name: string, text: string): Promise<void>;
  readAsset(file: string): Promise<Buffer>;
  writeExport(relPath: string, data: Buffer | string): Promise<void>;
  wasWrittenRecently(absPath: string, withinMs: number): boolean;
}
```

- [ ] **Step 1: Write the failing tests** (each test gets a fresh temp dir via `mkdtemp`)

```ts
test("init creates the directories and appends gitignore lines once", async () => {
  await store.init(); await store.init();
  for (const d of ["boards", "docs", "assets", "tasks", "export", "worktrees"]) expect(existsSync(join(store.dir, d))).toBe(true);
  const gi = await readFile(join(root, ".gitignore"), "utf8");
  expect(gi.match(/\.blueprint\/export\//g)).toHaveLength(1);
  expect(gi.match(/\.blueprint\/worktrees\//g)).toHaveLength(1);
});
test("assertSlug accepts a-z0-9- and rejects the rest", () => {
  for (const ok of ["main", "api-v2", "x1"]) expect(() => assertSlug(ok)).not.toThrow();
  for (const bad of ["Main", "a b", "../x", "a/b", "-a", ""]) expect(() => assertSlug(bad)).toThrow(InvalidNameError);
});
test("createBoard writes an empty scene and refuses duplicates", ...);   // second create rejects with ExistsError; file content parses as BoardFile with elements []
test("writeBoard extracts a dataURL image to assets by sha256 and rewrites the reference", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const stored = await store.writeBoard("main", scene({ files: { f1: { id: "f1", mimeType: "image/png", created: 1, dataURL: `data:image/png;base64,${png.toString("base64")}` } } }));
  const sha = createHash("sha256").update(png).digest("hex");
  expect(stored.files.f1).toEqual({ id: "f1", mimeType: "image/png", created: 1, asset: `assets/${sha}.png` });
  expect(await readFile(join(store.dir, "assets", `${sha}.png`))).toEqual(png);
  expect(JSON.parse(await readFile(join(store.dir, "boards", "main.excalidraw.json"), "utf8")).files.f1.asset).toBe(`assets/${sha}.png`);
});
test("writeBoard keeps existing asset references and element ids untouched", ...);  // file with asset only, element ids identical after round trip
test("writeBoard rejects a malformed dataURL and writes nothing", async () => {
  await store.createBoard("main");
  const before = await readFile(boardPath, "utf8");
  await expect(store.writeBoard("main", scene({ files: { f1: { id: "f1", mimeType: "image/png", created: 1, dataURL: "data:image/png;base64,***" } } }))).rejects.toThrow(InvalidSceneError);
  expect(await readFile(boardPath, "utf8")).toBe(before);
  expect(await readdir(join(store.dir, "assets"))).toEqual([]);
});
test("writes are atomic: no temp files remain and content is complete", ...);
test("docs round trip and list with updatedAt", ...);
test("readBoard and readDoc throw NotFoundError", ...);
test("wasWrittenRecently is true right after a write and false after the window", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/files.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/server/files.ts`**

Decisions: board path is `boards/<name>.excalidraw.json`; stored JSON is `JSON.stringify(board, null, 2) + "\n"`; empty scene is `{ type: "excalidraw", version: 2, source: "blueprint", elements: [], appState: {}, files: {} }`; the asset extension comes from a map `{ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/svg+xml": "svg", "image/webp": "webp" }` and any other MIME type is an `InvalidSceneError`; base64 is validated with a strict regex before decoding and a decode that yields zero bytes is invalid; atomic writes go to `<path>.tmp-<random>` then `rename`; `wasWrittenRecently` reads a `Map<string, number>` the write methods fill; the gitignore lines are `.blueprint/export/` and `.blueprint/worktrees/`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/files.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/files.ts src/shared/types.ts test/server/files.test.ts
git commit -m "feat(server): FileStore for .blueprint with asset extraction and atomic writes"
```

---

