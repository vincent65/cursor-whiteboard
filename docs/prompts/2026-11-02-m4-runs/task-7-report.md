# Task 7 report: Launch from the tasks view

Status: DONE_WITH_CONCERNS (minor, see Concerns)

Commit: `f591fce feat(ui): launch a task into a run from the tasks view`

## What I implemented

- `src/ui/plan/LaunchDialog.tsx` (new): an in-page `role="dialog"` panel titled `Launch <task title>`.
  - Says the run starts on branch `blueprint/<slug>` in its own worktree.
  - When the gate fails, lists each missing dependency as `<slug>: <reason>`, mapping the server's codes to the brief's wording: `no run` -> `no run`, `not done` -> `run not done`, `not merged` -> `branch not merged into HEAD`.
  - The `Permission mode` select defaults to `acceptEdits` and also offers `default` and `bypassPermissions`. The option labels are `Accept edits`, `Ask first` and `Bypass permissions`, and a one-line explanation of the selected mode shows under the select.
  - The `Launch anyway` checkbox shows only when the gate fails. `Launch` stays disabled while the gate fails and the checkbox is off, and also while a launch request is in flight, so a double click cannot fire a second launch.
  - A failed launch stays open and shows the server's message as an alert. `Launch` is enabled again after that.
  - The dialog closes on `Cancel` and on `Escape` (handled with `onKeyDown` on the dialog, so it does not steal Escape from the rest of the app). The select gets focus when the dialog opens.
- `src/ui/plan/TasksView.tsx`:
  - Loads `listRuns()` next to the tasks, keeps the set of task slugs that have a run, and reloads it on `runs.changed`.
  - A card whose task has a run shows a `View run` link to `#/sessions`. A card without one shows a `Launch` button.
  - `Launch` calls `gate(slug)` and opens the dialog in that card with the result. A failed gate request shows in the page's existing error alert.
  - A successful launch calls `launchRun({ taskSlug, permissionMode, override })`, closes the dialog, and sets `location.hash` to `routeHash({ kind: "sessions" })`.
- `src/ui/styles.css`: added `.task-action`, `.launch-dialog`, `.launch-title`, `.launch-field` and `.launch-check`. These reuse the existing `.button`, `.button-primary`, `.run-input`, `.run-actions`, `.task-list` and `.plan-error` classes.

## TDD evidence

RED (`pnpm vitest run test/ui/LaunchDialog.test.tsx test/ui/TasksView.test.tsx`, before the implementation):

```
   × TasksView opens the dialog and launches with the chosen mode 20ms
   × a task that already has a run links to the sessions view instead of launching 1007ms
   × a failed gate check shows as an error and opens no dialog 9ms
 FAIL  test/ui/LaunchDialog.test.tsx [ test/ui/LaunchDialog.test.tsx ]
Error: Failed to resolve import "../../src/ui/plan/LaunchDialog" from "test/ui/LaunchDialog.test.tsx". Does the file exist?
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Launch"
TestingLibraryElementError: Unable to find role="link" and name "View run"
      Tests  3 failed | 5 passed (8)
```

GREEN (same command, after the implementation):

```
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

`pnpm check`: tsc for both configs passed, `biome check` reported "Checked 132 files ... No fixes applied.", and vitest reported 51 files and 334 tests passed. A grep of the full test output for stderr, warn or act( found nothing.

`pnpm build`: the only warning is the pre-existing chunk size warning.

New and changed tests:
- `LaunchDialog explains missing dependencies and needs the override to launch` (the brief's test): checks the reason wording, the default mode, the initial focus, that `Launch` is disabled until the override is checked, and the mode explanation. Launching calls `onLaunch("default", true)`.
- `LaunchDialog launches a ready task without the override and shows a failed launch`
- `LaunchDialog closes on Cancel and on Escape`
- `TasksView opens the dialog and launches with the chosen mode` (the brief's test): checks the `gate("auth")` call and the `launchRun` body, that the hash becomes `#/sessions`, and that the dialog closes.
- `a task that already has a run links to the sessions view instead of launching`: covers both card states, and checks that `runs.changed` flips `Launch` to `View run`.
- `a failed gate check shows as an error and opens no dialog`
- The existing TasksView tests now also mock `listRuns`, `gate` and `launchRun`.

## Manual observations

I ran the built CLI (`dist/cli/index.js --no-open --port 4319`) in a scratch git repository that held two task files (`db`, and `auth` depending on `db`), and checked it in the gstack headless browser at 1280x800.

- With no runs, both cards showed `Launch`. Clicking it on `auth` opened the dialog inside the card, which listed `db: no run`. Focus was on the select, and `Launch` was disabled and dimmed. Checking `Launch anyway` enabled it. Choosing `bypassPermissions` showed "Never asks. Use only on a repository you trust." Escape closed the dialog. The layout looked clean, with spacing and colors that match the run cards.
- I seeded `.blueprint/sessions.json` with a `done` run for `db` and restarted the server. The `db` card showed `View run`, which links to `#/sessions` and navigated there when clicked. The `auth` dialog listed `db: branch not merged into HEAD`.
- I did not press `Launch` against the real server. Doing so would create a worktree and start a real session on the user's login. The launch call and the navigation are covered by the TasksView test.
- Using the browse tool added `.gstack/` to `.gitignore` and created a `.gstack/` directory. I reverted the first and deleted the second. Neither was committed.

## Files changed

- `src/ui/plan/LaunchDialog.tsx` (new)
- `src/ui/plan/TasksView.tsx`
- `src/ui/styles.css`
- `test/ui/LaunchDialog.test.tsx` (new)
- `test/ui/TasksView.test.tsx`

## Self-review findings

- The UI copy has no "Claude Code" branding and no em dashes.
- No new dependencies. Only the files the brief lists were changed.
- The `Launch` button is disabled while a launch is in flight. Without that, a double click would send a second POST, which `createWorktree` would refuse.
- The dialog renders inside the card it launches, so it is clear which task it is for. Only one dialog can be open at a time.
- The disabled primary button uses the existing `.button:disabled` rule, so it looks the same as the other disabled primary buttons in the app.

## Concerns

- The brief says the button reads `Launched` and is disabled while a run is `working` or `needs_you`. I followed the controller's resolution instead: a task with any run shows a `View run` link to `#/sessions`. That means `Launched` never appears.
- The server's reason codes (`not done`, `not merged`) differ from the brief's wording, so the dialog maps them to `run not done` and `branch not merged into HEAD`.
- After `Cancel` or `Escape`, focus is not moved back to the card's `Launch` button: it falls to the page body. This is a small accessibility gap. It could be fixed with a ref on the button if wanted.
- The option labels are readable names, not the raw mode ids. The ids are the option values.
