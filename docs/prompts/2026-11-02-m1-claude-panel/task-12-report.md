# Task 12 report: Milestone acceptance

## What I implemented

Three fixes, each test-first and each in its own commit.
The first fixes the known defect.
The acceptance run found the other two.

1. `066d977 fix(agent): end an interrupted turn as idle instead of an error` (the known defect).
   `PlanSession.interrupt()` now marks the run as `interrupted` when a turn is in flight (status is not `idle`).
   When a result arrives on a run marked this way, the flag is cleared.
   If that result's subtype is not `success`, the session emits `{ kind: "result", subtype: "interrupted", costUsd, durationMs }` built from the SDK result, sets status `idle`, and emits no `error` event.
   A `success` result that comes after a Stop is still handled as a normal `Done`.
   An error result on a later turn is still handled as an error.
   `events.ts` is unchanged because the session builds this event itself.
   `ClaudePanel` shows a result with subtype `interrupted` as `Stopped` instead of `Done`, and adds ` · $cost` only when a cost is present.
2. `09da5a4 fix(agent): restore a saved Stop as a stopped row, not a user message` (found by the run).
   After a restart, the restored transcript showed the CLI's synthetic `[Request interrupted by user]` message as a blue user bubble.
   `restore()` now maps a saved prompt that starts with `[Request interrupted by user` to a `result` with subtype `interrupted` and cost `null`, so the panel shows `Stopped`.
   The prefix match also covers the CLI's `... for tool use]` form.
3. `a700acf fix(ui): keep the transcript pinned to the bottom when a permission ask opens` (found by the run).
   When the permission dialog opened, it took space from the transcript, and the latest user message was cut in half behind the dialog.
   The layout effect that keeps the transcript scrolled to the bottom now also runs when `pending` changes.

## TDD evidence

Fix 1, RED (`pnpm vitest run test/server/agent/session.test.ts`):
```
 × an error result after interrupt ends the turn as interrupted, not as an error 1066ms
AssertionError: expected 'error' to be 'idle' // Object.is equality
      Tests  1 failed | 9 passed (10)
```
GREEN: `Tests  10 passed (10)`.
For the panel row, RED (`pnpm vitest run test/ui/ClaudePanel.test.tsx`): `Unable to find an element with the text: Stopped · $0.0200`.
GREEN: `Tests  14 passed (14)` (panel and session tests together).

Fix 2, RED:
```
 × restore shows the CLI's interrupt marker as a stopped result, not a user message 7ms
      Tests  1 failed | 10 passed (11)
```
GREEN: `Tests  11 passed (11)`.

Fix 3, RED:
```
 × a permission ask keeps a transcript that was at the bottom pinned there 9ms
AssertionError: expected undefined to be 500 // Object.is equality
      Tests  1 failed | 4 passed (5)
```
GREEN: `Tests  5 passed (5)`.

Final `pnpm check`: tsc clean for both configs, `biome check` reported no errors (`Checked 81 files`), and `Test Files 27 passed (27)`, `Tests 124 passed (124)`.
`pnpm build`: only the existing chunk-size warning.

## Manual acceptance (real Claude Code login, built CLI)

Setup: I created a fresh git repository at `$TMPDIR/bp-accept` (README.md and index.js, one commit) and started `node dist/cli/index.js --no-open` there.
The Playwright MCP browser could not start ("Browser is already in use" by another session), so I used gstack browse at a 1440x900 viewport.
Excalidraw ignores keyboard input unless its container has focus, so the shapes were drawn with frame-paced synthetic pointer events and the labels were typed after focusing the container.

1. **Describe what I selected.**
   I drew the boxes `Auth service` and `User DB` with an arrow between them on board `acceptance`, then selected all three.
   The chip showed `3 selected: Auth service, User DB, arrow`.
   Rows: `ToolSearch`, `(non-text result)`, `reading the selection`, the selection's Mermaid summary, and then the answer.
   The answer named both boxes and "an arrow from Auth service to User DB", and the turn ended with `Done · $0.2068` and status `Idle`.
   Timing from first send: `Starting` at 57 ms, `Working` at 1.6 s (session init), first assistant text at **10.2 s**, and `Idle` 22 ms after that.
   The 10.2 s includes the two tool round trips.
   This first turn's answer came after its tool calls, so it showed up almost all at once.
   In the essay turn (step 3), text clearly streamed: 25, 278, 547, then 852 characters at one-second samples, starting about 12 s after send.
   Screenshot: `task-12-manual-1.png`.
2. **List the files in this repository.** **No permission dialog appeared.**
   Claude ran `git ls-files && echo --- && find . -path ./.git -prune -o -type f ...` and answered without asking.
   The user's settings do not allow-list these commands (I checked `~/.claude/settings*.json`).
   The CLI approves read-only shell commands by itself, so `canUseTool` is never called for them.
   This is not a Blueprint defect.
   To test the dialog, I asked `Use Bash to run exactly: touch acceptance-marker.txt`.
   Status changed to `Needs you`, and the dialog showed `Allow Bash: running \`touch acceptance-marker.txt\`` with `Allow once`, `Allow always`, and `Deny` (`task-12-manual-2.png`).
   This screen showed the scroll defect fixed by fix 3: the latest user bubble was half hidden behind the dialog.
   After `Allow once`, the rows were `running \`touch acceptance-marker.txt\``, `(Bash completed with no output)`, the answer, `Done · $0.2605`, and `Idle`.
   The file existed on disk.
3. **Stop during a long answer.** The prompt was a 1500-word essay with no tools.
   I clicked Stop after 852 characters had streamed.
   Status changed to **`Idle` 17 ms after the click**.
   The server sent `{kind:"result", subtype:"interrupted", costUsd:0.2605, durationMs:16072}`, and the row read `Stopped · $0.2605` (`task-12-manual-3.png`).
   There was no `Error:` status and no error row.
4. **Restart, reload, then What was my first question?**
   On the first restart, before fix 2, the transcript was restored, but the CLI's `[Request interrupted by user]` appeared as a user bubble.
   After fix 2, a rebuild, and another restart, the restored rows were: the four questions, all tool rows, all answer text, and a `Stopped` row at the end of the essay.
   Restored transcripts never include `Done` rows; this was already the case.
   I asked `What was my first question?`.
   `Starting` came at 57 ms, `Working` at 1.2 s, and `Idle` at 9.4 s.
   The answer was "Your first question was **"Describe what I selected"**", and it also named the three selected elements (`task-12-manual-4.png`).
5. **Live check of fix 3** (rebuilt CLI): I asked for another `touch`.
   When the dialog opened, the transcript was still scrolled to the bottom (distance 0 px), and the latest message was fully visible above the dialog (`task-12-manual-5.png`).
   `Deny` led to `Idle`, and no file was created.

Cleanup: I stopped all three server processes that I started and stopped the gstack browse daemon.
gstack wrote its `.gitignore` and `.gstack/` only in the scratch repository; the project repository was not touched (clean `git status`).

## Files changed

- `src/server/agent/session.ts`: the `interrupted` run flag, the mapping of an interrupted result, and the mapping of the restored interrupt marker.
- `test/server/agent/session.test.ts`: two new tests.
- `src/ui/panel/ClaudePanel.tsx`: the `Stopped` label, and re-pinning the transcript when `pending` changes.
- `test/ui/ClaudePanel.test.tsx`: an interrupted row added to the restore test, and one new scroll test.

## Self-review

- The interrupt flag is set only when a turn is in flight, so a Stop while idle cannot cause the next turn's real error to be labeled as stopped.
- The flag is cleared on the first result that follows, whatever that result is.
- The UI change for fix 1 is two lines, not one, because the cost suffix had to be separated from the label.
- In the scroll effect, the condition is `items.length + pending.length` because Biome rejects a dependency that the effect body does not read.
- The restore marker is matched by the CLI's literal text, because the saved message has no field that marks it as synthetic.
  If the CLI changes that text, the marker will show as a user bubble again; nothing else breaks.

## Concerns

1. **The brief's permission prompt does not trigger a dialog.** The CLI auto-approves read-only Bash commands such as `ls`, `find`, and `git ls-files`.
   The plan's acceptance script should use a command that writes, for example `touch`.
2. **The cost on result rows is a running session total, not the cost of that turn.**
   The SDK's `total_cost_usd` is cumulative in streaming-input sessions and continues after resume.
   In this run the values were $0.2068, $0.2377, $0.2605, $0.2605 (stopped), and $0.2899 after the restart.
   The text `Done · $X` reads as a per-turn cost.
   Showing the per-turn difference, or labeling the value as a total, is a product decision that I did not make here.
3. **Assistant markdown is shown as raw text** (`**"Auth service"**`, `# Who Goes There?`, and code fences).
   Rendering it needs either a markdown dependency or a renderer, which this task does not cover.
4. **The `ToolSearch` and `(non-text result)` rows still appear on every first turn** (the same issue as Task 9 concern 2).
5. Minor: with no board open, the composer still shows the placeholder "Ask Claude about this board".
