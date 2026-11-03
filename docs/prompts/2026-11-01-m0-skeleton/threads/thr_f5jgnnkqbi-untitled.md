# untitled (thr_f5jgnnkqbi)

Approved: the task matches its brief and nothing I found blocks it. I'm finishing the write-up now. I read the brief, the report and the diff, and checked the server routes, the test config and the plan's design tokens. I did not re-run any tests.

### Spec Compliance
- **Spec compliant.**
  - Every file the brief lists exists. Two extra stub files, `src/ui/board/BoardView.tsx` and `src/ui/docs/DocView.tsx`, are required by the brief ("stub them as empty components here"). Their paths match the plan's paths for Tasks 10 and 11 (plan lines 696 and 742).
  - All 11 functions in the brief's `api.ts` list exist with the listed parameters and return types (`src/ui/api.ts:26-95`). The `Sidebar` props match the brief exactly (`src/ui/nav/Sidebar.tsx:43-55`).
  - The test matches the brief's test word for word (`test/ui/Sidebar.test.tsx:6-28`). It has the `// @vitest-environment jsdom` header, and it checks `aria-current="page"`, the `#/docs/notes` href, and the `onCreateBoard("new-board")` call.
  - `vite.config.ts:4-16` has `root`, `outDir` with `emptyOutDir`, the React plugin, the `IS_PREACT` define, the `/api` proxy, and the `/ws` proxy with `ws: true`.
  - The right pane text is exactly "The Claude panel arrives in milestone 1." (`src/ui/App.tsx:76`). Routing uses `#/boards/<name>` and `#/docs/<name>`. The default route goes to the first board, or shows an empty state when there are none (`App.tsx:41-44`, `App.tsx:71-73`).
  - The sidebar loads the lists on mount and again after each create (`App.tsx:31-39`, `App.tsx:46-54`).
- **Checks I ran on contracts:**
  - Every REST path and method in `api.ts` matches `src/server/routes.ts:29-69`: `POST /boards/:name/png`, `POST /docs` returns 201 with no body, `PUT /docs/:name` reads the raw text, and `GET /assets/:file` exists.
  - `listBoards` and `listDocs` return `{ name, updatedAt }[]` (`files.ts:89`, `files.ts:166`), which matches `Entry`.
  - The `asset` field is stored as `assets/<sha>.<ext>` (`files.ts:144`), so `assetUrl` produces `/api/assets/<sha>.<ext>`, which is a valid route.
  - The server mounts `/ws` (`index.ts:39-40`).
  - Server errors come back as `{ error }` JSON (`app.ts:27`), which is what `request()` reads.
  - The colors, 240px left rail and 360px right pane in `styles.css:1-14` match the plan's fallback tokens (plan lines 41-44).
  - `vitest.config.ts` turns on `globals` and a setup file, so the test's bare `test`, `vi` and `toHaveAttribute` resolve.
  - The commit message follows conventional commits and has no co-author trailer.
- **Cannot verify from the diff:** the build output, the end-to-end Playwright run and the screenshots. These are in the report only, and I did not re-run them.

### Strengths
- The `api.ts` client is small. It has one `request` helper that turns a server `{ error }` body into an `Error` the user can read (`api.ts:7-19`).
- `connectWs` behaves correctly:
  - The retry delay doubles up to a 10 s cap.
  - The delay resets when the socket opens.
  - The disposer cancels any pending reconnect and stops further reconnects (`api.ts:70-95`).
- `boards: null` means "still loading". This stops the redirect and the empty state from flashing before the list arrives (`App.tsx:28`, `App.tsx:42`, `App.tsx:71`).
- `BoardView` and `DocView` take `key={route.name}`, so moving to another board or doc mounts a fresh view.
- The layout uses only the CSS custom properties. Links and buttons have a visible focus outline.
- The implementer's pixel fix (a transparent border on links so they line up with the buttons) shows real attention to the end-to-end result.

### Issues

#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **Route names reach the URL without validation.**
   - `parseRoute` accepts any `[^/]+` (`App.tsx:10`), and `api.ts` puts names into paths without `encodeURIComponent` (`api.ts:33`, `api.ts:38`, `api.ts:41`, `api.ts:57`, `api.ts:60`).
   - Example: `#/boards/main?x=1` gives the route name `main?x=1`. That calls `GET /api/boards/main?x=1`, so the server returns board `main`, but the sidebar does not mark `main` as active. A later `saveBoard` would write to `main` while the route says something else.
   - Fix: check the route name against `^[a-z0-9][a-z0-9-]*$` in `parseRoute`, encode path segments in `api.ts`, or both.
2. **The prompt edge cases have no tests.**
   - The brief requires "a trimmed non-empty result" (`Sidebar.tsx:12-13`), but the test only covers the plain case.
   - Not tested: `"  x  "` should give `"x"`; `""`, whitespace only, or `null` (cancel) should not call `onCreate`.
   - Adding one test for the trim case and one for the cancel case is cheap.
3. **`connectWs` has no automated test.**
   - Later tasks rely on its reconnect and dispose behaviour, but nothing in the diff checks it, and the brief only required the Sidebar test.
   - A small test with a fake `WebSocket` and fake timers would protect it before Tasks 10 and 11 build on it.
4. **A bad WebSocket frame would throw.** `JSON.parse` in `socket.onmessage` has no guard (`api.ts:80`). The server is trusted, so the risk is low.
5. **`vite.config.ts` is not type-checked.** `tsconfig.json:12` only includes `src` and `test`. Biome may still lint it. This comes from the repo's existing setup, not from this task.
6. **Navigation is skipped if the list refresh fails.**
   - In `App.tsx:46-54`, if the create succeeds but the following `refresh()` fails, the user sees the refresh error and does not move to the new item, even though it was created.
   - This is rare and recovers on reload.
7. **Things the next tasks will need (from the report, both reasonable for this task):**
   - Task 11's CSS import from TypeScript will need `"vite/client"` added to `tsconfig.json`'s `types`.
   - Today a board or doc created outside the UI shows in the sidebar only after a reload. A later task should subscribe to `connectWs` to refresh the lists.

### Assessment
Task quality: Approved
Reasoning: Every interface, route and config value the brief asks for is present and matches the server code. The remaining items are small robustness and test-coverage gaps that later tasks can pick up.
