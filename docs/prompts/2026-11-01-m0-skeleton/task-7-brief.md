### Task 7: WebSocket hub, file watcher, and server start

**Files:**
- Create: `src/server/ws.ts`, `src/server/watch.ts`, `src/server/index.ts`, `src/shared/messages.ts`
- Test: `test/server/ws.test.ts`, `test/server/watch.test.ts`

**Interfaces:**
- Produces (`src/shared/messages.ts`): `export type ServerMessage = { type: "file-changed"; kind: "board" | "doc"; name: string }`.
- Produces (`src/server/ws.ts`): `class WsHub { add(socket: { send(data: string): void }): void; remove(socket): void; broadcast(msg: ServerMessage): void; get size(): number }`.
- Produces (`src/server/watch.ts`): `watchPlan(store: FileStore, onChange: (ev: { kind: "board" | "doc"; name: string }) => void): () => Promise<void>`.
- Produces (`src/server/index.ts`): `startServer(opts: { root: string; port: number; uiDir?: string }): Promise<{ port: number; close(): Promise<void> }>` which serves `createApp`, the `/ws` endpoint, the UI directory with an `index.html` fallback, and wires the watcher to the hub.

- [ ] **Step 1: Write the failing tests**

```ts
test("hub broadcasts JSON to every socket and drops removed ones", () => {
  const a = { send: vi.fn() }, b = { send: vi.fn() };
  hub.add(a); hub.add(b); hub.remove(b);
  hub.broadcast({ type: "file-changed", kind: "doc", name: "notes" });
  expect(a.send).toHaveBeenCalledWith(JSON.stringify({ type: "file-changed", kind: "doc", name: "notes" }));
  expect(b.send).not.toHaveBeenCalled();
});
test("watcher reports an external doc write and ignores the server's own write", async () => {
  // start watchPlan; await store.writeDoc("a", "x") -> no event within 300ms
  // then writeFile(join(store.dir, "docs", "b.md"), "y") directly -> event { kind: "doc", name: "b" } within 1500ms
});
test("watcher maps board files to kind board and strips the extension", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/ws.test.ts test/server/watch.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the hub, the watcher, and `startServer`**

Watcher: chokidar on `boards/` and `docs/` with `ignoreInitial: true` and `awaitWriteFinish: { stabilityThreshold: 100 }`; ignore paths for which `store.wasWrittenRecently(path, 1000)` is true; map `*.excalidraw.json` to board and `*.md` to doc.
Server: `@hono/node-ws` `createNodeWebSocket` for `/ws`; sockets join the hub on open and leave on close; the UI handler reads files from `uiDir` with a small extension-to-type map and falls back to `index.html` for unknown paths that do not start with `/api`; `close()` stops the watcher and the HTTP server.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server`
Expected: PASS for all server tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/ws.ts src/server/watch.ts src/server/index.ts src/shared/messages.ts test/server/ws.test.ts test/server/watch.test.ts
git commit -m "feat(server): websocket hub, plan watcher and server start"
```

---

