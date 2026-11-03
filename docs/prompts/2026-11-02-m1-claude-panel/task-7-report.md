# Task 7 report: board tools, system prompt, and the board-write hook

Status: DONE_WITH_CONCERNS (minor; see Concerns).
Commit: `389bde0 feat(agent): board tools, system prompt, and the board-write guard`

## What I implemented

- `src/server/agent/tools.ts`
  - `createBoardTools({ store, hub })` returns `createSdkMcpServer({ name: "blueprint", tools: [get_board, get_selection] })`.
  - `get_board({ board? })`: the board defaults to the first entry of `store.listBoards()` (already sorted by name), and the tool throws `there are no boards yet` when no boards exist.
    It returns the Markdown export as a text block, then the PNG from `hub.request({ kind: "board.png", board })` as `{ type: "image", data, mimeType }`.
    If the request fails, it returns only the text block, ending with `\n(No PNG: <error>)`.
  - `get_selection({})`: calls `hub.request({ kind: "selection.snapshot" })` and returns `Nothing is selected on the board.` when `ids` is empty or `hub.activeBoard` is null.
    Otherwise it returns the Markdown of `selectionGraph(graph of hub.activeBoard, ids)`, plus the crop as an image block when `png` is not null.
  - The data URL is split on its first comma: the base64 payload comes after the comma, and the media type comes from the header (`data:<type>;base64`).
  - `selectionGraph(graph, ids)` keeps the selected nodes and selected loose items.
    It keeps an edge when the edge itself is selected or when both of its ends are selected.
    In each kept edge, an end that is not selected is set to `null`.
- `src/server/agent/prompt.ts`
  - `SYSTEM_PROMPT_APPEND` has six bullets in the order the brief gives: plan file locations (`.blueprint/` with `boards/`, `docs/`, `spec.md`, `tasks/`), reading boards only through the two tools and never editing them directly, the meaning of the selection header, the allowed Mermaid kinds (flowchart, sequence, class, ER, state), long descriptions going in `.blueprint/docs/` with a short note on the board, and tool calls appearing only as short rows.
  - `selectionHeader(board, graph, ids)` renders `[Selection on board "flow": a box "Login"; e arrow "ok" (a→b); d draw]`.
    Labels are whitespace-collapsed and JSON-quoted.
    A missing arrow end renders as `?`.
    Ids that are not in the graph, such as a bound label text, are skipped.
    It returns `""` when no ids are left.
  - `composeUserMessage(text, header)` returns `header + "\n\n" + text`, or `text` alone when the header is empty.
- `src/server/agent/hooks.ts`
  - `isProtectedPath(cwd, filePath)` resolves `filePath` against `cwd`.
    It returns true only for paths under `resolve(cwd, ".blueprint/boards") + sep` or `resolve(cwd, ".blueprint/assets") + sep`.
  - `denyBoardWrites` returns `{}` for non-`PreToolUse` events and for tools outside Write/Edit/MultiEdit/NotebookEdit.
    For those four tools, it checks `file_path`, or `notebook_path` for NotebookEdit.
    For a protected path it returns `hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: <the verbatim reason> }`.
- `src/server/ws.ts`: added `activeBoard: string | null`.
  Every `selection.changed` sets it to the board that message names.
  It is cleared together with `active` when the active socket disconnects, so a stale board name is never paired with a different tab's selection.

## TDD evidence

RED: `pnpm vitest run test/server/agent/tools.test.ts test/server/agent/prompt.test.ts test/server/agent/hooks.test.ts`

```
 FAIL  test/server/agent/tools.test.ts [ test/server/agent/tools.test.ts ]
Error: Cannot find module '../../../src/server/agent/tools.js' imported from .../test/server/agent/tools.test.ts
 Test Files  3 failed (3)
      Tests  no tests
```

(The prompt and hooks test files failed the same way, with modules not found.)

First GREEN run: one failure.
My ordering test for the prompt used `.blueprint/docs/` as a marker, but that path also appeared in the first bullet.
I reworded the first bullet to use relative subpaths and added the marker `long descriptions` to the test.

GREEN: `pnpm vitest run test/server/agent`

```
 Test Files  6 passed (6)
      Tests  24 passed (24)
```

`pnpm check` (tsc for both projects, biome, vitest):

```
Checked 69 files in 38ms. No fixes applied.
 Test Files  22 passed (22)
      Tests  100 passed (100)
```

I grepped the output for warnings, stderr, or errors and found none.
(Before that, biome reformatted my new files once with `--write`.)

## Manual verification

The brief names no manual verification.
The tool tests call the real `createSdkMcpServer` instance's registered handlers, so the SDK's registration and argument shapes are exercised for real.
Only the hub and the store are faked.

## Files changed

- `src/server/agent/tools.ts` (new)
- `src/server/agent/prompt.ts` (new)
- `src/server/agent/hooks.ts` (new)
- `src/server/ws.ts` (`activeBoard`)
- `test/server/agent/tools.test.ts`, `test/server/agent/prompt.test.ts`, `test/server/agent/hooks.test.ts` (new)

## Self-review findings

- `createBoardTools` takes `hub: Pick<WsHub, "request" | "activeBoard">`, not `Pick<WsHub, "request">` as the brief's signature says.
  The brief also says that `get_selection` reads `hub.activeBoard`, so the narrower type cannot work.
  Task 8 passes the real `WsHub`, which satisfies both.
- The tests read the McpServer's private `_registeredTools` to call the handlers.
  `@modelcontextprotocol/sdk` is not a direct dependency, so the tests cannot use an in-memory MCP client without adding a dependency.
  The tests depend on that private field name (MCP SDK 1.32.2).
- `selectionGraph` edge rule: the brief says "edges keep ends only if both are in ids" and also "edges between them".
  I implemented the union of the two: a selected arrow is kept, and so is an unselected arrow between two selected nodes.
  An end that is not selected becomes null, which the Markdown export already renders as `(free)`.
  This keeps the information that a selected arrow starts at a selected box.
- If the selection snapshot request fails (no tab), `get_selection` throws.
  The MCP server turns the throw into an error result that carries the message, such as "no browser tab is connected".
- `get_board` also throws when there are no boards or the board is not found, and relies on the same conversion to an error result.
  No test covers those two paths.

## Concerns

- The `activeBoard` change in `src/server/ws.ts` has no test in `test/server/ws.test.ts`, because that file is not in the brief's file list.
  It is three lines, and Task 8's integration path will exercise it.
  A two-assertion test would be worth adding there.
- `denyBoardWrites` covers only the file tools.
  A `Bash` command can still write under `.blueprint/boards/`.
  The code marks this with a `ponytail:` comment.
  Closing that gap needs either a Bash command parser or OS-level protection, which is out of scope for this task.

## Fix round 1

Commit: `6661360 fix(agent): anchor the board-write guard on the repository root`

### What changed

- Important 1: `denyBoardWrites` is now a factory, `denyBoardWrites(root: string): HookCallback` (the export name is unchanged).
  The protected directories are anchored on `root`.
  The hook's `input.cwd` is used only to resolve a relative `file_path` or `notebook_path`, via `isProtectedPath(root, resolve(input.cwd, path))`.
  `isProtectedPath(root, filePath)` keeps its signature, and `root` is the anchor.
  Task 8 must register `denyBoardWrites(cwd)` with the repository root it already receives.
- Important 2: added a `WsHub.activeBoard` test in `test/server/ws.test.ts`.
- Minor: the denial reason is now `Blueprint board files are read-only here. Describe the change in your reply, or ask the user to draw it.`
- Minor: `image()` throws `Error("malformed PNG data URL")` when the string does not start with `data:` or has no comma.
  In `get_board`, the existing catch turns this into `(No PNG: malformed PNG data URL)`.
  In `get_selection`, the error propagates as a tool error.
- Minor: `get_selection` returns `Nothing is selected on the board.` when the filtered graph has no nodes and no edges.
  An example is when only a bound label text is selected.
  It still returns early, without reading the board, when `ids` is empty or `activeBoard` is null.
- Minor: added tests for the `get_board` error paths.
  The fake store's `readBoard` now throws `NotFoundError` for an unknown name, as the real `FileStore` does.

### Covering tests

- `test/server/agent/hooks.test.ts`
  - "denyBoardWrites anchors on the repository root, not the agent's current directory" covers three cases, all with `cwd: "/repo/src"`:
    - An absolute `/repo/.blueprint/boards/x.excalidraw.json` is denied.
    - A relative `../.blueprint/assets/x.png` is denied.
    - A relative `.blueprint/boards/x.json` resolves to `/repo/src/.blueprint/...` and is allowed.
  - The existing deny test now expects the new reason text.
- `test/server/agent/tools.test.ts`
  - "get_board fails clearly when there are no boards or the board is unknown"
  - "get_board notes a malformed PNG data URL instead of sending a broken image"
  - The `get_selection` test gained a case where the selection is only a label (`ids: ["ta"]`).
- `test/server/ws.test.ts`: "activeBoard follows selection.changed and clears when the active socket leaves".

RED (before the fix): `pnpm vitest run test/server/agent/hooks.test.ts test/server/agent/tools.test.ts test/server/ws.test.ts`

```
   × denyBoardWrites denies a Write under .blueprint/boards and allows src/x.ts
   × denyBoardWrites anchors on the repository root, not the agent's current directory
   × get_board notes a malformed PNG data URL instead of sending a broken image
   × get_selection returns nothing-selected text, or the filtered graph markdown with the crop
TypeError: denyBoardWrites(...) is not a function
      Tests  4 failed | 14 passed (18)
```

The two new tests for the `get_board` error paths and `activeBoard` passed on the first run.
They add coverage for behavior that already worked.

GREEN, same command:

```
 Test Files  3 passed (3)
      Tests  18 passed (18)
```

`pnpm check`:

```
 Test Files  22 passed (22)
      Tests  104 passed (104)
```

The `pnpm check` output contained 0 lines matching warn, stderr, or error.
