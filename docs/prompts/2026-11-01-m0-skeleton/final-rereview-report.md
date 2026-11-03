### Finding Verdicts

**Important #1: cross-origin writes - ADDRESSED.**
`src/server/app.ts:29-45` adds the `sameOrigin` middleware and `src/server/app.ts:50` registers it before the API routes. It returns 403 when the Host hostname is not `localhost`, `127.0.0.1` or `[::1]`, and for non-GET/HEAD requests and WebSocket upgrades it also rejects a present Origin that differs from `http://<Host>`. The upgrade path is covered because `@hono/node-ws` forwards every incoming header through `app.request` (confirmed in `node_modules/@hono/node-ws/dist/index.js`). Tests: `test/server/routes.test.ts:94-133` covers the cross-origin 403, the other-local-port 403, the same-origin 201, Origin-less 201s for both loopback forms, and the wrong-Host 403. `test/server/ws.test.ts:75-101` drives a raw upgrade against the real server. The report shows these failing red and the server suite passing green. The deviation from pinning the bound port is acceptable in principle, but see New Breakage: the dev-proxy reasoning given for it is wrong.

**Important #2: unsupported image poisons every save - ADDRESSED.**
Server: `src/server/files.ts:26-37` extends the MIME map with jfif, bmp, avif and x-icon, and `ASSET_FILE` is derived from it. `src/server/routes.ts:16-18` adds the served content types. UI: `src/ui/board/scene.ts:44-54` collects fileIds of non-deleted image elements and filters the files map to those. Tests: `test/server/routes.test.ts:277-313` uploads all nine types in one PUT and checks stored extension and served type. `test/ui/scene.test.ts:23-41` checks a deleted image's file and an orphan are dropped. Both red/green runs are shown.

**Important #3: leaving during a conflict drops edits silently - ADDRESSED.**
`src/ui/hooks/useHashRoute.ts:16-27` asks `window.confirm` on `hashchange` when the active view reports a conflict, and on decline restores the old URL with `replaceState` so the view stays mounted and no unmount flush runs. `src/ui/App.tsx:11-15` holds the flag in a ref with a stable callback. `src/ui/board/BoardView.tsx:87-90` and `src/ui/docs/DocView.tsx:65-68` report the conflict state and reset it on unmount. Confirming keeps the old behavior. Test: `test/ui/useHashRoute.test.ts:14-40` covers no-conflict, decline, and confirm. Red/green shown.

**Important #4: normal name fails with a raw error - ADDRESSED.**
`src/shared/slug.ts:2-11` holds the shared regex and `slugify`. `src/server/files.ts:46` validates with the shared regex. `src/ui/nav/Sidebar.tsx:12-18` slugifies the prompt result and alerts only when nothing remains. Test: `test/ui/Sidebar.test.tsx:30-60` covers "My Board" producing `my-board`, a messy name, an all-punctuation name, and a cancelled prompt. Red/green shown.

**Important #5: SVG assets without sandboxing - ADDRESSED.**
`src/server/routes.ts:81-82` adds the CSP and nosniff headers to the asset response. `test/server/routes.test.ts:309-312` asserts both on every asset type. Red/green shown.

### New Breakage in the Fix Diff

**Important - `src/server/app.ts:29-45` rejects every write under `pnpm dev`.**
Vite's string proxy shorthand sets `changeOrigin: true` (confirmed at `node_modules/vite/dist/node/chunks/node.js:19895-19898`), and `vite.config.ts:11` uses that shorthand for `/api/`. So in dev the server receives `Host: localhost:4242` with `Origin: http://localhost:5173`. The middleware treats that as a cross-origin write and returns 403. Every board PUT, doc PUT, and create from the dev UI fails. The fix's own test proves the outcome: the "other-port" case at `test/server/routes.test.ts:108-115` sends exactly this header pair and expects 403. The report's claim that the proxy forwards `Host: localhost:5173` is true only for the `/ws` entry, which uses the object form. The manual verification ran the built CLI, not `pnpm dev`, so this was never exercised. Fix either by giving the `/api/` proxy entry the object form with `changeOrigin: false` or by allowing an Origin whose hostname is loopback, and add a note or test so the dev proxy stays aligned.

**Minor - `src/server/app.ts:30` uses `URL.parse`, which exists only from Node 22.1.**
`package.json:9` declares `>=22`. On Node 22.0.0 every request throws and 500s. Either bump the engine range to `>=22.1` or wrap `new URL` in a try.

### Out-of-Scope Observations

None.

### Verdict

Findings remain open: all five original findings are addressed, but the fix introduces one Important breakage (the dev proxy now gets 403 on every write) and one Minor (Node 22.0 incompatibility). The Important item blocks this round.
