### Task 6: The sessions view

**Files:**
- Create: `src/ui/sessions/SessionsView.tsx`, `src/ui/sessions/RunCard.tsx`, `src/ui/panel/TranscriptList.tsx`
- Modify: `src/ui/panel/ClaudePanel.tsx` (use `TranscriptList`), `src/ui/api.ts`, `src/ui/hooks/useHashRoute.ts`, `src/ui/nav/Sidebar.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`
- Test: `test/ui/RunCard.test.tsx`, `test/ui/SessionsView.test.tsx`

**Interfaces:**
- `Route` gains `{ kind: "sessions" }` (`#/sessions`); the sidebar's `Plan` section gains `Sessions`; `App` renders `SessionsView` full width (no Claude panel beside it) for that route.
- `src/ui/api.ts`: `listRuns()`, `launchRun(body)`, `runMessage(id, text)`, `runStop(id)`, `runResume(id)`, `runPermission(id, permissionId, decision)`, `runTranscript(id)`, `gate(slug)`, `listSessions()`, `sessionTranscript(id)`.
- `TranscriptList({ items })` is the transcript rendering lifted out of `ClaudePanel` unchanged in output.
- `RunCard` props: `{ run: RunView; transcript: PanelEvent[]; onMessage(text); onStop(); onResume(); onPermission(id, decision) }`. Shows the task slug and title, a status chip (`Working`, `Needs you`, `Idle`, `Done`, `Failed: <message>`, `Interrupted`), the branch, `PR` link when `prUrl` is set, `$<cost> total`, the last assistant text (two lines, clipped), a collapsible transcript, the permission dialog for its oldest ask, a message box (Enter sends), `Stop` while working or needs_you, `Resume` while interrupted, and a `Copy resume command` button that copies `cd <worktree> && claude --resume <sessionId>`.
- `SessionsView` loads `listRuns()` and each transcript lazily when a card expands, applies `run.event`, `run.status`, and `runs.changed` messages, shows the note `Runs share your Claude subscription's rate limits.` above the cards, and lists other sessions below with a read-only transcript on expand.

- [ ] **Step 1: Write the failing tests**

```tsx
test("RunCard shows status, cost, PR link, and the right buttons per status", ...);
test("RunCard's message box sends and the permission dialog answers with the run id", ...);
test("SessionsView routes run.event and run.status to the matching card only", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sessions src/ui/panel/TranscriptList.tsx src/ui/panel/ClaudePanel.tsx src/ui/api.ts src/ui/hooks/useHashRoute.ts src/ui/nav/Sidebar.tsx src/ui/App.tsx src/ui/styles.css test/ui/RunCard.test.tsx test/ui/SessionsView.test.tsx test/ui/useHashRoute.test.ts test/ui/Sidebar.test.tsx
git commit -m "feat(ui): the sessions view with run cards and other sessions"
```

---

