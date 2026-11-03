# Task 9 report: UI shell, routing, and sidebar

Status: DONE_WITH_CONCERNS (one minor concern, see below).
Commit: `4e99c5e feat(ui): app shell, hash routing, sidebar and api client`

## What I implemented

- `src/ui/api.ts`: every function in the brief's Interfaces block, with the stated signatures.
  - `listBoards()` and `listDocs()` return the server's `{ name, updatedAt }[]` entries, typed as `Entry`.
  - `createBoard` resolves to `BoardFile`; `createDoc`, `saveDoc`, `uploadBoardPng` resolve to `void`.
  - `getDoc` reads the body as text; `saveDoc` sends `text/markdown`; `uploadBoardPng` sends the blob as `image/png`.
  - A shared `request` helper throws `Error(serverBody.error)` on non-2xx, so the UI shows messages such as `invalid name: "Bad Name"`.
  - `assetUrl("assets/<sha>.<ext>")` returns `/api/assets/<sha>.<ext>`, matching the `asset` field that `BoardFile` stores.
  - `connectWs(onMessage)` opens `ws(s)://<host>/ws`, reconnects on close with exponential backoff (500 ms doubling to a 10 s cap, reset on open), and returns a disposer that cancels any pending reconnect and closes the socket.
- `src/ui/nav/Sidebar.tsx`: Boards and Docs sections, links `#/boards/<name>` and `#/docs/<name>`, `aria-current="page"` on the active entry, and "New board" / "New doc" buttons that call `window.prompt` and pass a trimmed, non-empty result.
- `src/ui/App.tsx`: a hash router (parse `location.hash`, listen to `hashchange`); three-pane layout; the sidebar loads lists on mount and after each create, then navigates to the new item; a create error (400 invalid name, 409 exists) shows in `window.alert`; the default route `location.replace`s to the first board, or shows "No boards yet. Create one from the sidebar." when there are none; the main pane renders `BoardView` or `DocView` keyed by name; the right pane says exactly `The Claude panel arrives in milestone 1.`
- `src/ui/board/BoardView.tsx` and `src/ui/docs/DocView.tsx`: stubs that accept `{ name: string }` and render nothing.
- `src/ui/styles.css`: the Task 0 fallback tokens as CSS custom properties (font, 14px / 1.5, 8px grid, the six colors, 240px rail, 360px pane), with plain classes.
- `src/ui/index.html`, `src/ui/main.tsx`: entry; React `StrictMode`.
- `vite.config.ts`: `root: "src/ui"`, `outDir: "../../dist/ui"`, `emptyOutDir: true`, React plugin, the `process.env.IS_PREACT` define, and dev proxies for `/api` and `/ws` (`ws: true`) to port 4242.

## TDD evidence

RED: `pnpm vitest run test/ui/Sidebar.test.tsx`

```
 FAIL  test/ui/Sidebar.test.tsx [ test/ui/Sidebar.test.tsx ]
Error: Failed to resolve import "../../src/ui/nav/Sidebar" from "test/ui/Sidebar.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN: `pnpm vitest run test/ui/Sidebar.test.tsx`

```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

Full `pnpm check` (tsc for both configs, biome, vitest):

```
Checked 41 files in 13ms. No fixes applied.
 Test Files  10 passed (10)
      Tests  52 passed (52)
```

No warnings or stderr in the test output.

## Build output

`pnpm vite build`:

```
vite v8.3.5 building client environment for production...
✓ 20 modules transformed.
dist/ui/index.html                   0.39 kB │ gzip:  0.26 kB
dist/ui/assets/index-56R9LW0A.css    1.88 kB │ gzip:  0.78 kB
dist/ui/assets/index-Iy0yWCmG.js   222.19 kB │ gzip: 69.60 kB
✓ built in 88ms
```

`dist/ui/index.html` exists.
esbuild was not needed (Vite 8 builds with Rolldown), so `package.json` and the lockfile are unchanged.

## End-to-end check

I ran `pnpm build`, then started `node dist/cli/index.js serve --no-open --port 4317` in an empty temp project and drove it with Playwright:

- An empty project shows the empty state and the right-pane text.
- "New board" with the prompt answer `  main  ` created `main` (trimmed) and routed to `#/boards/main` with the link marked active.
- "New doc" with `Bad Name` showed the alert `invalid name: "Bad Name"` (the server's 400), and nothing was created.
- "New doc" with `notes` created it and routed to `#/docs/notes`.
- Loading `/` redirected to `#/boards/main` (default route = first board).
- No console warnings or errors on a clean load.

Pixel fixes made during the check: the link text sat 1px left of the button text (the buttons have a 1px border), so links now have a transparent 1px border and the active state colors it; the empty-state margin now matches the side panes' 16px padding.
Screenshots: `task-9-empty.png`, `task-9-doc-active.png` (before the alignment fix), `task-9-board-active.png` (after), all in this directory.

## Files changed

- `src/ui/App.tsx`, `src/ui/api.ts`, `src/ui/index.html`, `src/ui/main.tsx`, `src/ui/nav/Sidebar.tsx`, `src/ui/styles.css`
- `src/ui/board/BoardView.tsx`, `src/ui/docs/DocView.tsx` (stubs)
- `vite.config.ts`
- `test/ui/Sidebar.test.tsx`

## Self-review

- Completeness: every `api.ts` function from the Interfaces block exists with the stated signature; the Sidebar test passes; the build produces `dist/ui/index.html`.
- Quality: the layout uses the tokens only through custom properties; `connectWs` reconnects with capped exponential backoff and its disposer stops reconnects.
- Discipline: no new dependencies; only the listed files plus the two stubs; no "Claude Code" branding in UI copy.
- Testing: `pnpm check` is clean.

## Concerns

1. The stylesheet loads through `<link rel="stylesheet" href="./styles.css">` in `index.html`, not `import "./styles.css"` in `main.tsx`.
   A CSS side-effect import fails `tsc` (TS2882) because `tsconfig.json` has no `vite/client` types, and that file is outside this task's file list.
   Task 11 imports Excalidraw's CSS from TypeScript and will hit the same error; the clean fix there is adding `"vite/client"` to `compilerOptions.types` in `tsconfig.json`.
2. `App` does not subscribe to `connectWs`, so a board or doc created on disk by another process shows up in the sidebar only after a reload or a create in the UI.
   The brief only asks for refresh on mount and after creates; Tasks 10 and 11 subscribe for content changes.
