### Finding Verdicts

1. **Important: the guard anchors on the hook's `cwd` - ADDRESSED.**
   - `src/server/agent/hooks.ts:18` makes `denyBoardWrites` the factory `(root: string): HookCallback`.
   - The protected directories are anchored on `root`. `input.cwd` is only used to resolve the path, through `isProtectedPath(root, resolve(input.cwd, path))`.
   - `isProtectedPath(root, filePath)` keeps its signature.
   - `test/server/agent/hooks.test.ts:66` adds the required case: `cwd: "/repo/src"` with the absolute path `/repo/.blueprint/boards/x.excalidraw.json` is denied. The same test checks that a relative `../.blueprint/assets/x.png` is denied, and that `.blueprint/boards/x.json` (which resolves to `/repo/src/.blueprint/...`) is allowed.
   - Nothing in `src` calls `denyBoardWrites` yet, so the signature change breaks no call site. Task 8 must register it as `denyBoardWrites(cwd)`, as the report notes.

2. **Important: `WsHub.activeBoard` has no test - ADDRESSED.**
   - The new test in `test/server/ws.test.ts` checks that `activeBoard` starts as null and that `selection.changed` sets it, for two sockets in turn.
   - It also checks that removing the socket that is not active keeps `activeBoard`, and removing the active socket clears it to null.
   - The test matches the code at `src/server/ws.ts:36` and `src/server/ws.ts:67`.

**Minor: denial reason names a tool that does not exist - ADDRESSED.**
`src/server/agent/hooks.ts:5-6` now uses the exact text from the ruling, and the test expectation is updated.

**Minor: `image()` assumes a well-formed data URL - ADDRESSED.**
`src/server/agent/tools.ts` throws `Error("malformed PNG data URL")` when the string does not start with `data:` or has no comma. The new test "get_board notes a malformed PNG data URL..." confirms that `get_board` catches it and returns a text note instead of an image.

**Minor: `get_selection` on ids outside the graph - ADDRESSED.**
`get_selection` now returns `Nothing is selected on the board.` when the filtered graph has no nodes and no edges. The new case `ids: ["ta"]` (only a bound label text) covers it.

**Minor: `get_board` error paths have no tests - ADDRESSED.**
The new test "get_board fails clearly when there are no boards or the board is unknown" covers both paths. The fake store's `readBoard` now throws `NotFoundError` for an unknown name, as the real store does.

Tests: the report names the covering tests and shows the output before the fix (4 failed) and after (18 passed, and `pnpm check` 104 passed). The claims match the diff. I did not re-run anything.

### New Breakage in the Fix Diff

None at Critical or Important level.

- **Minor:** in `get_selection`, a malformed crop now makes `image()` throw, so the whole tool call fails. `get_board` instead catches the same error and returns a note. The ruling only asked for the throw, so this is acceptable, but the two tools now handle the same input differently.

### Out-of-Scope Observations

- The test name "isProtectedPath covers boards and assets only, after resolving against cwd" (`test/server/agent/hooks.test.ts:55`) still says "cwd", but the parameter is now `root`. This is cosmetic.

### Verdict

Fix round: all findings are addressed, and the fix adds no new Critical or Important breakage.
