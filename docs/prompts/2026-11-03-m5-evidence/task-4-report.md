# Task 4 report: Polish backlog

Status: DONE_WITH_CONCERNS

BASE: a9c8a32. HEAD: 9db2263. Sixteen commits, one per item, plus one end-frame fix and the demo re-record.

## Commits

| Item | Commit | Subject |
| --- | --- | --- |
| 1 | 8ba4e12 | fix(ui): the sidebar drops a board or doc deleted on disk |
| 2 | aad9ff3 | fix(ui): Allow always reads Allow for this session when the SDK suggests no rule |
| 3 | a346d5e | fix(server): ToolSearch rows read loading tools, and a non-text result reads done |
| 9 | 61a11ac | fix(server): Blueprint's own tool results read as sentences |
| 10 | a035386 | fix(server): tool rows show paths relative to the session directory |
| 4 | c41fe66 | fix(ui): other-session transcripts and the launch gate refresh on runs.changed, and the gate names the branch |
| 5 | 2364bcc | test(runs): newRunId's retry, a write after a failed write, and isAncestor's re-throw |
| 6 | f1a862a | fix(runs): a failed run's endedAt stays put when only its failure message changes |
| 7 | 07078fb | fix(server): compile skips an unreadable doc with a warning, as it does a board |
| 8 | 1fe25b7 | feat(ui): Stop reads Stopping… until the interrupt lands |
| 11 | 5e1d8c3 | test(e2e): the run writes before it asks to push, a flow without a demo name fails by name, and a failed seed leaves no temp repository |
| 12 | f872b25 | feat(runs): a run's transcript opens with Start task <slug>, live and restored |
| 13 | 7095a36 | feat(ui): citations in Claude's replies render as chips in the panel and run transcripts |
| 14 | fd7dac2 | docs(ui): the Markdown comment says a blank line in a nested list ends the outer list |
| end frame | 991154f | style(ui): a run card's preview keeps the reply's line breaks |
| last step | 9db2263 | docs(demo): re-record the flows with the restyle and the polished rows |

Item 0 needed no commit (confirmed in the browser, see below).

## What I implemented

1. The watcher marks an `unlink` as `deleted: true` on the `file-changed` message (`src/server/watch.ts`, `src/shared/messages.ts`, `src/server/index.ts`).
   `App` refetches the sidebar lists on a deleted board or doc, as well as on an unknown name.
2. `PendingPermission` (and so the `permission` panel event, now `{ kind: "permission" } & PendingPermission`) carries `canAlways: boolean`, true when the SDK sent at least one suggestion.
   `PermissionDialog` labels the second button `Allow always` or `Allow for this session`.
   So the label is true, the broker answers `always` without suggestions with one session-scoped rule for the tool (`addRules`, `destination: "session"`), where it used to send `[]` (which was allow once).
3. `summarizeTool("ToolSearch")` reads `loading tools`; a tool result with no text reads `done`.
9. `SdkEventMapper` remembers each tool_use's name, so a result reads in its tool's terms: propose and revise read `proposal <id> is on the board`, get_board `read the board`, get_selection `read the selection`; an error result keeps its message.
10. `relativeTo(cwd)` in `events.ts` strips the session directory, under both its given and real path (macOS `/var` vs `/private/var`, longest first), from tool summaries and result text.
    `summarizeTool` takes the relativizer; the mapper takes `cwd`; the broker takes `cwd` for ask summaries.
    The plan session passes its cwd, runs their worktree, restored transcripts their cwd, and other-session transcripts the repository root.
4. `checkGate` returns `branch` from a new `branchFor(slug)` in `runs/git.ts`, which `createWorktree` also uses; `LaunchDialog` renders `gate.branch` and lost its unused `slug` prop.
   `TasksView` refetches the open dialog's gate on `runs.changed` (a stale answer for a closed or different dialog is dropped).
   An open other-session transcript reloads on `runs.changed`; a closed one forgets its items and reloads on next open; only the newest request lands.
5. Tests only: `newRunId` redraws when the id is a stored run's (mocked `randomBytes`), a write queued behind a failed write starts from the on-disk state and lands, and `isAncestor` re-throws a git failure other than exit 1 (an unborn HEAD gives 128).
6. `#derive` keeps `endedAt` when the status stays the same and only the failure message changes.
7. `compile()` reads docs with try, warn `skipping doc <name> in the compile: <message>`, and skip.
8. The panel and the run card show `Stopping…` (disabled) from the Stop click until a status other than working or needs_you; a failed Stop gives the button back and shows the error.
11. Scenario run steps are write, ask (push), say; `afterEach` throws `no DEMO_NAMES entry for the test "<title>"` in every project; the fixture registers the temp directory before git init and the seed.
12. `runLabel(slug)` is `Start task <slug>`; launch and the no-session resume send the full prompt and show the label.
    `shownRunPrompt(prompt, run)` maps a saved prompt that starts with this run's first line to the label; `PlanSession` deps take an optional `shownPrompt` for restore, which the run manager supplies.
13. `TranscriptList` passes `renderCitation` with `CitationLink`, so the panel, run transcripts, and other-session transcripts render chips.
14. The `ponytail:` comment now says a blank line inside a nested list ends the whole outer list, and the nested items after it render as a separate top-level list.
    I confirmed this by rendering `- a\n  - b\n\n  - c\n- d`, which gave `<ul><li>a<ul><li>b</li></ul></li></ul><ul><li>c</li><li>d</li></ul>`.

End-frame fix: the run card's two-line preview ran Claude's lines together (`…on this branch. https://…/pull/1 The sign-in check…`).
It now keeps line breaks (`white-space: pre-line`) with blank lines collapsed, so the two lines shown are the first two lines of the reply.

## TDD evidence

Every behaviour item had its test written first and seen failing for the right reason before the fix:

- Item 1: the watch test received `{kind, name}` without `deleted`, and the sidebar test still showed the `gone` link.
- Item 2: three tests failed with the source changes stashed (broker canAlways and session rule, panel label).
- Item 3: two failures (`ToolSearch` summary, `(non-text result)`).
- Item 9: the new mapper test failed on the raw JSON summary.
- Item 10: with source stashed, the broker and events tests failed (`relativeTo is not a function`, absolute path in the ask summary).
- Item 4: six failures across gate, routes, LaunchDialog, TasksView, and SessionsView.
- Item 6: endedAt moved from `00:01:00.050Z` to `00:05:00.050Z` before the fix.
- Item 7: `EISDIR` failed the compile before the fix.
- Item 8: both Stopping tests failed.
- Item 12: four failures (missing `shownRunPrompt`, full prompt shown for launch, resume, and restore).
- Item 13: both chip tests failed to find the `main#login` link.
- End-frame fix: the preview test failed on the joined text.
- Item 5 is tests of existing behaviour, so I mutation-checked instead: dropping the stored-run check from `newRunId`, making the queue not swallow a failure, and turning `throw err` into `return false` in `isAncestor` each made exactly the new test fail.

Final unit run: `pnpm check` pristine, 53 files, 406 tests passed (388 at BASE).

## Manual verification

Built app with the fake SDK, driven by a throwaway Playwright spec (deleted afterwards), screenshots read:

- Item 0: after Accept, `Login` and `Home` each sit on one line inside their boxes; nothing else to do.
- Item 9: the panel shows `proposing 3 changes`, then `proposal p_e272ff41 is on the board`.
- Item 1: deleting `docs/notes.md` on disk removed `notes` from the sidebar.
- Item 4: the launch dialog reads `Starts a session on branch blueprint/login-page in its own worktree.`.
- Items 2, 10, 12: the run card shows `Start task login-page`, `editing src/login.ts`, `File created successfully at: src/login.ts`, and the ask offers `Allow once`, `Allow for this session`, `Deny`.
- Item 8: Stop turned into a disabled `Stopping…` while the status stayed `Needs you`, then the card went to `Idle` with `✗ interrupted` and `Stopped`.
- `pnpm e2e` passed three times in a row after item 11, and again three times on the final code (3 passed each).
- The DEMO_NAMES error fired by name when I removed an entry, and a seed that throws left no new `blueprint-e2e-*` directory (2 before, 2 after).
- `pnpm demo` passed once on the final code; I read the end frame of each video.
  01 shows the accepted Login and Home beside the drawn boxes and the sentence row; 02 shows `editing .blueprint/spec.md` and the tasks; 03 showed the run-on preview, which I fixed and re-recorded (now two clean lines with an ellipsis).
- `pnpm build` warns only about the pre-existing chunk size.

## Files changed

- Server: `src/server/watch.ts`, `src/server/index.ts`, `src/server/agent/broker.ts`, `src/server/agent/events.ts`, `src/server/agent/session.ts`, `src/server/agent/index.ts`, `src/server/sessions.ts`, `src/server/runs/git.ts`, `src/server/runs/gate.ts`, `src/server/runs/manager.ts`, `src/server/runs/prompt.ts`.
- Shared: `src/shared/messages.ts`, `src/shared/panel.ts`, `src/shared/runs.ts`.
- UI: `src/ui/App.tsx`, `src/ui/panel/PermissionDialog.tsx`, `src/ui/panel/ClaudePanel.tsx`, `src/ui/panel/TranscriptList.tsx`, `src/ui/plan/LaunchDialog.tsx`, `src/ui/plan/TasksView.tsx`, `src/ui/sessions/SessionsView.tsx`, `src/ui/sessions/RunCard.tsx`, `src/ui/markdown.tsx`, `src/ui/styles.css`.
- Tests: `test/server/watch.test.ts`, `test/server/agent/broker.test.ts`, `test/server/agent/events.test.ts`, `test/server/agentRoutes.test.ts`, `test/server/runRoutes.test.ts`, `test/server/runs/{gate,git,manager,prompt,store}.test.ts`, `test/ui/{server-events,ClaudePanel,RunCard,SessionsView,LaunchDialog,TasksView,transcript}.test.tsx|ts`.
- E2E: `e2e/scenario.json`, `e2e/flows.spec.ts`, `e2e/fixtures.ts`.
- Demo: `docs/demo/0{1,2,3}-*.webm`.

## Self-review findings

- The diff stays within the named files plus what each item needed; no new dependencies.
- No em dashes; no "Claude Code" in UI copy; no co-author trailers.
- `relativeTo` replaces the session directory anywhere in a row, so a Bash command such as `cat /repo/src/a.ts` also reads `cat src/a.ts`; a cwd of `/` would strip every slash, but no session runs at `/`.
- The other-session row reloads on every `runs.changed`, which also fires on run cost and status patches; the transcript endpoint is cheap and only open rows refetch.
- A failed gate refetch on `runs.changed` is logged and the dialog keeps its last gate; the launch POST checks the gate again anyway.

## Concerns

1. Item 2 changes behaviour, not just the label: `Allow for this session` without suggestions now adds a session rule for the whole tool (for Bash, every command until the session ends).
   Keeping the old `[]` would have made the new label promise more than it does, which the item forbids; the alternative is a narrower label such as `Allow` (same as once), which seemed pointless.
   Please confirm this ruling.
2. Item 6's restored-reason test cannot fail on a `base` that drops the restored message: no public action re-derives a restored failed run before it runs again (Stop with no process, permission calls, and restore all derive nothing; a send moves the base to working first).
   I mutation-checked this and say so plainly; the test pins that a restart and a Stop keep the reason and end, and that running again clears them.
   The live case (a failed run whose message changes) is covered by the endedAt test.
3. Item 12 goes slightly past the resolution: a restored prompt that carried words after the run prompt (a message with no session to resume) shows those words, as it did live, instead of the label.
   Without that, a restored transcript would lose the user's message.
4. Seen, not fixed (pre-existing, outside the items): sending a message within about a second of creating a board fails propose with `open a board in the browser first`, since the board has not reported itself open yet.
   The e2e flows draw first, so they never hit it.
5. Seen, not fixed: tool rows and asks show Bash commands with literal backticks (`running \`git push -u origin HEAD\``), since summaries are plain text.
6. Two `blueprint-e2e-*` directories from runs before this task remain in the system temp directory; I left them alone.

## Fix round 1

Status: DONE. HEAD: 4582cf2.

### Commits

- e024279 fix(ui): without suggested rules an ask offers only Allow once and Deny, and the broker invents no rule
- 5281636 fix(ui): a board tells the server it is open as soon as it mounts
- 8007aef fix(ui): command rows show the command as code instead of in backticks
- 1b00567 style(ui): a command in a tool row or ask is the same chip as inline code
- 4582cf2 docs(demo): re-record the flows with the two-choice ask and command chips

### 1. No invented session rule

The broker sends the SDK's suggestions only when `canAlways` is true.
An `always` decision without suggestions settles as `{ behavior: "allow" }`, with no `updatedPermissions`.
`PermissionDialog` renders `Allow always` only when `canAlways` is true, and otherwise only `Allow once` and `Deny`.
`canAlways` stays on the pending entry.
Tests: the broker test expects `{ behavior: "allow" }` exactly for an always without suggestions; the panel test asserts the buttons are `["Allow once", "Deny"]` for a `canAlways: false` ask; the card test asserts no always or session button for its `canAlways: false` ask.
All three failed before the change.
This resolves concern 1 of the first report.

### 2. The board announces itself on mount

`BoardView` now sends `{ type: "selection.changed", board: name, ids: [] }` in its mount effect, which also holds the existing unmount message (`board: ""`).
The debounced report still follows once the scene loads; its first send repeats the empty selection, which is harmless.
Unit test: `test/ui/BoardView.test.tsx` renders `BoardView` with Excalidraw mocked to render nothing, `getBoard` never resolving, and the send hook captured.
It asserts the mount message arrives before any scene exists, and the empty-board message on unmount.
It failed before the change (`expected [] to deeply equal [...]`).
E2E check (throwaway spec, deleted): create a board, then at once type and send a message.
Without the change it failed (no proposal, the tool failed); with it, it passed three runs out of three and showed no `open a board in the browser first` row.
This resolves concern 4 of the first report.

### 3. Commands as code

`summarizeTool("Bash")` returns `running <command>` without backticks.
`ToolSummary` (in `TranscriptList.tsx`) splits on the `running ` prefix and renders the rest in `<code className="cmd">`; the tool_use row and the permission dialog both use it.
The dialog was not named in the ruling, but it shows the same summary, and left alone it would have read as plain text with the command run into the sentence.
After the first re-record, the command showed as bare monospace, larger than the text around it.
So `.cmd` now shares the `.md code` rule (same font ratio, background, and padding).
Tests: the events, broker, and agentRoutes expectations read `running ls`; the panel test asserts the dialog's `<code>` holds `ls` and that a restored `running npm test` row renders `npm test` in a `CODE` element.
This resolves concern 5 of the first report.

### Verification

- `pnpm check` (once, after the three fixes): pristine, 407 tests passed.
- `pnpm e2e` (once): 3 passed.
- `pnpm demo` re-recorded, because the ask and the command rows changed visibly; it passed (3 passed) after the chip style too.
- Frames read from `03-launch-run.webm`: the ask reads `Allow Bash: running git push -u origin HEAD`, with the command as a grey chip like the branch chip, and the buttons `Allow once` and `Deny`. The end frame is the Done card with the two-line preview.
