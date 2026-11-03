# untitled (thr_6kn8beg5gw)

### Spec Compliance
- Spec compliant, with one justified test deviation. All 11 routes in the brief's table are present in `src/server/routes.ts:29-88`, under `/api` (`src/server/app.ts:22`). `createApp(store: FileStore): Hono` matches the Interfaces contract (`src/server/app.ts:20`). One `onError` handler maps the four error types to 400/404/409 (`src/server/app.ts:12-18,23-28`).
- The PUT board ordering is correct. The name is checked first, then existence, then the scene: unparseable JSON becomes `undefined` and goes to `writeBoard` (`src/server/routes.ts:37-48`). `test/server/routes.test.ts:144` checks it: unparseable JSON sent to a missing board returns 404, not 400.
- Asset content types cover png, jpg, gif, svg and webp (`src/server/routes.ts:10-16`). I checked that `readAsset` only accepts `^[0-9a-f]{64}\.(png|jpg|gif|svg|webp)$` (`src/server/files.ts:33-35,186-188`). So `CONTENT_TYPES[ext]` at `routes.ts:72` can never be undefined, and the comment there is accurate.
- All 8 test names in the brief exist word for word, and each one asserts at least what the brief's sketch asserts.
- Deviation, accepted: in the "invalid names" test, PUT `/api/docs/..` expects 404 instead of 400 (`test/server/routes.test.ts:100-103`). The cause is real: the WHATWG URL parser treats `..` and `%2E%2E` as a dot segment and resolves it before routing. `..` is still rejected with 400 through the POST `{ name }` path, and the test checks that nothing was written.
- Nothing extra was added. `routes()` is exported but only used internally by `app.ts`. No new dependencies.
- Cannot verify from the diff alone: that `pnpm check` is clean and gives 8/42 passing. I did not re-run it; the report shows clean output with no warnings.

### Strengths
- One error-mapping point (`statusFor` plus `onError`), and route handlers stay thin. All validation lives in `FileStore`, so there is one source of truth for slug rules.
- `nameFromBody` (`routes.ts:18-24`) rejects `{}`, `{name: 42}` and malformed JSON with 400. Without it, these could reach the store as the string `"undefined"`. The test covers it (`test/server/routes.test.ts:105-115`).
- The tests check real behavior on a temp-dir store with no mocks:
  - The Markdown written to disk equals the GET response (`:88`).
  - A rejected scene leaves the board file byte-for-byte unchanged and writes no export (`:189-192`).
  - `export/` stays empty after rejected requests (`:122`).
  - Every asset MIME type is checked by round-tripping through the real extraction path (`:236-265`).
- The workaround for the export route's `.md` suffix is commented, and it fails safely. `main.txt` gives 404 and `Main.md` gives 400; both are tested.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **The MIME/extension mapping is defined twice.** `CONTENT_TYPES` in `src/server/routes.ts:10-16` is the reverse of `EXTENSIONS` in `src/server/files.ts:22-28`. If someone adds a type to `files.ts` only, `readAsset` will accept the new extension, but the route will send `Content-Type: undefined`. Fix: export the map from `files.ts`, or a `contentTypeFor(file)` helper, and derive the route's lookup from it.
2. **SVG assets are served with no sandboxing headers on the API's origin** (`src/server/routes.ts:72-74`). An SVG in a cloned repo's `.blueprint/assets/` can contain script. If someone opens `/api/assets/<sha>.svg` directly in the browser, that script runs with full access to the local API, including writes. Excalidraw's `<img>` rendering is not affected. Fix: add `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff` to asset responses. This hardening fits here rather than being left for later.
3. **`POST /boards/:name/png` does not check that the board exists or that the body is a PNG** (`src/server/routes.ts:50-56`). An empty or arbitrary body for a board that does not exist is written to `export/boards/<name>.png` and returns 204. The report admits this (Concern 2). The effect is limited to the gitignored, regenerable `export/` directory, but a 404 for a missing board would match how every other `:name` route behaves.
4. **500 responses send the raw `err.message` to the client** (`src/server/app.ts:27`). For an unmapped fs error, the message includes absolute filesystem paths. This is low risk on a local server, but a generic `"internal error"` for 500s would be cleaner, since the error is already logged at `:26`.
5. **The `boardGraphToMarkdown(excalidrawToBoardGraph(board, name))` call is repeated** at `src/server/routes.ts:46` and `:83`. This is trivial now, but if Markdown generation ever gains options, the PUT write-through and the GET export could drift apart. A small `boardMarkdown(board, name)` helper would keep them the same.
6. **Unmatched `/api/*` paths return Hono's plain-text 404, not `{ error }`** (Concern 3 in the report). Deferring this to Task 7 is reasonable, but Task 7 should add an `/api/*` JSON `notFound` so the error contract holds for every path.

### Assessment
Task quality: Approved

Reasoning: Every route, status code, error mapping and test in the brief is implemented and checked against real files on disk. The only deviation (a `..` path returning 404) is forced by URL normalization and is documented in the test. The remaining items are hardening and DRY polish, and none of them blocks the task.
