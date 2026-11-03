# Task 7 findings, round 1 (from review thr_2cfxbmfcdt, with controller rulings)

## Important
1. The board-write guard anchors its protected root on the hook's `cwd` (src/server/agent/hooks.ts), which is the agent's current directory and can drift after a `cd` in Bash. An absolute `Write` of `/repo/.blueprint/boards/x.excalidraw.json` is allowed once cwd is `/repo/src`.
   Ruling: `denyBoardWrites` becomes a factory `denyBoardWrites(root: string): HookCallback`. The protected root is `root` (the fixed repository root that `createAgent` receives as `cwd`); `input.cwd` is used only to resolve a relative `file_path`. `isProtectedPath(root, filePath)` keeps its signature with `root` as the anchor. Add a test with `cwd: "/repo/src"` and an absolute board path that must be denied.
2. The new `WsHub.activeBoard` state has no test. Add to `test/server/ws.test.ts`: `selection.changed` sets `activeBoard`; removing the active socket clears it.

## Minor (fix in this round, each is a few lines)
- The denial reason names a tool that does not exist ("use the propose tool in a later milestone"). Ruling: the brief did not mandate the text. Use: `Blueprint board files are read-only here. Describe the change in your reply, or ask the user to draw it.`
- `image()` assumes a well-formed data URL; without a comma it produces a garbage mimeType. Guard with one line and throw `Error("malformed PNG data URL")`.
- `get_selection` with ids that are not in the graph (only bound label texts) returns the Markdown of an empty graph. Return `Nothing is selected on the board.` when the filtered graph has no nodes and no edges, matching `selectionHeader`.
- Add tests for the `get_board` error paths: no boards, and an unknown board name.

## Minor (deferred, do not address)
- `isProtectedPath` is case-sensitive and does not resolve symlinks.
- Tests reach the private `_registeredTools` field of the MCP server.
- `selectionGraph` per-end nulling duplicates markdown.ts:34.
