# M0 final review: fix report

Branch `m0-skeleton`, base `d260d75`.
All five findings are fixed in five commits, each with no trailer:

| Commit | Subject | Finding |
|---|---|---|
| `f1cdee1` | fix(server): refuse non-loopback Hosts and cross-origin writes and websocket upgrades | #1 |
| `a7cd1c2` | fix(server): accept every image type Excalidraw does and sandbox served assets | #2 (server), #5 |
| `145a574` | fix(ui): save only the files that live image elements use | #2 (UI) |
| `2b36862` | fix(ui): slugify new board and doc names with a rule shared with the server | #4 |
| `f716321` | fix(ui): ask before leaving a view whose disk conflict would drop local edits | #3 |

Finding 2's server half and finding 5 share one commit because both change the same asset route test.

## Important #1: cross-origin writes and DNS rebinding

### Change

`src/server/app.ts` adds a `sameOrigin` middleware, registered first in `createApp`.
- It rejects any request with 403 `{ "error": "forbidden" }` when the hostname in `Host` is not `localhost`, `127.0.0.1` or `[::1]`, or when `Host` cannot be parsed.
- For non-GET/HEAD requests and for WebSocket upgrades, it also rejects a request whose `Origin` header is present and is not `http://<Host>`.
- Requests with no `Origin` pass, as the finding specifies.
- `app.request()` sends no `Host`, so the middleware falls back to the request URL's host there; a real Node server always has a `Host` header.

The WebSocket upgrade path is covered by the same middleware.
`@hono/node-ws`'s `injectWebSocket` sends every upgrade through `app.request(url, { headers })` with the original `Host` and `Origin` headers (checked in `node_modules/@hono/node-ws/dist/index.js`) and writes the 403 back on the socket.
I did not add a second check in `startServer`, because it would duplicate this one.
The ws test below exercises the real server.

**Deviation: the Host port is not pinned to the bound port.**
`Origin` is compared to the request's own `Host`, not to `localhost:<bound port>`.
Pinning the port would break `pnpm dev`: the Vite proxy forwards `Host: localhost:5173` and `Origin: http://localhost:5173`.
Pinning also adds no protection.
A rebinding attack shows up as a non-loopback hostname, and a page on another local port is refused because its `Origin` differs from `Host`.
This is checked by the `http://localhost:3000` case and by the browser test below.
The comment above the middleware records the reasoning.

### Tests

`test/server/routes.test.ts`, "writes need a loopback Host and, when sent, a same-origin Origin":
- A `text/plain` POST from `Origin: https://attacker.example` returns 403 `{ error }`.
- A POST from `Origin: http://localhost:3000` (another local port) returns 403.
- A same-origin POST (`Host: localhost:4242`, `Origin: http://localhost:4242`) returns 201.
- Origin-less POSTs with `Host: 127.0.0.1:4242` and with `Host: [::1]:4242` return 201.
- A GET with `Host: attacker.example:4242` or `Host: localhost.attacker.example` returns 403.
- A GET with no Host still returns 200.
- Only the three allowed boards exist on disk afterwards.

`test/server/ws.test.ts`, "refuses websocket upgrades from other origins": a raw HTTP upgrade to the real server with `Origin: https://attacker.example` gets 403, and with `Origin: http://127.0.0.1:<port>` gets 101.

### Command and output

Red, before the middleware: `pnpm vitest run test/server/routes.test.ts test/server/ws.test.ts`
```
 FAIL  test/server/routes.test.ts > ... AssertionError: expected 201 to be 403
 FAIL  test/server/ws.test.ts > startServer > refuses websocket upgrades from other origins
AssertionError: expected 101 to be 403 // Object.is equality
 Test Files  2 failed (2)
      Tests  2 failed | 12 passed (14)
```
Green: `pnpm vitest run test/server`
```
 Test Files  4 passed (4)
      Tests  27 passed (27)
```

## Important #2: one unsupported image breaks every later save

### Change, server

In `src/server/files.ts`, `EXTENSIONS` now covers every image type Excalidraw accepts:

| MIME type | Stored as |
|---|---|
| png | `png` |
| jpeg | `jpg` |
| jfif | `jpg` (JFIF is JPEG data, so it shares content-addressed files with JPEG and is served as `image/jpeg`) |
| gif | `gif` |
| svg+xml | `svg` |
| webp | `webp` |
| bmp | `bmp` |
| avif | `avif` |
| x-icon | `ico` |

`ASSET_FILE` is built from this map, so it accepts the new extensions.
In `src/server/routes.ts`, `CONTENT_TYPES` adds `bmp`, `avif` and `ico`.

### Change, UI

`toSaveBody` in `src/ui/board/scene.ts` collects the `fileId`s of image elements that are not deleted.
It sends only the files whose id is in that set.
Excalidraw keeps a file in its map after the image is deleted, so a rejected file no longer travels with every later save.

### Tests

Server: in `test/server/routes.test.ts`, the assets test (renamed "assets are served sandboxed with the right content type and 404 otherwise") now uploads all nine MIME types in one PUT.
It checks each `[uploaded as, stored as, served as]` triple.

UI: `test/ui/scene.test.ts`, "toSaveBody sends only files used by live image elements".
The body keeps the file of a live image and drops the files of a deleted image and an orphan.

### Command and output

Red, server: `pnpm vitest run test/server/routes.test.ts`
```
 FAIL  test/server/routes.test.ts > assets are served sandboxed with the right content type and 404 otherwise
AssertionError: expected 400 to be 200 // Object.is equality
      Tests  1 failed | 8 passed (9)
```
Red, UI: `pnpm vitest run test/ui/scene.test.ts`
```
 FAIL  test/ui/scene.test.ts > toSaveBody sends only files used by live image elements
AssertionError: expected [ 'kept', 'deleted', 'orphan' ] to deeply equal [ 'kept' ]
      Tests  1 failed | 3 passed (4)
```
Green, both: `pnpm vitest run test/server` gave `Tests  27 passed (27)`, and `pnpm vitest run test/ui/scene.test.ts` gave `Tests  4 passed (4)`.

## Important #3: leaving during a disk conflict drops edits silently

### Change

The hash router moved from `src/ui/App.tsx` to `src/ui/hooks/useHashRoute.ts` as `useHashRoute(wouldLoseEdits: () => boolean)`.
On `hashchange`, if `wouldLoseEdits()` is true, it calls `window.confirm("This file changed on disk while you had unsaved edits. Leave and discard your edits?")`.
- If the user declines, the hook calls `history.replaceState(..., ev.oldURL)` to put the old URL back without firing another `hashchange`, and keeps the route.
- If the user confirms, the route switches and the existing behavior is kept: the unmount flush still skips the save while the conflict is open.

`App` keeps a `conflictOpen` ref and passes a stable `onConflictChange` callback to `BoardView` and `DocView`.
Each view reports its `conflict` state in an effect and resets it to `false` on unmount.
Sidebar links and the post-create navigation both go through `hashchange`, so both are guarded.

### Tests

`test/ui/useHashRoute.test.ts` (jsdom), "follows the hash and, while edits would be lost, leaves only on confirm":
- With nothing to lose, the route follows the hash and `confirm` is not called.
- When edits would be lost and the user declines, the route and `location.hash` stay on the old file.
- When the user confirms, the route switches.

### Command and output

Red: `pnpm vitest run test/ui/useHashRoute.test.ts`
```
Error: Failed to resolve import "../../src/ui/hooks/useHashRoute" from "test/ui/useHashRoute.test.ts". Does the file exist?
```
Green: the same command gave `Tests  1 passed (1)`.

## Important #4: a normal name fails with a raw error

### Change

New file `src/shared/slug.ts` exports two things:
- `SLUG_RE`, the existing `/^[a-z0-9][a-z0-9-]*$/`.
- `slugify(input)`, which lowercases, turns whitespace runs into dashes, strips everything else, collapses repeated dashes, and trims a leading and a trailing dash.

`assertSlug` in `src/server/files.ts` now uses `SLUG_RE`.
`NavSection.create` in `src/ui/nav/Sidebar.tsx` slugifies the prompt result.
- A cancelled or blank prompt does nothing.
- If no slug remains, it alerts "A board name needs at least one letter or digit." (or doc).
- Otherwise it calls `onCreate` with the slug.

Slight extension: `slugify` also trims a trailing dash, so "Plan -" becomes `plan`, not `plan-`.
The server rule still allows trailing dashes, so this only affects names typed in the UI.

### Tests

`test/ui/Sidebar.test.tsx`, "turns a typed name into a slug and alerts only when none remains":
- "My Board" becomes `my-board`.
- `"  --Q3   Plan: v2!! "` becomes `q3-plan-v2`.
- "!!!" alerts once and creates nothing.
- A cancelled prompt does nothing.

The existing server test "invalid names are rejected with 400" still passes against the shared regex.

### Command and output

Red: `pnpm vitest run test/ui/Sidebar.test.tsx`
```
 FAIL  test/ui/Sidebar.test.tsx > turns a typed name into a slug and alerts only when none remains
AssertionError: expected last "vi.fn()" call to have been called with [ 'my-board' ]
      Tests  1 failed | 1 passed (2)
```
Green: `pnpm vitest run test/ui/Sidebar.test.tsx test/server` gave `Tests  29 passed (29)`.

## Important #5: SVG assets served without sandboxing

### Change

The `/assets/:file` response in `src/server/routes.ts` now adds `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`.

### Tests

The assets route test asserts both headers on every one of the nine asset types.

### Command and output

Red, after the MIME fix: `pnpm vitest run test/server/routes.test.ts`
```
 FAIL  test/server/routes.test.ts > assets are served sandboxed with the right content type and 404 otherwise
AssertionError: expected null to be 'default-src \'none\'; sandbox' // Object.is equality
      Tests  1 failed | 8 passed (9)
```
Green: `pnpm vitest run test/server` gave `Tests  27 passed (27)`.

## Manual verification

`pnpm build` succeeded.
Its only warning is Vite's existing chunk-size warning for the Excalidraw bundle (1.9 MB), which predates these changes.

I ran `node dist/cli/index.js --no-open --port 4317` in a scratch `git init` repository under `$TMPDIR`, and it printed `Blueprint running at http://localhost:4317`.

curl results:
- A `text/plain` POST to `/api/boards` with `Origin: https://attacker.example` returned `HTTP/1.1 403 Forbidden` `{"error":"forbidden"}`.
- A GET with `Host: attacker.example:4317` returned `HTTP/1.1 403 Forbidden`.
- A WebSocket upgrade with `Origin: https://attacker.example` returned `HTTP/1.1 403 Forbidden`.
- A plain GET of `/api/boards` returned `200 []`, and `.blueprint/boards` was still empty.

Browser results (Playwright MCP Chromium):
- The app loaded with no console errors or warnings.
- I clicked "New board" and entered "My Board" at the prompt.
- The URL became `#/boards/my-board`, and the sidebar shows `my-board` as the active board. The screenshot looked correct, with the sidebar, the Excalidraw toolbar and the right pane laid out normally.
- I drew a rectangle. The browser sent `PUT /api/boards/my-board 200` and `POST /api/boards/my-board/png 204`. The board file holds `['rectangle']`, and `export/boards/my-board.md` and `.png` exist.
- A same-origin `new WebSocket(ws://localhost:4317/ws)` opened.
- From a page on `http://127.0.0.1:4317` (a different origin), a `no-cors` `text/plain` POST to `http://localhost:4317/api/boards` was answered 403. The console shows `Failed to load resource: ... 403 (Forbidden)`, and no `from-other-origin` board was created.

I stopped the server afterwards: `kill 13010`, after which `curl` got connection refused.
I also closed the browser.

Tooling notes:
- The gstack `/browse` daemon could not start inside the Bash sandbox (Chromium `bootstrap_check_in ... Permission denied`), so I used the Playwright MCP browser.
- The failed `/browse` start had added `.gstack/` to the repo's `.gitignore` and created `.gstack/`. I reverted both, and the working tree is clean.

## `pnpm check`

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 51 files in 50ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard

 Test Files  14 passed (14)
      Tests  62 passed (62)
```
The full Vitest output has no stderr, warnings or errors (checked with `grep -iE "stderr|warn|error"`, which found nothing).
