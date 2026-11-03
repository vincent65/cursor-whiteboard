# SDD ledger — plan: docs/superpowers/plans/2026-11-01-m0-skeleton.md

Spec: docs/build-plan.md (reachable). Branch: m0-skeleton in the project checkout (env_kmibyqzefs).
Execution: subagent-driven; implementers and reviewers are bb child threads on claude-code, Opus 5.5, reasoning high (Vincent's instruction), permission mode auto.

## Pre-flight scan (2026-11-01)

| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T1 / T5 | T1 creates src/shared/types.ts (APP_NAME); T5 adds IncomingFile, IncomingScene there | consistent |
| T2 / T3 | T2 BoardGraph, excalidrawToBoardGraph, src/export/index.ts; T3 consumes BoardGraph, modifies index.ts | consistent |
| T2 / T4 | T4 consumes BoardGraph ids for the index; modifies index.ts | consistent |
| T2 / T5 | T5 consumes BoardFile, BoardFileAsset; writeBoard returns stored BoardFile with asset refs | consistent |
| T5 / T6 | routes consume FileStore, InvalidNameError, NotFoundError, ExistsError, InvalidSceneError; PUT writes export md via T2+T3 | consistent |
| T6 / T7 | T7 startServer consumes createApp from src/server/app.ts; T7 creates src/server/index.ts (no clash) | consistent |
| T7 / T8 | CLI consumes startServer, FileStore | consistent |
| T7 / T9 | UI api.ts consumes ServerMessage from src/shared/messages.ts | consistent |
| T9 / T10 / T11 | T9 App renders BoardView and DocView "stubbed as empty components" but lists no stub file paths; T10 and T11 create src/ui/docs/DocView.tsx and src/ui/board/BoardView.tsx | gap: stub location unspecified |
| T10 / T11 | T11 consumes useDebounced from src/ui/hooks/useDebounced.ts (T10) | consistent |
| T10 self | useDebounced test uses renderHook but the task does not say the file needs the jsdom pragma | gap: environment pragma |
| T1 self | tsconfig types node + vitest/globals; tests use globals | consistent |
| T2..T8 self | expected test counts match the listed tests (8, 6, 4, 10, 8, 3) | consistent |
| Global constraints | no task contradicts them; no plan-mandated empty test or duplicated logic block | clean |

Rulings:
- Ruling: work on branch m0-skeleton inside the project checkout instead of a git worktree — the repository has no commits yet, so a worktree cannot be created, and bb child threads share the checkout environment sequentially — costs nothing if wrong beyond a later branch move.
- Ruling: Task 9 creates the stub files at src/ui/board/BoardView.tsx and src/ui/docs/DocView.tsx (components that render nothing), so Tasks 10 and 11 replace files that already exist — carried into the Task 9 dispatch — if wrong, Tasks 10 and 11 would have created the same paths anyway.
- Ruling: every UI test file that renders components or hooks starts with the jsdom environment pragma (Tasks 9, 10, 11) — carried into those dispatches — if wrong, the test fails loudly, not silently.
- Ruling: Task 0 (design pass) is skipped for now because it needs Vincent in an interactive session; UI tasks use the plan's fallback tokens — Vincent can run the design pass and a restyle later — costs a restyle pass if wrong.

## Tasks

- [ ] Task 1: Repository bootstrap
- [ ] Task 2: Export schema and BoardGraph
- [ ] Task 3: Markdown renderer with golden fixture
- [ ] Task 4: Citations
- [ ] Task 5: FileStore
- [ ] Task 6: HTTP routes
- [ ] Task 7: WebSocket hub, file watcher, and server start
- [ ] Task 8: CLI
- [ ] Task 9: UI shell, routing, and sidebar
- [ ] Task 10: Doc view
- [ ] Task 11: Board view
- [ ] Task 12: Milestone acceptance

## Log
- 2026-11-01 Task 1: dispatched implementer thread thr_z4nm6tnknx (claude-opus-5-5, high, auto); BASE = none (first commit)
- Task 1: implementer DONE_WITH_CONCERNS (commit c4e3df3); concerns = tooling-forced config deviations (skipLibCheck for Vitest 5 + jest-dom 7 types; Biome 2.6 config; esbuild build script skipped by pnpm 10). Note for Task 9: if vite build fails on esbuild, add pnpm.onlyBuiltDependencies ["esbuild"] and reinstall.
- Task 1: review (thr_tsj62s9r26) spec ❌, quality Needs fixes: Important #1 Node floor (chokidar 6 needs Node 22.22; vitest 5, jsdom 30, concurrently 10 need 22); Important #2 pnpm check skips tsconfig.server.json and server tsconfig inherits vitest globals.
- Ruling: raise the Node floor to 22 in the design (docs/build-plan.md section 3), the plan's Global Constraints, and package.json engines — Node 20 reached end of life in April 2026 and the toolchain needs 22; pinning chokidar would keep a dead runtime for end users while contributors still needed 22 — committed as 19520d5 — costs Node 20 users, who are on an unsupported runtime anyway.
- Ruling: `pnpm check` also runs `tsc --noEmit -p tsconfig.server.json`, and tsconfig.server.json overrides types to ["node"] — the spec requires the check to run the type checker, and a check that cannot see NodeNext resolution errors does not — costs a few seconds per check.
- Task 1: minor (deferred): @types/node major pinned to the Node floor (folded into fix round 1 as part of stating the floor coherently).
- Task 1: minor (deferred): pnpm prints "Ignored build scripts: esbuild"; allowlist via pnpm.onlyBuiltDependencies before the UI task (already carried to Task 9).
- Task 1: minor (deferred): smoke test asserts a constant against itself (plan-mandated wiring check; fine).
- Task 1: minor (deferred): docs/tech-spec/build.sh hardcodes a macOS Chrome path (docs tooling, out of scope).
- Task 1: parked — ".superpowers/ not gitignored" — Ruling: the workspace is ignored by the self-ignoring .superpowers/sdd/.gitignore (git check-ignore confirms progress.md is ignored), so no change; the Biome exclusion stays harmless.
- Task 1: fix round 1/5 started (resume thr_z4nm6tnknx); FIX_BASE = 19520d5
- Task 1: fix round 1/5 (2 addressed, 0 open — Node floor stated as >=22 with @types/node ^22; check runs both tsconfigs; commits 19520d5..c17d8da)
- Task 1: minor (deferred): chokidar 6 declares node >= 22.22 while engines says >=22; consider >=22.22 or a README note.
- Task 1: complete (commits c4e3df3..c17d8da, review clean)
- Task 2: dispatched implementer; BASE = c17d8da
- Task 2: implementer DONE_WITH_CONCERNS (a3cd76b); concerns: frame label from name, orphaned bound text kept as text node (untested). Review thread thr_gwzuikmcrg
- Task 2: review (thr_gwzuikmcrg) spec ✅, quality Needs fixes: Important #1 text-container binding read from two fields (see task-2-findings-1.md).
- Task 2: minor (deferred): NODE_KINDS plain-object lookup accepts prototype keys like "constructor" (use Map or Object.hasOwn).
- Task 2: minor (deferred): frameId is not resolved against live elements while edge ends are (phantom frame refs possible).
- Task 2: minor (deferred): untested rules: label trimming, image with no files entry, unnamed frame, edge whose bound label text is deleted.
- Task 2: minor (deferred): nested ternary for label would read better as a helper.
- Task 2: fix round 1/5 started (resume thr_bxpfw5gpqg); FIX_BASE = a3cd76b
- Task 2: fix round 1/5 (1 addressed, 0 open — containerId -> text map is the single source of truth, 4 tests added; commits a3cd76b..c100658)
- Task 2: minor (deferred): text whose containerId points at a live line, freedraw, frame, image or text is hidden by the map but never shown as a label; restrict the map to box, ellipse, diamond, arrow if it matters.
- Task 2: complete (commits c17d8da..c100658, review clean)
- Task 3: dispatched implementer; BASE = c100658
- Task 3: implementer DONE (0a78e00). Review thread thr_hfeirr8cn8
- Task 3: review (thr_hfeirr8cn8) spec ✅, quality Approved. ⚠️ commit trailer: verified by controller, no trailer in 0a78e00.
- Ruling: the stroke summary line is omitted when a board has no strokes — consistent with "sections with nothing to show are omitted" in the brief — costs nothing if wrong beyond one golden line.
- Task 3: minor (deferred): no test for the ` label "x"` suffix on unconnected arrows; no test for a connected image node's asset-path label in the diagram; untested implementer choices (non-node edge ends become free; a frame used as an arrow endpoint renders as a box).
- Task 3: minor (deferred): an edge bound to a non-node element shows that side as (free) in the bullet; showing (<id>) would keep the information.
- Task 3: minor (deferred): sid falls back to "" silently; a throw would make a broken invariant loud. Edges are mapped twice where one type-guard filter would do.
- Task 3: complete (commits c100658..0a78e00, review clean)
- Task 4: dispatched implementer; BASE = 0a78e00
- Task 4: implementer DONE_WITH_CONCERNS (dc14c76); concerns: slug rule drops underscores (brief-mandated), no -1/-2 suffixes for duplicate headings, fenced code lines starting with # count as headings. Review thread thr_gj7icnha3c
- Task 4: review (thr_gj7icnha3c) spec ✅, quality Approved.
- Task 4: minor (deferred): closing hashes (`## Tokens ##`) leave a trailing hyphen in the slug; indented or tab-separated ATX headings are skipped; headings inside fenced code blocks add fake doc keys; test name "follow GitHub rules" overstates (brief strips underscores).
- Task 4: complete (commits 0a78e00..dc14c76, review clean)
- Task 5: dispatched implementer; BASE = dc14c76
- Task 5: implementer DONE_WITH_CONCERNS (85b0856); concerns: Zod parse reorders element keys (stable), concurrent creates can both succeed, gitignore writes tracked by wasWrittenRecently (harmless), incoming asset paths not shape-checked on write. Review thread thr_7sm7985vbt
- Task 5: review (thr_7sm7985vbt) spec ❌ (strict base64), quality Needs fixes: Important #1 loose base64 regex (task-5-findings-1.md).
- Task 5: minor (deferred): asset-only incoming files are not shape-checked on write (reuse the ASSET_FILE regex); write timestamp recorded before rename succeeds; init rewrites .gitignore via temp+rename (symlink and mode lost; appendFile is safer; no test for an existing gitignore without trailing newline); list() returns non-slug file names that read then rejects; readBoard on a corrupt file throws raw ZodError/SyntaxError; no fsync before rename; check-then-act races on create (use flag "wx").
- Task 5: ⚠️ for Task 6: a corrupt board file surfaces as ZodError/SyntaxError from readBoard; Task 6 maps it to 500 with { error } (carried into the Task 6 dispatch).
- Task 5: fix round 1/5 started (resume thr_3qt7c52jgm); FIX_BASE = 85b0856
- Task 5: fix round 1/5 (0 addressed, 1 open — canonical regex overflows V8 stack on >= 4 MB payloads, images cannot be saved; commits 85b0856..d94fd81)
- Ruling: "validated with a strict regex before decoding" in the brief is satisfied by a linear character-class regex plus a decode-and-re-encode equality check — the literal canonical regex is unsafe on real image sizes and the intent is rejecting non-canonical input — costs nothing if wrong beyond a slower validation path.
- Task 5: fix round 2/5 started (resume thr_3qt7c52jgm); FIX_BASE = d94fd81
- Task 5: fix round 2/5 (1 addressed, 0 open — linear regex plus decode-and-re-encode check, 4 MiB image test added; commits d94fd81..d6d9a92)
- Task 5: complete (commits dc14c76..d6d9a92, review clean)
- Task 6: dispatched implementer; BASE = d6d9a92
- Task 6: implementer DONE_WITH_CONCERNS (95249b7); concerns: PUT /api/docs/.. normalizes to /api/ and returns 404 (test adjusted); PNG upload does not check the board exists; unmatched routes return Hono's plain 404. Review thread thr_6kn8beg5gw
- Ruling: a PUT to /api/docs/.. returning 404 instead of 400 satisfies Review Focus 1 (rejected, nothing touches the filesystem) because the URL layer normalizes the path before routing; the body-name case still returns 400 — costs nothing if wrong beyond a status code.
- Task 6: review (thr_6kn8beg5gw) spec ✅, quality Approved.
- Task 6: minor (deferred, FIX BEFORE MERGE): SVG assets are served without sandboxing headers; add `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff` to asset responses.
- Task 6: minor (deferred): MIME/extension map duplicated between routes.ts and files.ts; PNG upload does not check the board exists or that the body is a PNG; 500 responses echo raw error messages with paths; markdown-generation call repeated in PUT and GET export; unmatched /api/* paths return plain 404 (carried into Task 7).
- Task 6: complete (commits d6d9a92..95249b7, review clean)
- Task 7: dispatched implementer; BASE = 95249b7
- Task 7: implementer DONE_WITH_CONCERNS (8d69199); concerns: chokidar usePolling (native events late or failing in the sandbox), watchPlan returns before ready (startup race), server binds 127.0.0.1 only, deletions not broadcast. Review thread thr_aq5aah3nug
- Ruling: polling file watching is accepted — the watched directories are tiny and native events proved unreliable here; ceiling is CPU on large plan directories — costs a switch to native events later if it matters.
- Ruling: binding to 127.0.0.1 is accepted as the safe default for a local app; Task 12's acceptance run on http://localhost:4242 verifies that browsers reach it — costs printing 127.0.0.1 instead if they do not.
- Task 7: review (thr_aq5aah3nug) spec ✅, quality Approved. ⚠️ localhost vs 127.0.0.1 resolution deferred to Tasks 8, 9, and 12.
- Task 7: minor (deferred): own-write suppression test is timing-sensitive (assert no event for `a` again after `b` arrives); server writes could be reported as external under heavy load (1000 ms window, brief-mandated); watchPlan returns before chokidar's initial scan (startup race, tests probe-and-retry); no test that a socket leaves the hub on close; close() skips server.close if the watcher stop rejects.
- Task 7: complete (commits 95249b7..8d69199, review clean)
- Task 8: dispatched implementer; BASE = 8d69199
- Task 8: implementer DONE_WITH_CONCERNS (2f6dee1); concerns: localhost banner vs 127.0.0.1 bind, no --help or Ctrl-C handler, non-API paths 404 until the UI is built. Review thread thr_qnkt464mup
- Task 8: review (thr_qnkt464mup) spec ✅, quality Approved.
- Task 8: minor (deferred): the entry-point guard (asked for by the controller's dispatch) silently no-ops when argv[1] is not the module's real path; drop it and call main() unconditionally. Port parsing accepts hex, exponent, and padded forms; the added validation branches have no tests; banner prints localhost while the server binds 127.0.0.1 (brief-mandated).
- Task 8: complete (commits 8d69199..2f6dee1, review clean)
- Task 9: dispatched implementer; BASE = 2f6dee1
- Task 9: implementer DONE_WITH_CONCERNS (4e99c5e); concerns: CSS imports from TS fail tsc without vite/client types (stylesheet linked from index.html instead); sidebar does not refresh on websocket file-changed events for new files. Review thread thr_f5jgnnkqbi
- Ruling: Task 11 may add "vite/client" to tsconfig.json types so component files can import stylesheets — carried into the Task 11 dispatch — costs nothing if wrong.
- Task 9: review (thr_f5jgnnkqbi) spec ✅, quality Approved.
- Task 9: minor (deferred): route names are not validated or URL-encoded (validate against the slug regex in parseRoute and encode path segments); prompt trim and cancel cases untested; connectWs has no test; JSON.parse on a websocket frame unguarded; vite.config.ts not typechecked; navigation skipped if the post-create refresh fails; sidebar does not refresh on websocket file-changed for new files.
- Task 9: complete (commits 2f6dee1..4e99c5e, review clean)
- Task 10: dispatched implementer; BASE = 4e99c5e
- Task 10: implementer DONE_WITH_CONCERNS (1cb30a1); concerns: Task 9's vite proxy key "/api" swallows /api.ts in dev (blank app); banner styles inline because styles.css was outside the file list; autosave-in-flight vs external-change race; edits within 500 ms of closing the tab can be lost. Review thread thr_s7y4yvy9bc
- Task 9: Ruling (late finding): the dev proxy key "/api" matching "/api.ts" is a real defect; Task 11 changes it to "/api/" as part of its commit — costs nothing if wrong.
- Ruling: UI tasks may put component styles in src/ui/styles.css even when the plan's file list omits it — the lists were stricter than the design intends — costs nothing if wrong.
- Task 10: review (thr_s7y4yvy9bc) spec ✅, quality Needs fixes: Important #1 Task 9 dev proxy key "/api" swallows /api.ts (blank app under pnpm dev); fixed in Task 10's fix round instead of Task 11 (supersedes the earlier ruling).
- Task 10: minor (deferred): unmount flush of useDebounced untested; navigating away while the banner is up discards local edits silently; silent reload replaces the whole document (cursor jump, undo history); out-of-order getDoc responses on rapid file-changed events; error line reuses the empty-state class; banner buttons have inline styles with no hover or focus state.
- Task 10: fix round 1/5 started (resume thr_d79jmvp394); FIX_BASE = 1cb30a1
- Task 10: fix round 1/5 (1 addressed, 0 open — dev proxy key "/api/"; commits 1cb30a1..c8d2e6b)
- Task 10: note: tsx watch cannot bind its IPC socket inside the implementer sandbox (EPERM); environment limit, not a repo defect.
- Task 10: complete (commits 4e99c5e..c8d2e6b, review clean)
- Task 11: dispatched implementer; BASE = c8d2e6b
- Task 11: implementer DONE_WITH_CONCERNS (2aac341); concerns: autosave continues while the disk-change notice is up (external edit overwritten within 500 ms), vite build chunk-size warning (pre-existing), exported PNG not refreshed after an external reload, own-save detection via scene version sum could collide. Review thread thr_ridqi82i22
- Task 11: review (thr_ridqi82i22) spec ❌, quality Needs fixes: Important #1 notice branch overwrites external changes; #2 `sent` echo set never forgets; #3 production fonts from esm.sh; #4 appState-only changes never saved (plan-mandated). See task-11-findings-1.md.
- Ruling: the board notice gets `Keep mine` and `Take theirs` like the doc view and saves are held while it is up — the brief's single Reload button could not be honest — costs one more button.
- Ruling: Excalidraw fonts are served locally via a copy script and EXCALIDRAW_ASSET_PATH — local-first means working offline — costs a build step.
- Ruling: the save gate also fires on viewBackgroundColor, gridSize, gridModeEnabled changes, never on zoom or scroll — the brief's version-only gate silently dropped user choices — costs a few extra saves.
- Task 11: minor (deferred): setError(null) on save clears unrelated errors; PNG not re-exported after an external change; in-flight PUT vs external write race leaves editor and disk disagreeing silently; every save uploads every image data URL including unused ones; `as unknown as` casts hide schema mismatches; test gaps (fetchAsset argument, multi-file, empty files); vite build chunk-size warning (Excalidraw) needs a ruling or lazy loading.
- Task 11: fix round 1/5 started (resume thr_54g36bqwpn); FIX_BASE = 2aac341
- Task 11: fix round 1/5 (4 addressed, 0 open — saves held behind Keep mine / Take theirs notice, in-flight echo tracking, fonts served locally via scripts/copy-excalidraw-assets.mjs and EXCALIDRAW_ASSET_PATH, shouldSave gate on appState keys; commits 2aac341..d260d75)
- Task 11: minor (deferred): applying an external change also applies zoom and scroll (viewport jumps; a file with empty appState resets the viewport); save on unmount is held while the notice is up (local edits dropped, same as DocView); running vite build directly without the package script leaves /fonts empty and Excalidraw falls back to esm.sh.
- Task 11: complete (commits c8d2e6b..d260d75, review clean)
- Task 12: dispatched acceptance runner; BASE = d260d75
- Task 12: acceptance DONE_WITH_CONCERNS (thr_ngrjkk6wvu), no commits; milestone 0 "done when" holds on a scratch repo (UI served, board and doc save and reload across page reload and server restart, exports written, two gitignore lines).
- Task 12: minor (deferred): new board/doc prompts do not say names must be lowercase with dashes, so "acceptance board" fails with a 400 shown as a raw alert; doc headings render underlined in the editor; Excalidraw's right-side buttons sit flush against the side panel; vite build warns about bundles over 500 kB.
- Task 12: complete (no diff, acceptance passed)
- Final review (thr_x963cdq4ck, claude-fable-5-1): Ready to merge with fixes. 5 Important findings (final-findings.md): Host/Origin check, unsupported image MIME types poisoning saves plus full files map on every save, navigation during a conflict drops edits, sidebar name prompt not slugified, SVG sandbox headers. Report saved at final-review-report.md.
- Ruling: the final fix wave covers the five Important findings only; the reviewer's "fix before milestone 1 starts" items (in-flight PUT vs external write race, sidebar refresh on file-changed, silent whole-document reload losing undo history) are carried into the milestone 1 plan — bounded fix wave per the process — costs those three landing a few days later.
- Final fix wave started; FIX_BASE = d260d75
- Final fix wave DONE_WITH_CONCERNS (thr_w2syu2tbv5): commits f1cdee1..f716321 (Host/Origin middleware in createApp also covering WS upgrades; Excalidraw image types plus CSP sandbox on assets; UI sends only live image files; shared slugify; confirm before leaving a conflicted view). Concerns: Origin is checked against the request Host rather than the bound port (needed for the Vite proxy); slugify trims trailing dashes.
- Final re-review (thr_7z3gnp698i, claude-fable-5-1): all 5 findings ADDRESSED; new breakage: Important — Vite's string proxy shorthand sets changeOrigin true, so under pnpm dev the server sees Host localhost:4242 with Origin http://localhost:5173 and the same-origin check returns 403 on every write (the fix's own "other port" test pins this outcome); Minor — URL.parse needs Node 22.1 while engines says >=22.
- Ruling: residual Important (dev-proxy writes 403) is real and load-bearing for development but does not affect the built app; per the process there is no second fix wave, so it is surfaced to Vincent at handoff with the one-line fix: give the `/api/` proxy entry the object form `{ target: "http://localhost:4242", changeOrigin: false }` in vite.config.ts, and adjust the "other port" test's expectation if it encodes the proxy case — costs a broken dev loop until applied.
- Ruling: residual Minor (URL.parse on Node 22.0) is parked with the fix of setting engines to >=22.1 — costs a 500 on Node 22.0 exactly.
- Whole branch complete pending Vincent's decision on the residual and on integration.
