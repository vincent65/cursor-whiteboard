# Task 7 report: WebSocket hub, file watcher, and server start

Status: DONE_WITH_CONCERNS

Commit: `8d69199 feat(server): websocket hub, plan watcher and server start`

## What I implemented

- `src/shared/messages.ts`: `ServerMessage = { type: "file-changed"; kind: "board" | "doc"; name: string }`.
- `src/server/ws.ts`: `WsHub` with `add`, `remove`, `broadcast` (serializes the message once and sends it to every socket), and a `size` getter, backed by a `Set`.
- `src/server/watch.ts`: `watchPlan(store, onChange): () => Promise<void>`.
  It runs chokidar on `boards/` and `docs/` with `ignoreInitial: true` and `awaitWriteFinish: { stabilityThreshold: 100 }`.
  It handles `add` and `change` events and skips any path for which `store.wasWrittenRecently(path, 1000)` is true.
  It maps `*.excalidraw.json` to `board` and `*.md` to `doc`, with the extension removed.
  An `ignored` predicate skips files that match neither suffix, such as the store's `.tmp-*` files, which disappear partway through a write.
  The returned function closes the watcher.
- `src/server/index.ts`: `startServer({ root, port, uiDir? }): Promise<{ port; close() }>`.
  - It creates a `FileStore`, runs `init()`, and builds the app from `createApp(store)`.
  - `/ws` uses `createNodeWebSocket` from `@hono/node-ws`. A socket joins the hub on open and leaves it on close.
  - `app.all("/api/*")` returns `{ error: "not found" }` with status 404. It is registered before the UI fallback.
  - The UI handler decodes the path, resolves it inside `uiDir`, and serves the file with the content type from the extension map (html, js, css, map, png, svg, ico, woff2, json; anything else is `application/octet-stream`).
    A path outside `uiDir` (for example `/..%2f`) never reads its file. Unknown, missing, and outside paths get `index.html`.
    If `index.html` does not exist, or `uiDir` is not set or does not exist, the response is a 404.
  - It listens with `serve` from `@hono/node-server` on `127.0.0.1` only (see Concerns), rejects on a listen error, and then calls `injectWebSocket(server)`.
  - It connects the watcher to the hub as `file-changed` broadcasts.
  - `close()` stops the watcher, terminates open websocket clients so that `server.close` does not hang, and resolves when the HTTP server has closed.

## TDD evidence

RED: `pnpm vitest run test/server/ws.test.ts test/server/watch.test.ts`

```
 FAIL  test/server/watch.test.ts [ test/server/watch.test.ts ]
Error: Cannot find module '../../src/server/watch.js' imported from .../test/server/watch.test.ts
 FAIL  test/server/ws.test.ts [ test/server/ws.test.ts ]
Error: Cannot find module '../../src/server/index.js' imported from .../test/server/ws.test.ts
 Test Files  2 failed (2)
      Tests  no tests
```

GREEN: `pnpm vitest run test/server` (I ran it more than 5 times, and every run passed)

```
 Test Files  4 passed (4)
      Tests  25 passed (25)
```

`pnpm check` (both tsc projects, biome, and all of vitest) completed with no warnings:

```
Checked 27 files in 11ms. No fixes applied.
 Test Files  8 passed (8)
      Tests  48 passed (48)
```

I also ran mutation checks to confirm that the tests catch real regressions:
- When I removed the `wasWrittenRecently` check, the "ignores the server's own write" test failed in 5 of 5 runs. The 300 ms window catches an event that is not suppressed.
- When I removed the UI path-containment guard, the UI test failed: `/..%2fsecret.txt` returned the file outside `uiDir`.

`--reporter=hanging-process` reported no open handles after the server tests.

## Tests

- `test/server/ws.test.ts`
  - The hub test from the brief, plus a check of `size`.
  - `startServer`, using a temporary root on port 0:
    - The API works. `/api/nope` returns a 404 with JSON `{ error: "not found" }`. A missing UI directory returns a 404 and does not crash the server.
    - UI files are served with the correct content type. `/`, `/boards/main`, and a traversal attempt all get `index.html`. `/api/missing` is still a 404.
    - A real `WebSocket` client receives `file-changed` for an external write to a doc.
- `test/server/watch.test.ts`: the two watcher tests from the brief.
  Waits use a promise that resolves from the callback, with a 1500 ms timeout that is cleared. The test asserts that no event for `a` arrives within 300 ms after `store.writeDoc("a", ...)`.

## Files changed

- `src/shared/messages.ts` (new)
- `src/server/ws.ts` (new)
- `src/server/watch.ts` (new)
- `src/server/index.ts` (new)
- `test/server/ws.test.ts` (new)
- `test/server/watch.test.ts` (new)

## Self-review findings

- `WsHub`, `watchPlan`, `startServer`, and `ServerMessage` match the signatures in the brief.
- I found no leaked timers or watchers. Every timeout is cleared or awaited, `afterEach` stops the watcher and closes the server, and the hanging-process reporter is clean.
- No extra files. No new dependencies.
- I fixed one finding during review: the first version of the UI handler copied each file into a new `Uint8Array`. It now passes the `Buffer` directly, so the multi-MB Excalidraw bundle is not copied on each request.

## Concerns (decisions the brief did not cover)

1. **Polling watcher (`usePolling: true, interval: 100`).** The brief does not specify this option.
   On this machine, raw `fs.watch` (FSEvents) took 1.5 to 3.5 s to deliver an event, or delivered nothing within 4 s.
   I reproduced this with a plain Node one-liner outside chokidar. The load average was about 6.5.
   Inside the agent sandbox, `fs.watch` fails with `EMFILE`, so `pnpm check` cannot pass with native events when it runs in the sandbox.
   Polling a small `.blueprint` directory is cheap, its latency is bounded (about 300 to 400 ms including `awaitWriteFinish`), and it works in sandboxes and on network or container mounts.
   If native events are preferred later, removing the two option lines is the only change. However, the 1500 ms test bound would then depend on the health of FSEvents.
2. **Watcher readiness.** `watchPlan` returns its stop function synchronously, as the contract requires, so a caller cannot wait for chokidar's initial scan.
   If a file is written before the scan finishes, chokidar counts it as initial state and reports no event. Without a wait, the board test from the brief failed every time.
   The tests handle this without sleeps. `watch.test.ts` writes a probe doc until the watcher reports it. The `startServer` websocket test writes until a message arrives, with at most 5 attempts.
   The same gap exists in production: changes made in the first few milliseconds after `startServer` resolves can be missed.
   If that matters, change `watchPlan` to resolve after chokidar's `ready` event and have `startServer` await it. This is a contract change, so I did not make it.
3. **Loopback binding.** `startServer` binds to `127.0.0.1`. The default would bind every interface, which would expose read and write access to the user's files to the LAN.
   Task 8's banner says `http://localhost:<port>`. Browsers and Node 22's `autoSelectFamily` (used by the Vite proxy) fall back from `::1` to `127.0.0.1`, so this should work. Task 8 and Task 9 should still confirm it.
4. **No `unlink` events.** Deleting a doc or board outside the server sends no message. The brief and `ServerMessage` only describe changes. Add an event when the UI needs to react to deletions.
5. **Running the tests needs filesystem access the sandbox allows.** Because of the polling change, the tests now pass inside the sandbox as well as outside it.
