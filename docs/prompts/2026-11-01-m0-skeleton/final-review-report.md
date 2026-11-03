Review complete. Here is the full report.

## Strengths

- **Clean layering.** The export module is pure and I/O-free as the design demands, `FileStore` is the only disk writer, routes are thin, and error mapping lives in one `onError` handler in `src/server/app.ts:23`.
- **Write safety is real, not nominal.** `writeBoard` validates every file and the whole scene before touching disk (`src/server/files.ts:121-155`), writes go through temp-plus-rename, and the base64 check decodes and re-encodes rather than relying on a regex that blows the stack on multi-MB images. The 4 MB image test proves it.
- **Path handling is guarded at every entry.** Slug check on names, a sha256-plus-extension regex on assets, a `resolve` and prefix check on export paths, and the same prefix check on the static UI handler with an explicit `..%2f` test.
- **Loopback bind** at `src/server/index.ts:70` with a comment saying why.
- **Tests exercise real behavior.** Temp directories, a real HTTP server on port 0, a real WebSocket client, a real chokidar watcher with probe-until-watching, and a golden fixture. No mocks of the filesystem or server.
- **Echo suppression is layered.** Server-side `wasWrittenRecently` plus client-side `inFlight` tracking in `BoardView`, a serialized save queue with `structuredClone` so Excalidraw's in-place mutation cannot corrupt a queued body, and CodeMirror's `Transaction.remote` annotation so disk reloads never mark the doc dirty.
- **Justified deviations.** Keep-mine and take-theirs on the board instead of a bare reload button, saving on background and grid changes, and local fonts for offline use are all improvements over the plan and each has a ruling.

## Issues

#### Critical (Must Fix)

None. Nothing in the branch corrupts data in the normal path or blocks milestone 1.

#### Important (Should Fix)

1. **Any web page can write into the user's repository.** `src/server/app.ts:20-29` and `src/server/index.ts:39-45`. The API accepts cross-origin requests with no Host or Origin check. A `text/plain` POST is a CORS simple request, so no preflight protects it. I confirmed it with a focused script against `createApp`:

   ```
   POST /api/boards  Content-Type: text/plain  Origin: https://attacker.example
   status 201 boards: [ 'evil.excalidraw.json' ]
   ```

   Today the writable surface is creating boards and docs and uploading export PNGs, and with DNS rebinding a page can also read every plan doc over the API and subscribe to the WebSocket. Milestone 1 puts Claude sessions and permission replies on this same surface, so this must be closed before then. Fix: reject requests whose `Host` is not `localhost`, `127.0.0.1`, or `[::1]` with the bound port, and reject non-GET requests and WebSocket upgrades whose `Origin` header is present and not that same host. About ten lines of middleware.

2. **One unsupported image poisons every later save, and the session's edits are lost on reload.** `src/server/files.ts:23-29` and `:135`. Excalidraw accepts bmp, avif, jfif, and x-icon images on paste or drop; I confirmed all four MIME strings are in its bundle. The server rejects them, and the whole PUT fails with 400. Excalidraw keeps the file in its `files` map even after the image element is deleted, and `BoardView` sends the full map on every save (`src/ui/board/BoardView.tsx:87-91`), so every subsequent autosave fails until the page is reloaded, at which point every edit since the paste is gone. Fix both ends: extend the extension map to Excalidraw's list, and have the UI send only files referenced by non-deleted elements so one bad file cannot block unrelated edits.

3. **Navigating away during a disk conflict drops local edits silently.** `src/ui/docs/DocView.tsx:69-71` and `src/ui/board/BoardView.tsx:101-106`. Both save callbacks return early while the banner is up. The unmount flush in `useDebounced` then calls that same callback, so the pending text is discarded with no warning. The user typed, saw a banner, clicked another file, and their edits are gone. This is listed as deferred for Tasks 10 and 11. It becomes common in milestone 1 when Claude edits docs while the user is in them. The cheapest honest fix is to resolve the banner on unmount by keeping the user's text in memory and re-showing the banner when they return, or to block navigation with `window.confirm` while a conflict is open.

4. **Creating a file with a normal name fails with a raw error.** `src/ui/nav/Sidebar.tsx:11-14` and `src/ui/App.tsx:50-52`. The prompt says only `New board name`. Typing `My Board` produces an alert reading `invalid name: "My Board"`. This is the first thing a person does in the app. Slugify the prompt result in the sidebar (lowercase, spaces to dashes, strip the rest) and only alert if nothing remains.

5. **SVG assets are served without sandboxing headers.** `src/server/routes.ts:69-77`. A pasted SVG with a script runs in the app's origin if opened directly, and the origin can call the write API. Add `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff` to asset responses. Already marked fix-before-merge in the deferred list and I agree.

#### Minor (Nice to Have)

- **Prototype keys in the kind map.** `src/export/boardGraph.ts:8` and `:68`. An element type of `constructor` yields a function as its kind and `boardGraphToMarkdown` throws on `SHAPES[kind]`. Because the PUT route writes the board before rendering the export (`src/server/routes.ts:43-47`), the response is a 500 after the save landed. Use `Object.hasOwn` or a `Map`. Excalidraw never emits such a type, so this only affects hand-edited files.
- **Inline styles duplicate CSS classes.** `src/ui/docs/DocView.tsx:28-47` reimplements the `.notice` and `.button` rules that `src/ui/styles.css` gained in Task 11. Use the classes and delete the objects.
- **Every save re-uploads every image.** `src/ui/board/BoardView.tsx:87-91`. A board with ten screenshots sends and re-hashes all of them on every stroke. The PUT response already returns the stored asset map, so the UI can send `asset` references for files it knows are stored. The design names this ceiling, so this can wait until it hurts.
- **Sidebar never refreshes on external adds.** `src/ui/App.tsx:36-38`. A doc created on disk does not appear until reload. Needed by milestone 1 when Claude creates docs.
- **No README.** Milestone 5 owns it, but a ten-line quickstart with `pnpm build`, `pnpm dev`, and `node dist/cli/index.js` would help anyone touching the repo now.
- **Entry guard in the CLI.** `src/cli/index.ts:27-31`. Nothing imports the CLI module, so the guard only adds a way for `main` to silently not run. Drop it.
- **PNG upload for a nonexistent board.** `src/server/routes.ts:50-56` writes `export/boards/<slug>.png` without checking the board exists.
- **Listing returns unopenable names.** `src/server/files.ts:219-234` lists any file with the suffix, including names that `assertSlug` later rejects. Filter the list with the same regex.
- **Asset-only files are not shape-checked.** `src/server/files.ts:127-131` stores `file.asset` as given. Validate it against the existing `ASSET_FILE` pattern so a board can only reference real asset names.
- **Excalidraw is loaded on every route.** Wrapping `BoardView` in `React.lazy` keeps the docs view light and quiets the chunk-size warning without raising the limit.
- **Component-level coverage of the banners.** Review Focus 3 is pinned by the pure `reconcileExternalChange` test and by manual checks only. One jsdom test per view that feeds a fake `connectWs` message and asserts the banner, the held save, and both buttons would lock in the most delicate behavior in the UI.
- **Cosmetic items from Task 12.** Underlined headings in CodeMirror and Excalidraw's right-side toolbar flush against the pane belong to the design pass.

## Deferred-list triage

**Fix before merge:**

- Task 6: SVG sandbox headers (marked FIX BEFORE MERGE; agreed).
- Task 12: name prompt gives no rule and shows a raw alert (Important 4 above).
- Tasks 10 and 11: navigating away while the banner is up drops local edits (Important 3 above). If the controller prefers, this can slip to the start of milestone 1, but not past it.

**Fix before milestone 1 starts, in this branch if convenient:**

- Task 11: in-flight PUT versus external write leaving editor and disk silently different. Rare today, common once Claude writes docs.
- Task 9: sidebar not refreshing on `file-changed` for new files.
- Task 10: silent reload replacing the whole document and losing undo history.

**Can wait:**

- Task 1: `@types/node` pin, esbuild build-script notice, smoke test shape, `build.sh` Chrome path, chokidar's `>=22.22` versus `>=22`.
- Task 2: prototype keys (Minor above), unresolved `frameId`, untested label rules, nested ternary, hidden bound text on non-shape containers.
- Task 3: untested suffix and image-label cases, `(free)` for non-node ends, silent `sid` fallback, double edge map.
- Task 4: slug edge cases. These matter in milestone 3 when citations are compiled, so fix them there.
- Task 5: asset-only shape check, timestamp before rename, gitignore rewrite losing mode, non-slug listing, corrupt-file 500, no fsync, create races.
- Task 6: MIME map duplication, PNG upload without board check, raw 500 messages, repeated export call.
- Task 7: timing-sensitive own-write test, startup scan race, missing close-path tests. If the watcher test ever flakes in CI, fix it then per Vincent's standing rule.
- Task 8: entry guard, lax port parsing, localhost banner.
- Task 9: route validation, prompt edge tests, unguarded `JSON.parse`, vite config typecheck.
- Task 11: `setError(null)` clobbering, PNG not re-exported after external change, full image re-upload, casts, test gaps, viewport jump on external apply, fonts when running `vite build` directly, chunk warning.
- Task 12: cosmetic CodeMirror and Excalidraw spacing items.

**Rulings:** none looks wrong. The strict-base64 ruling is stronger than the plan's literal regex. The 127.0.0.1 ruling is right and Important 1 is its natural complement. The polling ruling is fine at this directory size. Skipping Task 0 is acceptable given it needs Vincent, but the design says `DESIGN.md` comes before the first screen, so the restyle should be scheduled rather than left open.

## Declined to judge

- `DESIGN.md` and visual polish: skipped by ruling, owned by a later design pass.
- README and install instructions: milestone 5 scope (noted as Minor only because the repo has none at all).
- Playwright coverage of UI flows: milestone 5.
- Windows paths and process spawning: the design says untested in the MVP.
- The `PreToolUse` hook that denies board writes: milestone 1, no Claude here.
- Validating the Mermaid output against a real Mermaid parser: not in the plan; recommended below for milestone 2 when Mermaid is a dependency anyway.
- fsync-before-rename durability on power loss: personal tool with git history behind it.
- Whether Excalidraw's `updateScene` bumps element versions after Take theirs and triggers one spurious save: needs a browser to verify, not a plan requirement, and harmless if it does.
- The Vite chunk-size warning as a build concern rather than a behavior.

## Recommendations

1. Add the Host and Origin middleware now and cover it with one route test, since milestone 1 multiplies what this server can do on the user's behalf.
2. Fix Important 2 on both ends in one commit: the UI filters files to live elements, the server accepts Excalidraw's full image list.
3. Slugify in the sidebar prompt and reuse the server's regex from `src/shared` so the rule lives in one place.
4. Before milestone 2, add a test that feeds each golden Mermaid block through the real Mermaid parser. Every escaping rule in `mermaidLabel` is currently asserted by string equality only.
5. Keep the per-view WebSocket for now, but plan to lift it into `App` in milestone 1, since the sidebar and the Claude panel both need the same stream.

## Assessment

Ready to merge? **With fixes**

Reasoning: the branch meets milestone 0's done-when row with sound structure and real tests, but a local server that any web page can write to, a paste that silently breaks saving, and a first-run name prompt that fails on ordinary input are each cheap to fix and should land before this becomes the base for milestone 1.
