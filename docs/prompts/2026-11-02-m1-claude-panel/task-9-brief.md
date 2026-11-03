### Task 9: The Claude panel UI

**Files:**
- Create: `src/ui/panel/ClaudePanel.tsx`, `src/ui/panel/transcript.ts`, `src/ui/panel/PermissionDialog.tsx`, `src/ui/selection.tsx`
- Modify: `src/ui/api.ts`, `src/ui/App.tsx`, `src/ui/board/BoardView.tsx`, `src/ui/styles.css`
- Test: `test/ui/transcript.test.ts`, `test/ui/ClaudePanel.test.tsx`

**Interfaces:**
- Produces in `src/ui/panel/transcript.ts`:

```ts
export type TranscriptItem = PanelEvent;   // partial assistant_text events replace the item with the same id
export function reduceTranscript(items: TranscriptItem[], event: PanelEvent): TranscriptItem[];
```

- Produces in `src/ui/api.ts`: `agentSend(text, selection?)`, `agentInterrupt()`, `agentPermission(id, decision)`, `agentState()`.
- Produces in `src/ui/selection.tsx`: `SelectionProvider`, `useSelection(): { board: string; ids: string[]; labels: string[] } | null`, `useSetSelection()`; `BoardView` publishes its selection (ids plus the labels of the selected elements) through it in the same debounced handler as Task 4.
- `ClaudePanel` renders: a header `Claude` with the status strip (`Idle`, `Working`, `Needs you`, `Error: <message>`, `Starting`) and a `Stop` button enabled while working; the transcript (user items right-aligned, assistant text as paragraphs preserving line breaks, tool rows muted as `<summary>`, tool results muted with a failure mark when not ok, result rows as `Done · $<cost>` when cost is known); the inline `PermissionDialog` for the oldest pending ask with `Allow once`, `Allow always`, `Deny`; selection chips above the input showing `<n> selected: <labels>` or nothing; a textarea where Enter sends and Shift+Enter inserts a newline, disabled while the status is `starting`.
- On mount the panel loads `agentState()` and then applies `agent.event` and `agent.status` messages from `useServerEvent`.

- [ ] **Step 1: Write the failing tests**

```ts
test("reduceTranscript appends events and replaces a partial text by id, final text wins", ...);
test("panel renders restored transcript, sends on Enter with the current selection, shows Stop while working", ...);   // api mocked
test("a pending permission renders the dialog and Allow always calls agentPermission with behavior always", ...);
test("an error status shows the message", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/ui/transcript.test.ts test/ui/ClaudePanel.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the panel**

Styles in `styles.css` with the existing tokens: `.panel`, `.panel-header`, `.status`, `.transcript`, `.msg-user`, `.msg-assistant`, `.msg-tool`, `.msg-result`, `.chips`, `.composer`; the dialog uses `.notice` and `.button`. The transcript auto-scrolls to the bottom when a new item arrives and the user is already at the bottom.

- [ ] **Step 4: Run the tests, the build, and verify by hand**

Run: `pnpm vitest run test/ui && pnpm build && pnpm dev`
Then: with a board open and shapes selected, ask `Describe what I selected`; confirm a `reading the selection` row, streaming text, an `Idle` status with cost, and that the chips showed the selection.
Expected: tests PASS, build succeeds, the check holds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panel src/ui/selection.tsx src/ui/api.ts src/ui/App.tsx src/ui/board/BoardView.tsx src/ui/styles.css test/ui/transcript.test.ts test/ui/ClaudePanel.test.tsx
git commit -m "feat(ui): the Claude panel with streaming transcript, permissions, and selection chips"
```

---

