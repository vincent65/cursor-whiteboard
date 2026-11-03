# untitled (thr_aq5aah3nug)

I've finished going through the brief, the report and the diff, and checked the store and `@hono/node-ws` internals. Here is the review.

### Spec Compliance
- **Spec compliant.**
  - `ServerMessage` (`src/shared/messages.ts:1-5`), `WsHub` with `add`/`remove`/`broadcast`/`size` (`src/server/ws.ts:5-24`), `watchPlan(store, onChange): () => Promise<void>` (`src/server/watch.ts:21-24`) and `startServer(opts): Promise<{ port; close() }>` (`src/server/index.ts:27-31`) all match the Interfaces block exactly.
- **All three tests the brief lists exist and assert what it says.**
  - The hub test is at `test/server/ws.test.ts:9-22`.
  - The own-write versus external-write test is at `test/server/watch.test.ts:66-74`, with a 300 ms negative window and a 1500 ms positive bound.
  - The board mapping test is at `test/server/watch.test.ts:76-79`.
- **The watcher follows the brief.**
  - It sets `ignoreInitial`, `awaitWriteFinish: { stabilityThreshold: 100 }` and `wasWrittenRecently(path, 1000)`, and maps the two suffixes (`src/server/watch.ts:7-17, 25-41`).
- **The server follows the brief.**
  - It uses `createNodeWebSocket`, joins the hub on open and leaves on close, has an extension map, falls back to `index.html` except under `/api`, and `close()` stops both the watcher and the HTTP server (`src/server/index.ts:35-89`).
- **Deviations the brief did not specify, all disclosed in the report:**
  - The watcher polls (`usePolling: true, interval: 100`) at `watch.ts:30-31`.
  - The server binds to `127.0.0.1` only (`index.ts:68-73`).
  - There is a JSON 404 for `/api/*` (`index.ts:47`).
  - The `/api/*` 404 is needed so the UI fallback does not answer API calls. I don't count it as unrequested scope.
- **Cannot verify from the diff:**
  - Whether the `127.0.0.1` binding works with Task 8's `http://localhost:<port>` banner and Task 9's Vite proxy when `localhost` resolves to `::1` first. That is deferred to those tasks.
  - The reported clean `pnpm check` output, which I did not re-run.

### Strengths
- **The hub is minimal and correct.** I checked that `@hono/node-ws` 1.3.1 passes the same `ctx` object to `onOpen` and `onClose` (`node_modules/@hono/node-ws/dist/index.js:94-136`). So `hub.remove(ws)` really removes the socket and the Set does not leak closed sockets.
- **Temp files cannot be mistaken for docs or boards.** The store names temp files `${path}.tmp-<hex>` (`src/server/files.ts:238`), so they never end in `.md` or `.excalidraw.json`. The `ignored` predicate (`watch.ts:35`) is therefore sound, and the store records the final absolute path before `rename` (`files.ts:241`). That is the same path form chokidar reports, because the watcher is rooted at `join(store.dir, ...)`.
- **The UI handler blocks path traversal.**
  - It decodes the path and checks containment against `uiDir + sep` (`index.ts:52-58`).
  - Double-encoded input such as `%252e%252e%252f` is decoded twice, once by Hono and once by `decodeURIComponent`, but the result is still caught by the containment check.
  - Null bytes reject inside `readFile`, which is `async`, and `readOrNull` catches them.
  - There is a regression test for traversal at `ws.test.ts:66`.
- **Startup and shutdown are ordered well.**
  - The watcher starts only after `listen` succeeds, so a port conflict leaves nothing to clean up (`index.ts:68-77`).
  - `close()` terminates websocket clients so that `server.close` does not hang (`index.ts:83`).
- **Binding to loopback is the right default** for an API that writes the user's files.
- **The tests are real, not mocks.** They use real chokidar, a real HTTP server and a real `WebSocket` client. Timers are cleared and there are no fixed sleeps except the 300 ms window the brief requires.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **The own-write suppression test can pass even if suppression is broken** (`test/server/watch.test.ts:67-69`).
   - With polling at 100 ms plus `awaitWriteFinish` (threshold 100 ms, poll 100 ms), detection takes about 100 to 300 ms when the machine is idle. The report notes a load average of about 6.5 on this machine.
   - If an unsuppressed event for `a` arrives after the 300 ms window, the test still passes. The event lands in `events` after the assertion has already run.
   - The implementer's mutation check caught the regression in 5 of 5 runs, but that depends on timing.
   - **Fix:** after `expect(await next)` for `b`, assert again that `events` contains nothing for `a`. By then a late `a` event would almost certainly have arrived.
2. **Polling is a production decision driven by the test environment** (`src/server/watch.ts:27-31`).
   - It adds a 100 ms `stat` poll for every watched file for as long as the server runs, and the main reason given is FSEvents latency and `EMFILE` inside the agent sandbox.
   - It is cheap for a small `.blueprint/` directory and is clearly commented. Still, the controller should decide it on purpose rather than inherit it by default.
3. **Server writes can be reported as external changes under load** (`src/server/watch.ts:38`, brief-mandated window).
   - The 1000 ms suppression window is measured from just before `rename` (`files.ts:241`).
   - If polling plus write-stabilization takes longer than 1 s under heavy load, the server's own save is reported back to clients as an external change.
   - The brief mandates 1000 ms, so this is only a note.
4. **Startup can miss early changes, and the tests have to work around it** (`src/server/index.ts:75-77`).
   - `watchPlan` returns before chokidar's initial scan finishes, so files written in the first moments after `startServer` resolves are treated as initial state and produce no event.
   - The tests work around this with probe-and-retry loops (`watch.test.ts:33-44`, `ws.test.ts:84-95`), which adds complexity to both files.
   - Fixing it properly means changing the contract, as the report says. Worth raising before Task 8 depends on it.
5. **There is no test that a socket leaves the hub on close** (`index.ts:44`).
   - The brief requires leave-on-close. It works, as checked above, but nothing tests it.
   - A short check after `ws.close()` in `ws.test.ts:103` would cover it. It would need a way to see the hub's size, so it may not be worth it.
6. **`close()` can leave the HTTP server open** (`index.ts:81-86`).
   - If `stopWatching()` rejects, the code never reaches the client termination or `server.close`. In practice chokidar's `close()` does not reject, so this is low risk.

### Assessment
**Task quality: Approved**

**Reasoning:** All four contracts match the brief exactly, the required tests exist and exercise real behavior, and the path-containment and hub-lifecycle risks I named check out as correct. What remains is test-timing strength and design choices the controller should confirm, mainly polling and the watcher-readiness gap. None of it blocks the task.
