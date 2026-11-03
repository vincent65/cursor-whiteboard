### Spec Compliance
- Spec compliant. Every interface in the brief matches exactly:
  - `TranscriptItem = PanelEvent` and `reduceTranscript(items, event)` (`src/ui/panel/transcript.ts:664-686`).
  - `agentSend(text, selection?)`, `agentInterrupt()`, `agentPermission(id, decision)` and `agentState()` (`src/ui/api.ts:183-212`).
  - `SelectionProvider`, `useSelection(): {board, ids, labels} | null` and `useSetSelection()` (`src/ui/selection.tsx:714-726`).
  - `BoardView` publishes the selection from the existing debounced handler (`BoardView.tsx:315-330`).
- The panel contents match the brief:
  - Header `Claude`, the status strip, and `Stop`.
  - Transcript rendering, including `Done · $<cost>` and the failure mark.
  - `PermissionDialog` for the oldest ask (`pending[0]`), with the three buttons.
  - The `<n> selected: <labels>` chip.
  - Enter sends, Shift+Enter inserts a newline, and the textarea is disabled while `starting`.
  - On mount the panel loads `agentState()` and then applies `agent.status` and `agent.event`.
- All four tests the brief lists exist and assert what it says:
  - `test/ui/transcript.test.ts:1355`
  - `test/ui/ClaudePanel.test.tsx:1075`, `:1173` and `:1209` (diff lines).
- Deviation (Minor): `Stop` is enabled for `needs_you` as well as `working` (`ClaudePanel.tsx:558`). The brief says "enabled while working". Since a turn waiting on a permission is still running, the wider reading holds up. The implementer disclosed it.
- Extras beyond the brief's file list. The report says the controller ruled for these, which I cannot verify:
  - `src/server/ws.ts:78` maps an empty board name to `null`. I checked the consumer: `src/server/agent/tools.ts:83` reads `hub.activeBoard`, so the change is justified.
  - `connectWs` waits for a connecting socket to open before closing it (`api.ts:249-253`).
  - Favicon and `index.html` link.
  - `.gitignore` narrowed to `src/ui/public/fonts/`. I checked `scripts/copy-excalidraw-assets.mjs:11`: it only writes to `public/fonts`, so narrowing is safe.
- Cannot verify from the diff:
  - The manual check (screenshots and the live Claude run) and the controller rulings.
  - Cross-task concern for the controller: the report says Stop leaves an interrupted turn as `Error: [ede_diagnostic] …` instead of `Idle`. That comes from the server session, not this diff, but Task 12's "Stop returns to Idle" check will fail until it is fixed.

### Strengths
- The reducer is small and correct:
  - An event with a known id replaces its item.
  - A stale partial is dropped after the final text arrives.
  - Restore-then-live duplicates collapse to one.
  - Permission events stay out of the transcript, because they reuse the tool_use id and would otherwise replace the tool row. There is a regression test for this (`transcript.test.ts:1373`).
- Restore race handling: live events received before the restore are reduced on top of the restored transcript (`ClaudePanel.tsx:481`), and a live status heard first wins (`:471`, `:486`).
- Value and setter are split into two contexts, so `BoardView` does not re-render on every selection change (`selection.tsx:709-712`).
- The unmount cleanup in `BoardView` relies on a pending debounced report being flushed first. I checked `useDebounced` (it flushes on unmount) and that `useSendToServer` returns a stable `send` (the `useState` initializer in `server-events.tsx`). The effect deps `[send, setSelection]` therefore never re-fire mid-life.
- Two risks in the selection-header regex (`ClaudePanel.tsx:413`) are ruled out:
  - Labels cannot contain newlines: `quote` in `prompt.ts` collapses whitespace.
  - `JSON.parse(header[1])` cannot throw on a real header: the board name is `JSON.stringify`'d.
- A failed send puts the user's text back (`:538`). Enter is ignored during IME composition (`:544`).
- Tests drive real DOM through the provider and userEvent. Only the API module and the socket hook are mocked.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- **Hardcoded status colors.** `src/ui/styles.css:833-847` and `:922` use raw hex values (`#16a34a`, `#d97706`, `#dc2626`). The brief asks for "the existing tokens". Add `--ok`, `--warn` and `--danger` to `:root` instead of scattering literals.
- **Permission buttons can double-submit.** They are not disabled while `agentPermission` is in flight (`PermissionDialog.tsx:642-650`, `ClaudePanel.tsx:552-556`). A double click sends a second POST for an id the server has already settled, and the error then shows in the alert line.
- **A failed permission answer leaves the dialog up.** For example, a 404 because another tab answered (`ClaudePanel.tsx:555`). It stays until the next status message. The stale `failure` line also stays until the next send, since only `send` clears it (`:530`).
- **The restore can re-add an answered ask.** If a non-`needs_you` status arrives before the restore, the restore's `pending` is merged in anyway (`:482-485`). The dialog would then show an answered ask until the next status. Gating the pending merge on `heardStatus` like the status would close this. The implementer disclosed it.
- **Duplicated type.** `AgentState` in `src/ui/api.ts:173-179` copies the server's `Agent.state()` return type (`src/server/agent/index.ts:30-36`) by hand. Moving it to `src/shared/` would keep them from drifting.
- **Header stripping can eat typed text.** A message the user typed that itself starts with `[Selection on board "…": …]\n\n` gets that line hidden (`ClaudePanel.tsx:416`). Unlikely, but the UI is matching on text format rather than a structured field on the user event.
- **Tests:**
  - The `selectionLabels` test sits in `ClaudePanel.test.tsx:1223` rather than its own file. The implementer chose this to stay within the brief's two test files.
  - Nothing tests that `BoardView` publishes the selection or clears it on unmount. Excalidraw does not load under vitest, so only the manual run covers this.

### Assessment
Task quality: Approved

Reasoning: All required interfaces, behaviors and tests are present and correct. The out-of-brief changes are small, tested, and justified by the consumers I checked. What remains is polish: color tokens, guarding the permission buttons in flight, and one disclosed restore race.
