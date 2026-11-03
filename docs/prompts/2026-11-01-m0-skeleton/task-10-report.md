# Task 10 report: Doc view

Status: DONE_WITH_CONCERNS
Commit: `1cb30a1 feat(ui): markdown doc view with autosave and external-change banner`

## What I implemented

- `src/ui/docs/reconcile.ts`: `reconcileExternalChange({ dirty, localText, diskText })` returns `"noop"` when the texts are equal, `"banner"` when the editor is dirty, and `"reload"` otherwise.
- `src/ui/hooks/useDebounced.ts`: `useDebounced<T>(fn, ms): (v: T) => void`.
  It returns a stable function (it changes only when `ms` changes) that always calls the latest `fn` with the last value.
  If a call is still pending at unmount, it runs at once, so navigating away within 500 ms of the last keystroke does not drop the edit.
  Task 11 gets the same flush for board saves.
- `src/ui/docs/DocView.tsx`: replaces the stub.
  - One CodeMirror `EditorView` per doc name, created in an effect after `getDoc` resolves and destroyed on cleanup (a `cancelled` flag covers unmounting mid-fetch).
    Extensions are `basicSetup`, `markdown()`, line wrapping, and a small theme that fills the pane and uses the design tokens (font, line height, spacing, no focus outline).
  - An update listener marks the doc dirty and calls the 500 ms debounced save.
    Transactions annotated `Transaction.remote` (reload and Take theirs) are ignored, so swapping in disk text never counts as an edit or triggers a save.
  - A successful save clears dirty only when the saved text equals the current editor text.
    A failed save keeps dirty set and shows `Save failed: <message>` in a `role="alert"` line.
  - `connectWs` (one socket per open doc, closed on unmount) listens for `file-changed` on this doc, fetches the disk text, and applies `reconcileExternalChange`:
    - `reload` replaces the content and clears dirty.
    - `banner` shows a `role="alert"` bar with `Keep mine` (saves the local text) and `Take theirs` (replaces the content).
    - `noop` hides any open banner.
  - While the banner is up, autosave is paused, so a pending debounced save cannot overwrite the external edit before the user chooses.
    `Keep mine` saves directly, so nothing is lost.

## TDD evidence

RED: `pnpm vitest run test/ui/reconcile.test.ts test/ui/useDebounced.test.ts`, run before either module existed:

```
Error: Failed to resolve import "../../src/ui/hooks/useDebounced" from "test/ui/useDebounced.test.ts". Does the file exist?
...
 Test Files  2 failed (2)
      Tests  no tests
```

(reconcile.test.ts failed the same way on `../../src/ui/docs/reconcile`.)

GREEN: the same command after implementing both modules:

```
 Test Files  2 passed (2)
      Tests  2 passed (2)
```

The useDebounced test uses `renderHook` and `vi.useFakeTimers()`.
It makes three calls 200 ms apart, checks there is no call at 499 ms after the last one, then checks exactly one call with `"c"` at 500 ms.

Final `pnpm check` (tsc for both projects, biome, vitest):

```
Checked 45 files in 39ms. No fixes applied.
 Test Files  12 passed (12)
      Tests  54 passed (54)
```

## Manual verification (Step 4)

Two environment problems came up first:

1. `pnpm dev` in my sandbox: `tsx watch` crashed with `EPERM listen /tmp/claude-501/tsx-501/<pid>.pipe`.
   The sandbox blocks its IPC socket; this is not a project bug.
   I ran the same two processes without the watch IPC instead: `concurrently "node --import tsx src/cli/index.ts --no-open" "vite"`.
2. A real bug from Task 9 in `vite.config.ts`: the dev proxy key `"/api"` is a prefix match, so it also proxies `/api.ts`, the UI's own `src/ui/api.ts` module.
   The browser got `application/octet-stream` from the backend, the module failed to load (`Failed to load module script ... MIME type of "application/octet-stream" @ /api.ts`), and the app rendered nothing.
   `curl -sI localhost:5173/api.ts` showed `content-type: application/octet-stream`.
   This file is outside my task's list, so I did not change it.
   For verification I ran vite with a temporary config in `$TMPDIR` that spreads the repo config and uses `"/api/"` as the proxy key; after that `/api.ts` served as `text/javascript`.
   **The fix for the repo is changing the key in `vite.config.ts` to `"/api/"`.**
   Without it, `pnpm dev` shows a blank app.

Then, in a Playwright browser at `http://localhost:5173/`:

- **Create and autosave**: clicked `New doc`, entered `verify-notes`, and the route became `#/docs/verify-notes` with an empty editor.
  Typed `# Plan\n\n- first item`.
  `.blueprint/docs/verify-notes.md` held exactly that text, with its mtime inside the typing window (well under a second after the last keystroke).
- **Clean editor, external edit**: waited past the server's 1 s self-write suppression, then rewrote the file from the shell with an extra line `- added externally`.
  The editor showed the new line within about 1.5 s, with no banner.
  The file was not re-saved (the remote annotation works).
- **Dirty editor, external edit, Take theirs**: scheduled a shell write for 4 s later, then typed a long line at 80 ms per key, so the debounce kept resetting and the editor stayed dirty.
  The banner "This doc changed on disk while you had unsaved edits." appeared with `Keep mine` and `Take theirs`.
  After typing stopped, the disk still held the external text, so autosave stayed paused during the conflict.
  `Take theirs`: the banner closed, the editor showed the disk text, and the disk was unchanged.
- **Dirty editor, external edit, Keep mine**: same setup with another external write.
  The banner appeared; `Keep mine` closed it and the disk then held the local text.
- **Visual check**: the editor fills the main column, the gutter and active line look clean, and the font and spacing match the shell.
  In the first banner screenshot the buttons were unstyled browser defaults, so I styled them to match the sidebar controls (border token, 6 px radius, inherited font) and checked again in a second conflict round.
- **Console**: no errors.
  The only warning was `WebSocket ... closed before the connection is established`, which comes from StrictMode's dev-only double mount closing the first socket.
  It is harmless and does not appear in production.

Cleanup: I stopped the servers and removed `.blueprint/docs/verify-notes.md` and the `.playwright-mcp/` artifacts.
`git status` was clean apart from this task's files.

## Files changed

- `src/ui/docs/DocView.tsx` (replaces the stub)
- `src/ui/docs/reconcile.ts` (new)
- `src/ui/hooks/useDebounced.ts` (new)
- `test/ui/reconcile.test.ts` (new, no pragma, pure)
- `test/ui/useDebounced.test.ts` (new, `// @vitest-environment jsdom`)

No new dependencies.

## Self-review

- Signatures match the brief exactly.
- Leaks: the `EditorView` is destroyed on effect cleanup, the WebSocket is closed through `connectWs`'s disposer, and the debounce timer is cleared (with a flush) on unmount.
  A doc switch remounts through App's `key`, which gives a fresh view.
- The `useDebounced` flush on unmount runs the save after the view is destroyed.
  `persist` then sees `view.current === null` and does not touch editor state; the save still goes through.
- Biome raised no `useExhaustiveDependencies` complaints and needed no ignores.
  `replace` is a module-level function, so the socket effect depends only on `name`.

## Concerns

1. **`vite.config.ts` proxy bug from Task 9** (details above): `pnpm dev` is currently a blank page until the proxy key becomes `"/api/"`.
   It is a one-line fix outside this task's file list; please route it to a follow-up or to Task 9's owner.
2. **Banner and editor styles are inline** (CSS variables in `style` objects and an `EditorView.theme`), because `styles.css` is not in the brief's file list.
   The banner buttons have no hover state.
   They are marked with a `ponytail:` comment; moving them to `styles.css` with hover and focus states is a small follow-up.
3. **Remaining race, not handled**: if an autosave request is already in flight when an external edit lands, the server writes ours after theirs and the watcher suppresses our write.
   The banner then shows theirs while the disk has ours.
   The window is one request's round trip (milliseconds locally).
   Closing it fully would need server-side versioning (an ETag or mtime precondition on PUT).
4. Closing the browser tab within 500 ms of the last keystroke can drop that last edit (there is no `beforeunload` flush).
   Navigating within the app is covered by the unmount flush.

## Fix round 1

Finding addressed: Important #1, the dev proxy in `vite.config.ts` captured `/api.ts`.

Commit: `c8d2e6b fix(ui): proxy only /api/ paths in the dev server`

### What I changed

`vite.config.ts`: the proxy key `"/api"` is now `"/api/"`, so only API paths go to the backend and the UI module `/api.ts` is served by vite.
The `/ws` key is unchanged.
No other files changed.

### What I observed under `pnpm dev`

- `pnpm dev` started vite with the repo config.
  Its `tsx watch` server half exited again with `listen EPERM: operation not permitted /tmp/claude-501/tsx-501/<pid>.pipe`.
  That is my sandbox blocking tsx's watch IPC socket, not a project problem.
  I left the `pnpm dev` vite running and started only the backend next to it with `node --import tsx src/cli/index.ts --no-open` (`Blueprint running at http://localhost:4242`).
- Proxy checks against vite on :5173:
  ```
  $ curl -sI localhost:5173/api.ts | grep -i content-type
  Content-Type: text/javascript
  $ curl -s localhost:5173/api/docs
  []
  $ curl -s localhost:5173/api/boards
  []
  ```
  Before the fix, the first command returned `content-type: application/octet-stream`.
- In a fresh browser tab at `http://localhost:5173/`, the app rendered: the sidebar showed `BOARDS / New board / DOCS / New doc` and the console had no errors.
  The only warning was the known StrictMode dev double-mount WebSocket warning.
- Step 4 checks:
  - **Autosave**: created doc `verify-fix` through `New doc` and typed `# Fix round\n\n- autosave check`.
    `.blueprint/docs/verify-fix.md` held that text, with an mtime in the same second the typing finished (under a second).
  - **Silent reload when clean**: rewrote the file from the shell with an extra line `- external while clean`.
    About 1.2 s later the editor showed the line and no `role="alert"` banner was present.
  - **Banner when dirty**: scheduled a shell write for 3 s later and typed a line at 90 ms per key, keeping the editor dirty.
    The banner showed "This doc changed on disk while you had unsaved edits." with the buttons `Keep mine` and `Take theirs`.
    Clicking `Keep mine` closed the banner and the disk then held the local text.
- I stopped both servers and removed `.blueprint/docs/verify-fix.md` and the `.playwright-mcp/` artifacts.

### `pnpm check`

```
$ pnpm check
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 45 files in 12ms. No fixes applied.

 Test Files  12 passed (12)
      Tests  54 passed (54)
```
