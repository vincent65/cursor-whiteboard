# Task 12 report: Milestone 0 acceptance

Status: DONE_WITH_CONCERNS.
No fixes were needed and no commit was made.
The concerns are small UX and visual issues that do not block acceptance.

## Step 1: `pnpm check`

Run on branch `m0-skeleton` at `d260d75`, exit code 0.

```
> blueprint@ check /Users/vincentyip/programming/cursor-whiteboard
> tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.server.json && biome check . && vitest run

Checked 48 files in 22ms. No fixes applied.

 RUN  v5.0.5 /Users/vincentyip/programming/cursor-whiteboard


 Test Files  13 passed (13)
      Tests  57 passed (57)
   Start at  23:27:48
   Duration  3.43s (tests 48%, setup 26%, environment 15%, import 6%, transform 4%, worker 1%)
```

The export golden tests are in `test/export/markdown.test.ts` (for example `golden: basic board renders exactly`) and use the fixtures under `test/export/fixtures/`.
They are part of the 57 passing tests.

## Step 2: Production run in a scratch repository

### Build

`pnpm build` succeeded (`tsc -p tsconfig.server.json`, asset copy, `vite build` in 877ms).
The only output besides the bundle list is Vite's warning that some chunks are larger than 500 kB, from the Excalidraw and Mermaid bundles.

### Server start

`/tmp/bp-scratch` did not exist beforehand, so the run started from a clean scratch repository.
Port 4242 was free.

```bash
mkdir -p /tmp/bp-scratch && cd /tmp/bp-scratch && git init -q && node /Users/vincentyip/programming/cursor-whiteboard/dist/cli/index.js --no-open
```

Output: `Blueprint running at http://localhost:4242`.
Writes under `/tmp` are outside the command sandbox, so this command and the later `/tmp` commands ran with the sandbox disabled.

On startup, before any UI interaction, the server created `.blueprint/{assets,boards,docs,export,tasks,worktrees}/` and `/tmp/bp-scratch/.gitignore`.

### Browser driver

The Playwright MCP browser was locked by another session (`Browser is already in use for .../mcp-chrome-e220b27`), on two attempts.
I first used gstack `browse` (headless Chromium) to load the page and create the board.
That tool has no real mouse drag, and synthetic `PointerEvent`s sent to the Excalidraw canvas did not draw anything.
So I drew, typed, and reloaded with a short Node script that uses the Playwright library bundled with gstack (`~/.claude/skills/gstack/node_modules/playwright`) for real mouse and keyboard input.
The script was `$TMPDIR/bp-accept/run.mjs`, kept outside the repo.
Screenshots are in `/tmp/bp-shots/` (`board-drawn.png`, `board-reloaded.png`, `doc-typed.png`, `doc-reloaded.png`, `board-after-nav.png`) and in `/tmp/bp-board-empty.png`.

### Acceptance point 1: UI served

- `curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:4242/` returned `200 text/html; charset=utf-8`.
- In the browser, `/` loaded `index-*.js`, `index-*.css`, `GET /api/boards` and `GET /api/docs`, all 200.
- The page showed the sidebar ("Boards / New board", "Docs / New doc"), the empty state "No boards yet. Create one from the sidebar.", and the right placeholder panel "The Claude panel arrives in milestone 1."
- There were no console errors on load.

### Acceptance point 2: board created, drawn, reloaded

- Clicking "New board" and entering `acceptance board` at the prompt produced `POST /api/boards` 400 and the alert `invalid name: "acceptance board"`.
  The plan specifies this: names must match `^[a-z0-9][a-z0-9-]*$`. See concern 1.
- Clicking "New board" and entering `acceptance` navigated to `#/boards/acceptance`.
  The Excalidraw toolbar rendered, the sidebar link `acceptance` was marked current, and `.blueprint/boards/acceptance.excalidraw.json` appeared with the empty scene (119 bytes, `elements: []`).
- Drawing used real mouse input: click the canvas, press `r`, drag from (400,200) to (600,320), press `Escape`, wait 2.5 s.
  The board file on disk then held one element, `rectangle#yecnaORFvMRRotqUtYw8G 200x120`.
- After `page.reload()`, the rectangle redrew at the same position (`board-reloaded.png`).
- After moving to the doc and back through the sidebar link, the rectangle was still there (`board-after-nav.png`).
- The save also wrote the export: `.blueprint/export/boards/acceptance.md` and `.blueprint/export/boards/acceptance.png` (a PNG, 232 x 152 RGBA).
  The markdown reads:

  ```
  # Board: acceptance

  ## Other elements

  - [box] (unlabeled) (yecnaORFvMRRotqUtYw8G)
  ```

### Acceptance point 3: doc created, typed, reloaded

- Clicking "New doc" and entering `notes` at the prompt navigated to `#/docs/notes` with a CodeMirror editor.
- I clicked into the editor and typed `# Acceptance\n\nTyped in the browser during milestone 0 acceptance.\n`, then waited 2.5 s.
- `.blueprint/docs/notes.md` on disk was exactly `"# Acceptance\n\nTyped in the browser during milestone 0 acceptance.\n"`.
- After `page.reload()`, the editor showed the same four lines (`doc-reloaded.png`).
  Its `innerText` has extra newlines, but that comes from how CodeMirror renders empty lines in the DOM.
  The screenshot and the file match.
- `GET /api/docs/notes` returned the same text.
- There were no console errors in the Playwright session.

### Acceptance point 4: files under `.blueprint/`

`find .blueprint -type f | sort`:

```
.blueprint/boards/acceptance.excalidraw.json
.blueprint/docs/notes.md
.blueprint/export/boards/acceptance.md
.blueprint/export/boards/acceptance.png
```

`git status --porcelain --untracked-files=all` in the scratch repository:

```
?? .blueprint/boards/acceptance.excalidraw.json
?? .blueprint/docs/notes.md
?? .gitignore
```

So the source files are trackable and `export/` stays ignored.
`GET /api/boards` returned `[{"name":"acceptance",...}]` and `GET /api/docs` returned `[{"name":"notes",...}]`.

### Acceptance point 5: the two gitignore lines

`/tmp/bp-scratch/.gitignore`:

```
.blueprint/export/
.blueprint/worktrees/
```

### Restart check

I stopped the server and started it again in `/tmp/bp-scratch`.
`.gitignore` still had exactly the two lines, with no duplicates.
`GET /api/boards/acceptance` returned the rectangle element and `GET /api/docs/notes` returned the typed text.
So the data survives a server restart, not only a page reload.

### Teardown

I stopped both server runs with `pkill -f "dist/cli/index.js --no-open"`.
Exit code 144 on the background task is that signal.
After the stop, `curl localhost:4242/` returned `000` and `pgrep` found no server process.
I also stopped the gstack browse daemon.

The browse tool had added `.gstack/` to this repository's `.gitignore` and created a `.gstack/` log directory in the repo root.
That is a tool side effect, not Blueprint behavior, so I reverted the `.gitignore` edit and deleted the directory.
`git status` in the repository is clean.

## Fixes and commits

None.
Both Step 1 and Step 2 passed without code changes.

## Remaining concerns

1. **Name rule only shows up after a failed request.**
   The "New board" and "New doc" prompts say only `New board name`.
   A natural name like `acceptance board` returns a 400 and a raw alert, `invalid name: "acceptance board"`.
   The behavior matches the plan, but the user only learns the slug rule after failing.
   A cheap improvement is to state the rule in the prompt, or to slugify the input before the POST.
2. **Doc headings render underlined.**
   In the doc view, `# Acceptance` is bold and underlined (`doc-reloaded.png`).
   This comes from CodeMirror's default highlight style, and in a markdown editor it looks like a link.
   It is cosmetic.
3. **Excalidraw's right-side buttons sit against the panel edge.**
   The library, lock and hand buttons are flush against the border of the Claude placeholder panel at 1280x720 (`board-reloaded.png`), with no right margin.
   It is cosmetic and worth a look during the milestone 1 panel work.
4. **Bundle size.**
   `vite build` warns about chunks over 500 kB: `index-*.js` is 1.93 MB and the Excalidraw chunk is 1.82 MB.
   This does not matter for a local tool, but it slows the first load.
5. **Tooling.**
   The Playwright MCP browser was held by another session for the whole run, so drawing used the gstack bundled Playwright library instead.
   gstack `browse` writes `.gstack/` into the project root and edits `.gitignore`; I cleaned that up.
