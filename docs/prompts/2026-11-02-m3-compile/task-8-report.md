# Task 8 report: Milestone acceptance

Status: DONE_WITH_CONCERNS

Commit: `45b3c1e fix(ui): keep the split cost when the split finishes on the spec view` (no trailer).

## What I implemented

I ran the acceptance script once with the real Claude Code login.
Step 4 failed in one way: the split cost never showed.
That got the one fix.

- The bug: `TasksView` got the cost only from a `split.status done` event that arrived while it was mounted.
  `Split into tasks` lives on the spec view, so the split always finishes while `TasksView` is unmounted.
  When the user then opens Tasks, the cards are there but `Split cost $<n>` never shows.
- The fix: `useSplitCost()` (exported from `src/ui/plan/TasksView.tsx`) subscribes to `split.status done` and keeps the last `costUsd`.
  `App` calls it once and passes `cost` to `<TasksView cost={splitCost} />`.
  `TasksView` no longer keeps cost state of its own.
  It still reloads on `done` and shows errors as before.
- Known limit: a full page reload loses the cost, because the server does not store it.
  That matches the plan's wording ("when the last `split.status done` carried one").

## TDD evidence

RED (the new test was written before the hook existed):

```
$ pnpm vitest run test/ui/TasksView.test.tsx
   × the split cost shows even when the split finished on another route 4ms
TypeError: useSplitCost is not a function
      Tests  1 failed | 3 passed (4)
```

The test renders a small `Shell` like `App`'s: it calls `useSplitCost()` and mounts `TasksView` only when `open`.
It emits `done` with `costUsd: 0.4213` while `TasksView` is unmounted, then opens it and expects `Split cost $0.4213`.

GREEN:

```
$ pnpm vitest run test/ui/TasksView.test.tsx
      Tests  4 passed (4)
$ pnpm check
Checked 108 files in 50ms. No fixes applied.
 Test Files  41 passed (41)
      Tests  277 passed (277)
```

There was no stderr or warning output.
`pnpm build` warned only about the existing chunk size, both before and after the fix.

## Manual observations

### Setup

- Step 1: `pnpm check && pnpm build` was pristine apart from the chunk-size warning (276 tests before the fix).
- The scratch repository was `$TMPDIR/m3-accept`: `git init`, one commit, then `node dist/cli/index.js --no-open --port 4317`.
  The server ran outside the sandbox, because the SDK's `claude` process needs `~/.claude` and the network.
- Browser:
  - The Playwright MCP browser was locked by another session ("Browser is already in use").
  - gstack browse started, but it has no real mouse drag, so its synthetic pointer events could not draw in Excalidraw.
    The one stray zero-size rectangle this left in the scratch board was deleted before drawing.
  - I used Playwright 1.58.2 from the local npx cache with its cached Chromium, in a long-lived headless driver at 1440x900.
- Screenshots are in `.superpowers/sdd/2026-11-02-m3-compile/task-8-shots/`.
- I drew board `architecture` in the UI: rectangles `Web UI`, `API Server`, and `Database`, joined by two arrows (`02-board-drawn.png`).
  The export shows the mermaid flowchart with ids and both arrows.
- I wrote doc `notes` in the UI with `## Storage` and `## Authentication` (`03-doc.png`).

### 2.1 Compile: pass, with one deviation

- Pressing Compile showed the user row `Compile the plan into spec.md` and the status `Starting` (`04-compile-start.png`).
- Deviation: the agent did not use Read.
  It asked for **Bash** `cd …/.blueprint && find . -t…` (a find that cats the files) to read the exports and docs (`05-permission.png`).
  I allowed it once.
  The row showed `✗ Exit code 1` with the file contents, so the read worked even though find exited 1.
  This is the model's choice, not a code defect, so I did not change the prompt.
- Next came the `Write` permission dialog for `.blueprint/spec.md` (`06-perm-2.png`).
  I allowed it once.
  The panel showed `File created successfully`, a two-line summary, and `Done · $0.2478 total` (`07-compile-done.png`).
- Compile turn: 40.7 s from the first to the last session log entry, or 42.4 s measured in the browser.
  That includes about 15 s I took to allow the first prompt.
  Cost: $0.2478.
- `spec.md` has `Goals`, `Architecture`, `Interfaces`, `Constraints`, `Acceptance criteria`, and `Open questions`, in that order.
  It has 27 citations, all to real ids: the three boxes, both arrows, `notes.md#storage`, and `notes.md#authentication`.
- The spec view showed 27 `.cite` marks, underlined in `rgb(37, 99, 235)`, and no dropped warning (`08-spec-view.png`).

### 2.2 Citations: pass

- `[[board:architecture#JOo_9un_JZdJgABbQntb0]]` opened `#/boards/architecture?focus=JOo_…` with `1 selected: API Server`.
  The box was centered in the visible canvas right of the properties panel, at 100% zoom (`09-cite-board.png`).
- `[[doc:notes.md#authentication]]` opened `#/docs/notes?focus=authentication` with the cursor on `## Authentication` (`10-cite-doc.png`).
  The doc is short, so there was nothing to scroll.

### 2.3 Deleted box: pass

- I selected `Database` (`1 selected: Database`) and pressed Delete.
  Autosave set `isDeleted: true` for the box and its label (`11-board-deleted.png`).
- The spec view showed `Dropped 2 citations that no longer resolve: [[board:architecture#lzJPXEo6iPCIekhmhIaOl]], [[board:architecture#lzJPXEo6iPCIekhmhIaOl]]` (`12-spec-dropped.png`).
  25 marks remain, and `spec.md` on disk still has both occurrences, so nothing was rewritten.
- The remaining citations still work: `[[board:…#5dZARK…]]` selected `Web UI`, and `[[doc:notes.md#storage]]` put the cursor on `## Storage`.

### 2.4 Split: failed on the cost, now fixed

- The button showed `Splitting…` and was disabled (`14-splitting.png`).
  It went back to `Split into tasks` with no error.
- 5 cards appeared: `01-postgres-schema-and-roles.md` … `05-e2e-acceptance-suite.md` (`17-tasks-view.png`).
  They have `Depends on:` lines (02 on `postgres-schema-and-roles`, 03 on `api-server-db-layer`, and so on) and source links.
- The files have JSON-literal frontmatter (`title`, `slug`, `dependsOn`, `files`, `acceptance`, `sources`) and a markdown body.
- A source link on card 02 opened the board with `API Server` selected.
- Split: 35.3 s (session log 06:02:00.96 to 06:02:36.28).
  Cost: $0.3025 (the session log's `costUSD` lines, 0.302232 + 0.000261).
- **Failure:** the tasks view showed no `Split cost` line.
  The cause and the fix are in the first section.
- Fix check without a second paid split:
  - I rebuilt and restarted the server, then opened a fresh tab with Playwright's `routeWebSocket` passing traffic through to the real server.
  - On `#/spec` I injected `split.status running` (the button showed `Splitting…`), then `done` with `costUsd: 0.3024934`.
  - Opening Tasks then showed `Split cost $0.3025` above the 5 cards (`18-tasks-cost-after-fix.png`).

### 2.5 Second press: pass

- The tab that started the split has its button disabled, so I opened a second tab on `#/spec` during the run.
  Its button was enabled, because a fresh page does not know a split is running (Task 7 concern 6).
- Pressing it showed `a split is already running` in red, and the button stayed `Split into tasks` (`15-second-press-refused.png`).
- Files were replaced exactly once: all five task files have the same birth and modify time (22:02:36), and no other task files exist.
  My `fs.watch` logger printed nothing for the writes in this environment, so the file times are the evidence.

### Looked at closely

- **Claude panel header at the default 360 px pane:** `Claude ● Idle`, `Compile`, and `Stop` fit on one line in every state I saw (Starting, Needs you, Idle).
  There was no wrapping or crowding (`20-panel-header.png`, `05-permission.png`).
- **Dropped warning:** it lists the same citation twice, once per occurrence (`12-spec-dropped.png`).
  The count "2" is right, but repeating the same id looks odd; the list should be de-duplicated.
  The warning wraps to two lines next to the Split button, which reads fine.
- **Dropped citation punctuation:** removing a dead citation leaves `… [[…JOo…]] .` and `Postgres  [[doc…]]` (a space before the period, and a double space) (`12-spec-dropped.png`).
  This is already deferred in progress.md.
- **Task cards:** clean layout (`17-tasks-view.png`).
  Card 01 cites the deleted `Database` box, because the split sends the raw spec with its dead citations.
  Clicking that link opens the board with nothing selected and no console error (`19-task-source-deleted-element.png`).
- **Transcript after a server restart:** the replayed compile user message shows the full `COMPILE_INSTRUCTION` prompt as a large blue bubble, not `Compile the plan into spec.md` (`18-tasks-cost-after-fix.png`, right panel).
  It looked right during the live run.
- **Composer placeholder:** it says `Ask Claude about this board` on the doc, spec, and tasks routes (already deferred).
- **No feedback after a split:** when a split finishes, the spec view just puts the button back.
  There is no "5 tasks written" note and no link to Tasks, so the user has to know to open Tasks.
- **Sidebar focus ring:** the ring in one screenshot came from my Escape key press (`:focus-visible` after keyboard input).
  It does not appear on a mouse click.
- **Console:** no errors during the citation and task-link clicks.

## Files changed

- `src/ui/plan/TasksView.tsx`: adds `useSplitCost()`; `TasksView` takes a `cost` prop.
- `src/ui/App.tsx`: calls `useSplitCost()` and passes `cost` to `TasksView`.
- `test/ui/TasksView.test.tsx`: new test for a split that finished on another route; existing renders pass `cost={null}`; the cost assertion moved out of the first test.

## Self-review findings

- The hook is mounted in `Shell` for the app's whole lifetime, so a split that finishes on any route keeps its cost.
- A `done` without `costUsd` keeps the previous cost, which is the earlier behavior.
- `error` and `running` do not clear the cost.
  That was also true before.
- No new files, dependencies, or server changes.
- The test's `Shell` mirrors App's wiring; the App wiring itself was checked in the browser.
- Cleanup:
  - I stopped the Blueprint server, the Playwright driver, and the file watcher.
  - No browser tool added files to the repository: the gstack `.gstack/` folder landed in the scratch repository and I deleted it.
  - Screenshots are in the git-ignored `.superpowers/` folder.

## Concerns

1. Each paid step ran once.
   So the cost fix was checked in the real app with an injected `done` message, not with a second real split.
2. Compile read the plan with Bash `find`, not Read, so the user got an extra Bash permission prompt.
   If that should not happen, the compile instruction could tell Claude to use the Read tool.
3. Two visible issues I did not fix, because they do not break a step:
   - The dropped warning lists a repeated citation twice.
   - The split passes dead citations through to task sources.
     Splitting the served spec, with dead citations already dropped, would fix it.
4. The replayed transcript shows the raw compile prompt after a server restart.
5. Gaps in the spec view:
   - After a split it gives no success feedback.
   - A freshly opened tab does not know a split is running, so its button stays enabled.
     The server refuses the press correctly.
