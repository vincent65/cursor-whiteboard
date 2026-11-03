# Task 9 report: The Claude panel UI

Status: DONE_WITH_CONCERNS

Commit: `b48910b feat(ui): the Claude panel with streaming transcript, permissions, and selection chips`

## What I implemented

- `src/ui/panel/transcript.ts`: `TranscriptItem = PanelEvent` and `reduceTranscript(items, event)`.
  An event whose id is already listed replaces that item in place, so a stream grows one paragraph and an event heard twice (restored, then live) shows once.
  A partial `assistant_text` arriving after its final text is dropped (final text wins).
  `permission` events never enter the transcript (see "Bugs found by the manual run").
- `src/ui/selection.tsx`: `SelectionProvider`, `useSelection()`, `useSetSelection()`, plus an exported `selectionLabels(elements, ids)`.
  The value and the setter are two contexts, so `BoardView` does not re-render on every selection change.
  Labels: bound text of the shape, else the element's own text, else the element type; whitespace collapsed; in element order.
- `src/ui/api.ts`: `agentSend(text, selection?)` posts `{ text, selection: { board, ids } }` (labels stripped) and returns the user event id; `agentInterrupt()`, `agentPermission(id, decision)`, `agentState()` (typed `AgentState`).
  `connectWs`: an empty board name clears the remembered selection (nothing re-sent on reconnect); `close()` on a CONNECTING socket sets `onopen = () => socket.close()`.
- `src/ui/panel/PermissionDialog.tsx`: inline `.notice` with `Allow <tool>: <summary>` and `Allow once` / `Allow always` / `Deny` (`.button`), `role="alertdialog"`.
- `src/ui/panel/ClaudePanel.tsx`:
  - Header `Claude`, status strip (`Starting`, `Idle`, `Working`, `Needs you`, `Error: <message>`, `Stopped`) with a colored dot and a hover title, `Stop` button.
  - Transcript: user bubbles right-aligned; assistant text in `<p class="msg-assistant">` with `pre-wrap`; tool rows and tool results muted, failed results get a `✗` (`role="img" aria-label="failed"`); result rows `Done · $<cost.toFixed(4)>` or `Done`; error events as a muted `✗ <message>` row.
  - Oldest pending ask shows the dialog; pending comes from `agentState().pending` plus live `permission` events, is removed on a successful answer, and is cleared whenever a status other than `needs_you` arrives (the server reports `needs_you` while any ask waits).
  - Selection chip `<n> selected: <labels>` above the textarea, or nothing.
  - Textarea: Enter sends (ignores IME composition), Shift+Enter inserts a newline, disabled while `starting`; sending while working is allowed.
    A failed send puts the text back and shows the error in a `role="alert"` line.
  - On mount loads `agentState()`; live events that beat the restore are reduced on top of it; a live status heard before the restore wins.
  - Auto-scroll to the bottom on new items only if the reader was at the bottom.
- `BoardView`: the existing debounced handler now also computes labels and publishes `{ board, ids, labels }` via `useSetSelection`; the server still only gets `selection.changed` when ids change.
  On unmount (effect declared after `reportSelection`, so a pending report flushes first) it clears the context and sends `selection.changed` with `board: ""`, `ids: []`.
- `WsHub`: `activeBoard = msg.board || null`.
- `App`: `SelectionProvider` wraps the shell; the right pane renders `ClaudePanel`.
- `styles.css`: `.panel`, `.panel-header`, `.status`, `.transcript`, `.msg-user`, `.msg-assistant`, `.msg-tool`, `.msg-result`, `.chips`, `.composer` with existing tokens, plus `.panel-title`, `.msg-user-note`, `.chip`, `.panel-failure`.
- `favicon.svg` in `src/ui/public/`, linked from `index.html`.

## TDD evidence

RED (before any implementation):

```
$ pnpm vitest run test/ui/transcript.test.ts test/ui/ClaudePanel.test.tsx
 FAIL  test/ui/transcript.test.ts
Error: Cannot find module '../../src/ui/panel/transcript' imported from .../test/ui/transcript.test.ts
 Test Files  2 failed (2)
      Tests  no tests
```

Carried fixes, RED:

```
$ pnpm vitest run test/ui/server-events.test.tsx test/server/ws.test.ts
     × an empty board name means the tab closed its board
   × an empty board clears the selection a reconnect would send
   × closing before the socket opens waits for it to open, then closes
 FAIL ... AssertionError: expected '' to be null
 FAIL ... AssertionError: expected [ Array(1) ] to deeply equal []
 FAIL ... AssertionError: expected 2 to be +0 // Object.is equality
      Tests  3 failed | 15 passed (18)
```

GREEN after the fixes: `Tests  18 passed (18)`; panel and transcript: `Tests  5 passed (5)`.

Two more RED/GREEN cycles came out of the manual run:

```
# user bubble shows the server's selection header
× panel renders restored transcript, ... TestingLibraryElementError: Unable to find an element with the text: What is here?
→ Tests  4 passed (4)

# permission ask replaced its tool row
× a permission ask stays out of the transcript and keeps its tool row
AssertionError: expected [ 'permission' ] to deeply equal [ 'tool_use' ]
→ Tests  25 passed (25)   (pnpm vitest run test/ui)
```

Final: `pnpm check` pristine (tsc both projects, biome `No fixes applied`, `Test Files 25 passed`, `Tests 119 passed`, no stderr).
`pnpm build` succeeds with only the pre-existing chunk-size warning.

## Manual observations

Built app (`node dist/cli/index.js --no-open`) in a fresh git repo under `$TMPDIR`, real Claude Code login, driven with Playwright at 1400x850.

- Drew two labeled boxes and an arrow, selected all: chip read `3 selected: Auth service, User database, arrow`.
- `Describe what I selected`: status went `Starting` → `Working` → `Idle`; rows `ToolSearch`, `(non-text result)`, `reading the selection`, the board markdown result, then the answer naming both boxes and the arrow, then `Done · $0.1758`.
- Streaming: on a longer question, sampling every 100 ms, the last assistant paragraph grew 15 → 106 → 181 → … → 1508 characters before `Idle`.
- Reload: the restored transcript renders, scrolled to the bottom.
- Permission: `touch scratch-task9.txt` showed `Allow Bash: running \`touch scratch-task9.txt\`` with the three buttons, status `Needs you`, Stop enabled; `Allow once` ran it and the dialog went away. `Deny` on a second one left the tool row plus `✗ The user denied this action in Blueprint.` (`ls` via Bash was auto-allowed by the user's own Claude Code settings, so it never asked.)
- Stop during a 1500-word essay: the status left `Working` 51 ms after the click and Stop disabled, but the server reported the interrupted turn as `Error: [ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null`, with a matching `✗` error row. See Concerns.
- Dev mode (vite against the server, StrictMode): no console warnings or errors (no "WebSocket is closed before the connection is established"), `/favicon.svg` 200, no failed requests; switching boards exercised the unmount path with no errors.
- Screenshots: `task-9-manual-1.png` … `task-9-manual-5.png` in this folder (5 is the final layout).

### Bugs found by the manual run (fixed in this commit)

1. The user bubble showed the server's selection header with raw element ids (`[Selection on board "main": xz5w… box "Auth service"; …]`).
   The panel now strips that one-line header (format from `selectionHeader` in `server/agent/prompt.ts`) and shows a muted `with the selection on main` under the bubble. This works for restored transcripts too.
2. A tool row vanished while its permission was asked: the broker's permission event reuses the tool_use id, so the reducer replaced the row with the invisible permission item. Asks now stay out of the transcript.
3. Layout: transcript rows with `overflow: hidden` shrank to 0 px in the flex column (tool rows and result rows invisible, long answers clipped). Fixed with `.transcript > * { flex-shrink: 0 }`.

## Files changed

`.gitignore`, `src/server/ws.ts`, `src/ui/App.tsx`, `src/ui/api.ts`, `src/ui/board/BoardView.tsx`, `src/ui/index.html`, `src/ui/panel/ClaudePanel.tsx` (new), `src/ui/panel/PermissionDialog.tsx` (new), `src/ui/panel/transcript.ts` (new), `src/ui/public/favicon.svg` (new), `src/ui/selection.tsx` (new), `src/ui/styles.css`, `test/server/ws.test.ts`, `test/ui/ClaudePanel.test.tsx` (new), `test/ui/server-events.test.tsx`, `test/ui/transcript.test.ts` (new).

Beyond the brief's list, all under controller rulings or forced by them: `ws.ts` and `ws.test.ts` (empty board → null), `server-events.test.tsx` (empty-board and close-while-connecting cases, plus `agentState` in its api mock so `App` renders), `index.html` and `favicon.svg`, and `.gitignore`: `src/ui/public/` was ignored wholesale, so I narrowed it to `src/ui/public/fonts/` (the only generated content) to track the favicon.

## Self-review findings

- `Stop` is enabled for `working` and also `needs_you` (a turn waiting on a permission is still a running turn and interrupt cancels the ask). The brief says "enabled while working"; one-line change if the stricter reading is wanted.
- The selection header parse couples the panel to the server's header format; the regex comment names `selectionHeader`. If the format changes, the bubble falls back to showing the raw text, nothing breaks.
- When the restored state arrives after a live status that already cleared asks, the restore's `pending` could re-add an answered ask until the next status. The window is the first `/state` round trip; a 404 on answering would show in the failure line.
- `selectionLabels` lives in `selection.tsx` and is tested in `ClaudePanel.test.tsx` to stay within the brief's two test files.
- No Markdown rendering (per ruling), so `**bold**` and tables show as raw text in answers.

## Concerns

1. Stop yields an error status: an interrupted turn ends as `Error: [ede_diagnostic] …` instead of returning to `Idle`. This is the Task 6 concern ("an interrupted turn may end as an error result"); the panel faithfully shows what the server sends. Task 12's check "Click Stop … see status return to Idle" will fail until the session maps an interrupted result to idle.
2. Every first turn shows a `ToolSearch` row followed by `(non-text result)`: CLI-internal deferred tool loading surfaces as tool traffic. Server-side summarizing (events.ts) could hide or rename it; not in this task's files.
