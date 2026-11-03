### Task 7: Board tools, system prompt, and the board-write hook

**Files:**
- Create: `src/server/agent/tools.ts`, `src/server/agent/prompt.ts`, `src/server/agent/hooks.ts`
- Test: `test/server/agent/tools.test.ts`, `test/server/agent/prompt.test.ts`, `test/server/agent/hooks.test.ts`

**Interfaces:**
- Consumes: `FileStore`, `WsHub.request` (Task 2), the export module.
- Produces:

```ts
// tools.ts
export function createBoardTools(deps: { store: FileStore; hub: Pick<WsHub, "request"> }): McpSdkServerConfigWithInstance;  // server name "blueprint", tools get_board and get_selection
export function selectionGraph(graph: BoardGraph, ids: string[]): BoardGraph;   // nodes, edges, loose filtered to ids; edges keep ends only if both are in ids
// prompt.ts
export const SYSTEM_PROMPT_APPEND: string;
export function selectionHeader(board: string, graph: BoardGraph, ids: string[]): string;   // "" when ids is empty
export function composeUserMessage(text: string, header: string): string;              // header + blank line + text, or text alone
// hooks.ts
export const denyBoardWrites: HookCallback;   // PreToolUse for Write|Edit|MultiEdit|NotebookEdit
export function isProtectedPath(cwd: string, filePath: string): boolean;
```

- `get_board({ board?: string })`: the board's Markdown export as a text block, then the PNG from `hub.request({ kind: "board.png", board })` as an image block; when the request fails, the text block ends with `(No PNG: <error>)`. With no `board`, the first board by name.
- `get_selection({})`: `hub.request({ kind: "selection.snapshot" })`; with no ids returns the text `Nothing is selected on the board.`; otherwise the Markdown of `selectionGraph` plus the PNG crop when present. The board name comes from the hub's last `selection.changed`, exposed as `hub.activeBoard`.
- `SYSTEM_PROMPT_APPEND` covers, in this order: where the plan files live (`.blueprint/` with boards, docs, spec, tasks); that boards are read with the two tools and never edited directly; that a selection header in a user message means "this" refers to those elements; that diagrams must be flowchart, sequence, class, ER, or state Mermaid (for milestone 2's proposals); that long descriptions go in a doc under `.blueprint/docs/` with a short note on the board; and that the user sees tool calls as short rows, so answers should be in the text.
- `selectionHeader` renders `[Selection on board "<board>": <id> <kind> "<label>"; ...; <edgeId> arrow "<label>" (<from>→<to>)]`.
- `isProtectedPath` resolves `filePath` against `cwd` and returns true under `.blueprint/boards/` or `.blueprint/assets/`.

- [ ] **Step 1: Write the failing tests**

```ts
test("get_board returns markdown and the PNG from the browser, or a note when the browser fails", ...);
test("get_selection returns nothing-selected text, or the filtered graph markdown with the crop", ...);
test("selectionGraph keeps only selected nodes, edges between them, and selected loose items", ...);
test("selectionHeader renders ids, kinds, labels, and arrow ends; empty ids give empty string", ...);
test("denyBoardWrites denies a Write under .blueprint/boards and allows src/x.ts", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/agent/tools.test.ts test/server/agent/prompt.test.ts test/server/agent/hooks.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three modules**

Tools use `tool(name, description, zodShape, handler)` and `createSdkMcpServer({ name: "blueprint", tools })` from the SDK; the PNG data URL from the browser is split into media type and base64 for the image block. The hub gains `activeBoard: string | null` in `src/server/ws.ts`, set by `selection.changed`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server/agent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agent/tools.ts src/server/agent/prompt.ts src/server/agent/hooks.ts src/server/ws.ts test/server/agent
git commit -m "feat(agent): board tools, system prompt, and the board-write guard"
```

---

