### Task 9: UI shell, routing, and sidebar

**Files:**
- Create: `src/ui/index.html`, `src/ui/main.tsx`, `src/ui/App.tsx`, `src/ui/api.ts`, `src/ui/nav/Sidebar.tsx`, `src/ui/styles.css`, `vite.config.ts`
- Test: `test/ui/Sidebar.test.tsx`

**Interfaces:**
- Consumes: the REST routes from Task 6 and `ServerMessage` from Task 7.
- Produces (`src/ui/api.ts`): `listBoards()`, `createBoard(name)`, `getBoard(name): Promise<BoardFile>`, `saveBoard(name, scene: IncomingScene): Promise<BoardFile>`, `uploadBoardPng(name, blob: Blob)`, `listDocs()`, `createDoc(name)`, `getDoc(name): Promise<string>`, `saveDoc(name, text)`, `assetUrl(asset: string): string`, `connectWs(onMessage: (m: ServerMessage) => void): () => void` that reconnects with backoff.
- Produces (`src/ui/nav/Sidebar.tsx`): `Sidebar({ boards, docs, active, onCreateBoard, onCreateDoc }: { boards: string[]; docs: string[]; active: { kind: "board" | "doc"; name: string } | null; onCreateBoard(name: string): void; onCreateDoc(name: string): void })`.
- Routing: `#/boards/<name>` and `#/docs/<name>`; the default route opens the first board or shows an empty state.

- [ ] **Step 1: Write the failing test** (file starts with `// @vitest-environment jsdom`)

```tsx
test("lists boards and docs, marks the active one, and creates a board from a prompt", async () => {
  vi.spyOn(window, "prompt").mockReturnValue("new-board");
  const onCreateBoard = vi.fn();
  render(<Sidebar boards={["main"]} docs={["notes"]} active={{ kind: "board", name: "main" }} onCreateBoard={onCreateBoard} onCreateDoc={() => {}} />);
  expect(screen.getByRole("link", { name: "main" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "notes" })).toHaveAttribute("href", "#/docs/notes");
  await userEvent.click(screen.getByRole("button", { name: "New board" }));
  expect(onCreateBoard).toHaveBeenCalledWith("new-board");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run test/ui/Sidebar.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the shell**

`vite.config.ts`: `root: "src/ui"`, `build.outDir: "../../dist/ui"` with `emptyOutDir: true`, the React plugin, `define: { "process.env.IS_PREACT": JSON.stringify("false") }` (required by Excalidraw), and a dev proxy for `/api` to `http://localhost:4242` and `/ws` to `ws://localhost:4242` with `ws: true`.
`App.tsx`: three panes per the design tokens; the right pane shows the text `The Claude panel arrives in milestone 1.`; the sidebar reads lists from the API on mount and after creates; the main pane renders `BoardView` or `DocView` (Tasks 10 and 11; stub them as empty components here).
`Sidebar.tsx`: links as above; the create buttons call `window.prompt` and pass a trimmed non-empty result.

- [ ] **Step 4: Run the test and the build**

Run: `pnpm vitest run test/ui/Sidebar.test.tsx && pnpm vite build`
Expected: PASS; `dist/ui/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add src/ui vite.config.ts test/ui/Sidebar.test.tsx
git commit -m "feat(ui): app shell, hash routing, sidebar and api client"
```

---

