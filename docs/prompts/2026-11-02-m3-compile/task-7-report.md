# Task 7 report: Spec view and tasks view

Status: DONE_WITH_CONCERNS

Commit: `5c0d14f feat(ui): spec view with clickable citations and the tasks view` (no trailer).

## What I implemented

- `src/ui/plan/citations.ts`
  - `citationHash(c)` builds the route with `routeHash`, giving `#/boards/<page>?focus=<id>` or `#/docs/<page>?focus=<id>`.
  - A doc citation's page is a file name (`notes.md`, as `FileStore.citationIndex` keys it and the split prompt shows it), but the doc route needs the doc name (`notes`).
    So `citationHash` strips a trailing `.md` from doc pages.
    Without this, every doc citation would open a missing doc.
  - `citationMarks(text)` returns one `{ from, to, hash }` per citation from `parseCitations`.
    It finds each `raw` with `indexOf` starting after the previous match, so repeated citations get distinct ranges.
- `src/ui/plan/SpecView.tsx`
  - Loads `getSpec()`.
    When `text` is null it shows `No spec yet. Press Compile in the Claude panel.` and no Split button.
  - Shows a read-only CodeMirror editor: `basicSetup`, `markdown()`, `EditorView.lineWrapping`, `EditorState.readOnly.of(true)`, `EditorView.editable.of(false)`, and DocView's theme.
  - Marks citations with a `StateField<DecorationSet>` built from `citationMarks`, using `Decoration.mark({ class: "cite", hash })`.
    The field is rebuilt when the doc changes.
  - Click handler: `EditorView.domEventHandlers({ click })` finds the `.cite` element under the click.
    It uses `view.posAtDOM` on that element and takes the mark whose range contains that position, then sets `location.hash`.
    I used `posAtDOM` and not the suggested `posAtCoords`.
    `posAtCoords` returns the boundary nearest the pointer, so in `[[a]][[b]]` a click on the left edge of `b` returns `a.to === b.from` and could open the wrong citation.
    `posAtDOM` on the clicked span is exact, even when highlight spans split the mark.
  - `Split into tasks` calls `agentSplit()` and shows `Splitting…` (disabled) until a `split.status` of `done` or `error` arrives.
    `error` shows the message in a `role="alert"` line.
    A rejected `agentSplit()` (404 or 409) shows the server's message and re-enables the button.
    A `running` status from another tab also shows `Splitting…`.
  - Shows `Dropped <n> citations that no longer resolve: <raw, raw>` when `dropped` is not empty.
  - Reloads on `file-changed` with kind `spec`.
    A reload swaps the text in place with DocView's `replaceFromDisk`, so the scroll position is kept.
- `src/ui/plan/TasksView.tsx`
  - Loads `listTasks()`.
    It reloads on `split.status done` and also on `file-changed` with kind `task` (see Concerns 2).
  - Shows one `<article>` card per task with the file name, the title (h2), `Depends on: a, b` (only when there are dependencies), the acceptance list, and the sources as links built with `citationHash`.
    A source that does not parse as a citation shows as plain text.
  - Shows `No tasks yet. Split the spec first.` when the list is empty.
  - Shows `Split cost $<n>` from the last `split.status done` that has `costUsd`.
    It uses `toFixed(4)`, the same as the panel's cost display.
  - Shows the `error` message (or a load failure) in a `role="alert"` line until the next split status.
- `src/server/watch.ts`: `Change.kind` now also includes `"spec" | "task"`.
  The watcher also watches `.blueprint/tasks/` and `.blueprint/spec.md`.
  `classify` now uses the parent directory, because `.md` files live in both `docs/` and `tasks/`.
  chokidar 6 handles a watched `spec.md` that does not exist yet (the test creates it after the watcher starts).
- `src/shared/messages.ts`: the `file-changed` kind union now includes `spec` and `task`.
- `src/ui/App.tsx`: renders `SpecView` and `TasksView` in place of the two placeholder paragraphs.
  The sidebar refresh-on-new-file handler ignores `spec` and `task`.
- `src/ui/docs/DocView.tsx`: exports `theme`, so the spec editor looks like the doc editor and the theme is not duplicated.
- `src/ui/styles.css`
  - `.cite`: accent color, underline, pointer cursor.
    `.cm-content .cite span { color: inherit }` stops markdown highlighting from coloring the brackets differently.
  - The spec editor hides the active-line highlight, because a read-only view has no cursor.
  - Classes for the spec layout, the dropped-citation warning, the error line, and the task cards.

## TDD evidence

RED (before any implementation):

```
$ pnpm vitest run test/ui/citations.test.ts test/ui/TasksView.test.tsx test/ui/SpecView.test.tsx test/server/watch.test.ts
   × watcher reports the spec and task files 2619ms
 FAIL  test/ui/SpecView.test.tsx: Failed to resolve import "../../src/ui/plan/SpecView"
 FAIL  test/ui/TasksView.test.tsx: Failed to resolve import "../../src/ui/plan/TasksView"
 FAIL  test/ui/citations.test.ts: Cannot find module '../../src/ui/plan/citations'
 FAIL  test/server/watch.test.ts > watcher reports the spec and task files
Error: no event for spec
 Test Files  4 failed (4)
      Tests  1 failed | 3 passed (4)
```

GREEN:

```
$ pnpm vitest run test/ui/citations.test.ts test/server/watch.test.ts
      Tests  6 passed (6)
$ pnpm vitest run test/ui/citations.test.ts test/ui/TasksView.test.tsx test/ui/SpecView.test.tsx
 Test Files  3 passed (3)
      Tests  7 passed (7)
```

I added the TasksView `file-changed` reload after the manual pass.
I checked its test fails without the line:

```
   × TasksView reloads when a task file changes on disk
      Tests  2 failed | 1 passed (3)
```

The second failure was a once-mock left over from the failing test.
I changed both new UI test files to `vi.resetAllMocks()`, so queued once-values cannot leak between tests.

Final:

```
$ pnpm check
Checked 108 files ... No fixes applied.
 Test Files  41 passed (41)
      Tests  276 passed (276)
```

The vitest output has no stderr, warnings, or errors.
`pnpm build` warns only about the existing chunk size.

Tests added:
- `test/ui/citations.test.ts`: `citationHash` for board and doc (with `.md` stripped); `citationMarks finds every citation with its hash`, including a repeated citation and text with none.
- `test/ui/TasksView.test.tsx`: `TasksView renders cards with dependencies and source links, and the empty state` (also covers the cost line); a reload on `file-changed` task; a split error that clears on the next split.
- `test/ui/SpecView.test.tsx`: the empty state, then a `file-changed` spec reload with the dropped warning, a `.cite` mark, and a non-editable content area; `Splitting…` until `error` and then `done`; a rejected `agentSplit` (409 `ApiError`) shows its message and re-enables the button.
- `test/server/watch.test.ts`: `watcher reports the spec and task files`.

## Manual observations

Setup: a scratch project in `$TMPDIR/spec-proj`.
Board `main` has rectangles `auth` (100,100) and `db` (1600,900).
Doc `notes` has `## Caching`.
`spec.md` cites both elements, the doc heading, an adjacent pair `[[board:main#auth]][[board:main#db]]`, and two dead citations.
The server ran with `node --import tsx` and Vite ran on port 5179, at 1400x850 with gstack browse.
The Playwright MCP browser was in use by another session.
Headless Chromium needed to run outside the sandbox (mach-port permission denied).
Screenshots are in `.superpowers/sdd/2026-11-02-m3-compile/task-7-shots/`.

- `#/spec` (`spec.png`): every valid citation is blue and underlined.
  The warning reads `Dropped 2 citations that no longer resolve: [[board:main#gone]], [[doc:notes.md#no-such-heading]]`.
  `Split into tasks` sits on the right of the same bar.
  - At first the `[` brackets inside each mark took the markdown punctuation color.
    I fixed that with `.cm-content .cite span { color: inherit }` and confirmed the computed color is `rgb(37, 99, 235)`.
  - At first line 1 had an active-line highlight even though the view is read-only.
    I removed it for the spec editor.
- Clicking `[[board:main#db]]` opened `#/boards/main?focus=db` with `db` selected and centered at 100% zoom (`cite-board.png`).
- Clicking `[[doc:notes.md#caching]]` opened `#/docs/notes?focus=caching` with the cursor on `## Caching` (`cite-doc.png`).
- The adjacent pair: the first opened `focus=auth` and the second opened `focus=db`.
- Editing `spec.md` on disk updated the open view in place: the new citation got a mark (6 marks) and the scroll stayed at 0.
- Deleting `spec.md` and then clicking Split showed `compile the plan first` in red under the bar, and the button re-enabled (`split-rejected.png`).
  No Claude query ran.
  I did not run a real split, because it starts a paid query on the user's login.
- Reloading with no `spec.md` shows `No spec yet. Press Compile in the Claude panel.` (`spec-empty.png`).
  Putting `spec.md` back made the editor and the Split button appear without a reload.
- `#/tasks` with no task files shows `No tasks yet. Split the spec first.`
  Writing two task files on disk made the cards appear without a reload (`tasks.png`).
  Each card shows the file name, the title, `Depends on: database` (only on the second card), the acceptance bullets, and the source links.
  Clicking `[[doc:notes.md#caching]]` on a card opened `#/docs/notes?focus=caching`.
- Claude panel header at the default 360 px pane: `Claude ● Idle` on the left and `Compile` and `Stop` on the right, on one line with no crowding or wrapping.
  I made no header CSS change.
- Console: no errors except the expected Vite `/ws` reconnect when I restarted Vite.

## Files changed

- `src/ui/plan/citations.ts` (new)
- `src/ui/plan/SpecView.tsx` (new)
- `src/ui/plan/TasksView.tsx` (new)
- `src/ui/App.tsx`
- `src/ui/styles.css`
- `src/server/watch.ts`
- `src/shared/messages.ts` (not in the brief's list; the `file-changed` kinds the dispatch asked for live here)
- `src/ui/docs/DocView.tsx` (not in the list; one-word `export` on `theme`)
- `test/ui/citations.test.ts` (new)
- `test/ui/TasksView.test.tsx` (new)
- `test/ui/SpecView.test.tsx` (new; the dispatch asked for the rejected-split test)
- `test/server/watch.test.ts`

## Self-review findings

- `classify` matches `spec.md` only directly under `.blueprint`, and `.md` only inside `docs/` or `tasks/`.
  So a file named `spec.md` in `docs/` is still a doc.
- Task writes from `replaceTasks` go through `store.write`, so the watcher drops them as own-writes.
  TasksView still reloads on `split.status done`.
  Deleted task files send no event (the watcher reports only add and change); a split also produces `done`.
- The editor is created when the spec first has text and destroyed when it goes back to null.
  The text effect runs after the create effect in the same commit, so the first text is applied right away.
- `followCitation` returns `false` for clicks outside a citation, so CodeMirror's normal handling still applies to them.
- `toFixed(4)` for the split cost matches the panel's cost format.
  The brief says `$<n>`, so `$0.4213` is a formatted `<n>`.
- Vite's file watcher in this environment missed some edits (it served a stale `TasksView` after my RED check rewrote the file).
  Restarting Vite fixed that.
  This is an environment issue and not in the code.

## Concerns

1. Two small edits outside the brief's file list: `src/shared/messages.ts` (needed for the new kinds) and `export` on DocView's `theme`.
   Copying the theme was the other option.
2. TasksView also reloads on `file-changed` kind `task`.
   The brief lists only `split.status done`, but the brief also says the watcher change is "for these reloads".
   Without it, hand-edited task files do not show until a page reload.
3. `citationHash` strips `.md` from doc pages.
   Doc citations carry the file name, so this strip is needed for doc citations to open anything.
4. Out of scope, but visible on these routes: the panel input still says "Ask Claude about this board" on the spec and tasks routes.
   This copy problem existed before this task and was also noted in Task 6.
5. The server's dropped-citation strip leaves a space before the punctuation ("cited here .").
   That is the server's behavior, and I did not change it.
6. After a full page reload during a running split, the spec view does not show `Splitting…` until the next `split.status`.
   No route reports split state, and none was in scope.
