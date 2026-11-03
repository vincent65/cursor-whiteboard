# Task 6 report: HTTP routes

Status: DONE_WITH_CONCERNS (one test deviation, see Concerns).

Commit: `95249b7 feat(server): REST routes for boards, docs, assets and export`

## What I implemented

- `src/server/routes.ts`: `routes(store)` returns a Hono sub-app with every route from the brief's table.
  - `POST /boards` and `POST /docs` read `{ name }`; a missing, non-string, or unparseable body is an `InvalidNameError` (400), so `{}` cannot slip through as the slug `"undefined"`.
  - `PUT /boards/:name` maps unparseable JSON to `undefined` and passes it to `writeBoard`, which keeps the brief's order: name, then existence (404), then scene (400).
    On success it writes `export/boards/<name>.md` and returns the stored `BoardFile`.
  - `POST /boards/:name/png` runs `assertSlug` and then writes the raw body bytes to `export/boards/<name>.png`, returning 204.
  - `GET /docs/:name` and `GET /export/boards/<name>.md` return `text/markdown; charset=utf-8`.
  - `GET /assets/:file` sets the content type from the extension (png, jpg, gif, svg, webp); `readAsset` has already checked that the file name is `<sha256>.<known ext>`.
  - Export route: Hono cannot match a literal `.md` suffix after a regex param (`:name{[a-z0-9-]+}.md` returned 404 when I tried it), so the route is `:file{.+\.md}` and the code strips the suffix.
    `main.txt` does not match (404), and `Main.md` reaches `readBoard`, which returns 400.
- `src/server/app.ts`: `createApp(store)` mounts the routes under `/api`.
  One `onError` handler maps `InvalidNameError`/`InvalidSceneError` to 400, `NotFoundError` to 404, `ExistsError` to 409, and any other error to 500, always as `{ error }`.
  For a 500, the handler also logs the error with `console.error`.
  `createApp` does not listen on a port and does not serve static files.

## TDD evidence

RED: `pnpm vitest run test/server/routes.test.ts`

```
FAIL  test/server/routes.test.ts [ test/server/routes.test.ts ]
Error: Cannot find module '../../src/server/app.js' imported from .../test/server/routes.test.ts
Test Files  1 failed (1)
     Tests  no tests
```

The first implementation run failed two tests because the `:name{[a-z0-9-]+}.md` export route returned 404.
After the route fix:

GREEN: `pnpm vitest run test/server/routes.test.ts`

```
Test Files  1 passed (1)
     Tests  8 passed (8)
```

`pnpm check` (tsc for both configs, biome, full vitest):

```
Checked 21 files in 28ms. No fixes applied.
Test Files  6 passed (6)
     Tests  42 passed (42)
```

## Files changed

- `src/server/routes.ts` (new)
- `src/server/app.ts` (new)
- `test/server/routes.test.ts` (new, 8 tests)

## Self-review

- Completeness: all 11 routes from the table exist and return the stated status codes. All 8 named tests exist and pass.
- The tests cover more than the brief's sketches in these places:
  - The exported Markdown on disk equals the GET response.
  - A malformed scene leaves the board file unchanged and writes no export.
  - A PUT with unparseable JSON to a missing board gives 404 (the order is kept).
  - Bad request bodies (`{}`, `{ name: 42 }`, `{`) give 400.
  - A PNG upload or export request for an invalid name gives 400.
  - Every asset content type is checked.
- Quality: there is one error mapping (`statusFor` plus `onError`) and no duplicated handlers. Name validation is done by `FileStore`, except for the PNG route, which calls `assertSlug` before it writes.
- Discipline: only the three files listed in the brief. I added no routes, no `notFound` handler, and no dependencies.

## Concerns

1. The brief's "invalid names" test cannot pass verbatim for `".."` on the PUT doc route.
   The WHATWG URL parser in `Request` resolves a `..` segment (also when written as `%2E%2E`) before routing.
   So `/api/docs/..` becomes `/api/`, which matches no route and returns Hono's default 404.
   The test therefore expects 404 for `".."` on that request and 400 for the other names, and a comment in the test explains why.
   `".."` is still rejected with 400 through the POST `{ name }` path, and the test confirms that nothing is written.
   No HTTP client that parses URLs can send `..` to the handler, so this is not a security gap.
2. `POST /api/boards/:name/png` does not check that the board exists, because the brief's table lists only 204.
   A PNG for a board that does not exist would be written to `export/` (a regenerable, gitignored directory).
   If this is not wanted, add a 404 check later. That would need a `FileStore` existence check or a `readBoard` call.
3. Requests that match no route (for example `/api/nope` or `main.txt`) get Hono's default plain-text 404, not `{ error }`.
   I left this alone so that Task 7 can mount static and UI routes without a catch-all getting in the way.
