I'm checking the export module's frame and edge handling and the board-name validation, then writing the report.

### Spec Compliance
- **Issues found (minor, justified):** `createBoardTools` takes `hub: Pick<WsHub, "request" | "activeBoard">` (`src/server/agent/tools.ts:156`). The brief's contract says `Pick<WsHub, "request">`. The brief also requires `get_selection` to read `hub.activeBoard`, so the contract signature cannot work as written. The wider type is the only consistent reading, and the real `WsHub` satisfies it. The plan's Interfaces block should be corrected so Task 8 doesn't trip on it.
- **Interpretation:** `selectionGraph` uses a union rule (`tools.ts:136-142`): it keeps a selected arrow even when its ends are unselected, and it keeps an unselected arrow whose two ends are both selected. Each unselected end is set to null on its own. The brief's literal wording ("edges keep ends only if both are in ids") is ambiguous, and the brief's test title ("edges between them") matches the implementation. I accept it. One correction to the report: the per-end nulling duplicates `src/export/markdown.ts:34`, which already turns ends that are not nodes into `(free)`. I checked that because of a dangling-reference risk in Mermaid output.
- **All five tests in the brief exist and assert what it says:**
  - `tools.test.ts:524` and `:555`
  - `tools.test.ts:582`
  - `prompt.test.ts:396`
  - `hooks.test.ts:299`
- **Extra tests (good, not scope creep):**
  - `composeUserMessage` (`prompt.test.ts:405`)
  - prompt order (`prompt.test.ts:412`)
  - `isProtectedPath` (`hooks.test.ts:334`)
- **`SYSTEM_PROMPT_APPEND`:** the six topics appear in the brief's order (`prompt.ts:68-73`), and the test checks the order.
- **`selectionHeader`:** the format matches the brief (`prompt.ts:99`), and it returns `""` for empty ids.
- **Server name:** `"blueprint"`, built with the SDK's `tool()` and `createSdkMcpServer()` as required.
- **PNG data URL:** split into media type and base64 (`tools.ts:148-152`).
- **`hub.activeBoard`:** added and set from `selection.changed` (`ws.ts:228`, `:262`).
- **Cannot verify from diff:**
  - Whether `REASON` (`hooks.ts:27-28`) is the spec's verbatim text, as the report claims.
  - Whether the SDK MCP server turns handler throws into `isError` results, which `get_board` and `get_selection` rely on.
  - `pnpm build` output. The report gives `pnpm check` output only and says nothing about `pnpm build`.
- **Checked outside the diff:**
  - `FileStore.readBoard` (`src/server/files.ts:142`) resolves through `boardPath`. The model-supplied `board` argument reaches it unfiltered, so I checked it. It passes through the store's existing name handling (`assertSlug` at `files.ts:71`).
  - `markdown.ts:49-51` and `:115` handle a `frameId` that points to an unselected frame. I checked this because `selectionGraph` does not clear `frameId`.

### Strengths
- The tool tests run the real `createSdkMcpServer` instance. Only the store and the hub are faked, so tool registration and the content-block shapes are exercised for real.
- `isProtectedPath` appends `sep`, which rejects sibling prefixes like `boards-old`, and it uses `resolve`, which handles `..` traversal. Both are tested (`hooks.test.ts:337-341`).
- Clearing `activeBoard` together with `active` on disconnect (`ws.ts:237-240`) prevents a stale board name from being paired with a different tab's selection.
- The report is candid about its deviations: the `Pick` widening, the use of a private field in tests, and the Bash gap.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
1. **The board-write guard anchors on the hook's `cwd`, not on the repository root** (`hooks.ts:49`, `hooks.ts:33`).
   - **Why it matters:** `input.cwd` is the agent's *current* working directory. If Claude Code keeps a `cd src` between Bash calls, which it does for directories inside the project, a later `Write` gets this check:
     - The call: `Write { file_path: "/repo/.blueprint/boards/flow.excalidraw.json" }`, an absolute path, which the Write tool requires.
     - The protected root becomes `/repo/src/.blueprint/boards/`, so the write is allowed.
   - **Effect:** this silently breaks the global constraint that Claude never edits board files. The Bash gap is acknowledged; this one is not. It needs no deliberate workaround, only an earlier `cd`.
   - **Confidence:** plausible, not confirmed. I did not verify the SDK's exact `cwd` semantics after a `cd`.
   - **Partly plan-mandated:** the brief says to resolve against `cwd`, but that is ambiguous between "resolve the path against cwd" and "anchor the root at cwd".
   - **Fix:** take the protected root from the fixed session root, which per the global constraints is the repository root. For example, anchor at `process.cwd()` or use a root captured when the session starts, and keep `input.cwd` only for resolving relative `filePath`s. Add a test with `cwd: "/repo/src"` and an absolute board path.
2. **The `activeBoard` change in `src/server/ws.ts` has no test** (`ws.ts:228`, `:239`, `:262`).
   - **Why it matters:** this is new hub state that a later task's tool depends on, including the clear-on-disconnect behaviour, and nothing pins it down.
   - **Fix:** add two assertions to `test/server/ws.test.ts`: `selection.changed` sets the board, and removing the active socket clears it. The implementer flagged this gap too. The brief's file list doesn't forbid it; the brief's commit step already stages `ws.ts`.

#### Minor (Nice to Have)
1. **`isProtectedPath` compares with `startsWith`, which is case-sensitive** (`hooks.ts:32-33`). macOS uses a case-insensitive filesystem by default, so `.Blueprint/Boards/x.json` reaches the protected file but passes the check. Symlinks are not resolved either. This is low likelihood, because the model normally writes the canonical path.
2. **The denial reason confuses the model** (`hooks.ts:27-28`). "use the propose tool in a later milestone" names a tool that does not exist and refers to project milestones it has no context for. If the spec does not mandate this exact text, a reason like "Board files are read-only; describe the change or ask the user to draw it" would serve better.
3. **The tests reach into the private `_registeredTools`** (`tools.test.ts:515-519`). That is fragile across MCP SDK upgrades. The values returned by `tool()` already expose a public `.handler`, so exporting the two definitions, or a `boardTools(deps)` array that `createBoardTools` wraps, would let the tests avoid private fields. The current test of server registration could stay as one assertion on `server.name`.
4. **No test covers the `get_board` error paths** (`tools.ts:167-168`): no boards, and an unknown board name. No test covers a failing selection snapshot either. These paths rely on the SDK turning a throw into an error result, and nothing checks that.
5. **`image()` assumes a well-formed data URL** (`tools.ts:149-151`). Without a comma, `indexOf` returns -1, which produces a garbage `mimeType` and puts the whole string in `data`. In `get_board`, a malformed URL fails inside the `try` and is reported as a confusing `(No PNG: ...)` note. In `get_selection`, it produces a broken image block. A guard costs one line.
6. **Selecting only bound label texts gives an empty export** (`tools.ts:192`). If `ids` contains only ids that are not in the graph (for example a bound text `ta`), `get_selection` returns the Markdown of an empty graph rather than `Nothing is selected on the board.`. `selectionHeader` already skips unknown ids (`prompt.ts:86`), but the tool does not. Checking whether the filtered graph is empty would align them.
7. **`selectionGraph` duplicates existing nulling** (`tools.ts:131-132`, `:142`). Its per-end `keep()` nulling repeats `markdown.ts:34`. It is harmless and reads as intent, so it can stay.

### Assessment
Task quality: Needs fixes

Reasoning: the brief is followed closely, the tests are real, and the code is tight. However, the board-write guard derives its protected root from the drifting hook `cwd`. That can silently allow the exact write the global constraint forbids, and the new `WsHub.activeBoard` state has no test.
