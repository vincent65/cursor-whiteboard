### Task 6: HTTP routes

**Files:**
- Create: `src/server/routes.ts`, `src/server/app.ts`
- Test: `test/server/routes.test.ts`

**Interfaces:**
- Consumes: `FileStore` and its errors from Task 5; `excalidrawToBoardGraph`, `boardGraphToMarkdown`, `BoardFile` from Tasks 2 and 3.
- Produces: `createApp(store: FileStore): Hono` with these routes and JSON errors `{ error: string }`:

| Method and path | Body | Response |
|---|---|---|
| GET `/api/boards` | | 200 `{ name, updatedAt }[]` |
| POST `/api/boards` | `{ name }` | 201 `BoardFile`; 400 invalid name; 409 exists |
| GET `/api/boards/:name` | | 200 `BoardFile`; 404 |
| PUT `/api/boards/:name` | `IncomingScene` | 200 stored `BoardFile`; 400 invalid name or scene; 404; also writes `export/boards/<name>.md` |
| POST `/api/boards/:name/png` | raw `image/png` bytes | 204; writes `export/boards/<name>.png` |
| GET `/api/docs` | | 200 list |
| POST `/api/docs` | `{ name }` | 201; 400; 409 |
| GET `/api/docs/:name` | | 200 `text/markdown`; 404 |
| PUT `/api/docs/:name` | text body | 204; 404 |
| GET `/api/assets/:file` | | 200 bytes with content type by extension; 404 |
| GET `/api/export/boards/:name.md` | | 200 `text/markdown` generated from the stored board; 404 |

- [ ] **Step 1: Write the failing tests** (use `app.request(path, init)` on a temp-dir store; no network)

```ts
test("board lifecycle: create, list, get, put, export", async () => {
  expect((await app.request("/api/boards", post({ name: "main" }))).status).toBe(201);
  expect(await (await app.request("/api/boards")).json()).toEqual([expect.objectContaining({ name: "main" })]);
  const put = await app.request("/api/boards/main", { method: "PUT", body: JSON.stringify(sceneWithTwoBoxesAndArrow), headers: json });
  expect(put.status).toBe(200);
  const md = await (await app.request("/api/export/boards/main.md")).text();
  expect(md).toContain("flowchart LR");
  expect(existsSync(join(store.dir, "export/boards/main.md"))).toBe(true);
});
test("invalid names are rejected with 400 and nothing is written", async () => {
  for (const name of ["Main", "a b", "..", "a/b"]) {
    expect((await app.request("/api/boards", post({ name }))).status).toBe(400);
    expect((await app.request(`/api/docs/${encodeURIComponent(name)}`, { method: "PUT", body: "x" })).status).toBe(400);
  }
  expect(await readdir(join(store.dir, "boards"))).toEqual([]);
});
test("duplicate create returns 409", ...);
test("missing board or doc returns 404 with { error }", ...);
test("malformed scene returns 400", ...);              // files.f1.dataURL "data:image/png;base64,***"
test("png upload writes export/boards/<name>.png", ...);
test("docs lifecycle with text/markdown content type", ...);
test("assets are served with the right content type and 404 otherwise", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/routes.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/server/routes.ts` and `src/server/app.ts`**

`app.ts` creates the Hono app, registers routes, and maps `InvalidNameError` to 400, `InvalidSceneError` to 400, `NotFoundError` to 404, and `ExistsError` to 409 in one `onError` handler.
Content types for assets by extension: png, jpg, gif, svg, webp.
PUT on a board validates the name first, then that the board exists, then parses the scene.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/routes.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes.ts src/server/app.ts test/server/routes.test.ts
git commit -m "feat(server): REST routes for boards, docs, assets and export"
```

---

