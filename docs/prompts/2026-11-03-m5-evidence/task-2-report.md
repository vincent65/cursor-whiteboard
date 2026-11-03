# Task 2 report: Playwright flows and the recorded demo

Status: DONE_WITH_CONCERNS (one brief item, "see its card go Working", cannot be observed against Task 1's fake; see Concerns).

## What I implemented

- `@playwright/test@^1.64` (1.64.1) as a dev dependency, Chromium headless shell installed.
- `playwright.config.ts`: `workers: 1`, viewport 1280 by 800, trace on failure, two projects.
  The `e2e` project runs plainly.
  The `demo` project records video at 1280 by 800 with `slowMo: 250` so a viewer can follow.
- Scripts: `pnpm e2e` (`playwright test --project=e2e`) and `pnpm demo` (`playwright test --project=demo`).
  The spec's `afterEach` closes the page and `saveAs`es each passing recording to `docs/demo/<name>.webm`, so `pnpm demo` needs no copy script.
- `e2e/fixtures.ts`:
  a worker-scoped `cli` fixture runs `pnpm build` once and yields `dist/cli/index.js`;
  a test-scoped `start(seed?)` fixture makes a temp git repo (realpath'd, explicit `-c user.*` and `commit.gpgsign=false` so it works without global git config), runs the optional seed, makes one commit, spawns `node dist/cli/index.js --no-open --port 0` with `BLUEPRINT_FAKE_SDK=e2e/scenario.json`, parses `Blueprint running at <url>` from stdout, and on teardown kills the server and removes the repo.
  The CLI already printed a parseable line, so `src/cli/index.ts` is unchanged.
- `e2e/flows.spec.ts`, three tests, no `waitForTimeout`:
  1. `plan, ask, and accept`: New board (prompt answered "sign-in"), two rectangles via the toolbar and mouse drags, Escape, marquee-select both, "2 selected:" chip, ask in the panel, "Claude proposed Sign-in flow" bar, Accept, bar gone; then polls the board file for 5 non-deleted elements with `customData.origin === "ai"` and no `ghost` marker, and asserts their labels are exactly `["Login", "Home"]`.
  2. `compile and split`: seeds `main.excalidraw.json` with rectangle `login` and its bound text; Compile, transcript "Wrote .blueprint/spec.md", Spec link, citation `[[board:main#login]]` has `text-decoration-line: underline`, click it, URL `#/boards/main?focus=login` and chip "1 selected: Login"; back to Spec, Split into tasks, Tasks view shows 2 articles with both task headings.
  3. `launch a run`: seeds the scenario's split tasks through `FileStore.replaceTasks` (the split's own write path); Tasks view, first card's Launch, dialog's Launch, sessions route, run card `login-page` reads Done with a PR link to the scenario URL, and `git branch --show-current` in `.blueprint/worktrees/login-page` is `blueprint/login-page`.
- `docs/demo/README.md` lists the three videos; the three `.webm` files are committed (379, 303, 156 KiB).
- `.gitignore`: `test-results/`, `playwright-report/`.

Beyond the listed files, and why:
- `tsconfig.json` includes `e2e` and `playwright.config.ts`, so `pnpm check` type-checks the specs.
- `biome.json` excludes `test-results` and `playwright-report`; otherwise `pnpm check` fails on Playwright's `.last-run.json`.
- `src/ui/board/BoardView.tsx`: a bug fix the demo exposed (below), in its own commit.

Locators: role and text everywhere, except Excalidraw's own `data-testid="toolbar-rectangle"` (its parent label is clicked, because the icon covers the radio) and `getByRole("main")`'s bounding box for canvas drags.
No `data-testid` was added to any Blueprint component.

## Bug found and fixed (TDD, E2E)

The first recording showed the accepted "Login" node as "Logi" with the "n" spilling onto the arrow.
Root cause: Excalidraw registers Excalifont but loads it only once the scene shows text.
On a board with only rectangles, every Excalifont face was `unloaded` (checked via `document.fonts`) when the proposal arrived, so `convertToExcalidrawElements` sized the boxes with fallback metrics; Accept's `restoreElements({ refreshDimensions: true })` re-measured in the real font and wrapped the label (saved text `"Logi\nn"`, height 50 in a 35 high box).
This hits real users on any fresh board, not just headless.
- Red: added the label assertion to flow 1; it failed with `"Logi\nn"`.
- Fix: `applyProposalRequest` awaits `document.fonts.load("20px Excalifont", JSON.stringify(proposal.ops))` before rendering any op.
- Green: flow 1 passes; the recording shows "Login" fitting its box.

## Verification

- `pnpm check`: pristine (tsc both configs, biome 0 diagnostics, vitest 52 files / 367 tests passed).
- `pnpm build`: only the pre-existing chunk size warning.
- `pnpm e2e` three times in a row: 3 passed (9.4s), 3 passed (8.6s), 3 passed (8.4s).
- `pnpm demo`: 3 passed, videos written to `docs/demo/`.
- Playwright needs to run outside the Claude Code sandbox: headless Chromium aborts with a mach port `Permission denied` inside it, and `pnpm add` needed the global store.

## Manual observations (frames extracted from the videos with ffmpeg)

- 01: board created, two boxes drawn and marquee-selected, chip "2 selected: rectangle, rectangle", proposal ghosts appear right of the selection, Accept turns them solid; after the fix "Login" and "Home" fit their boxes. I moved the drawing left of center so the proposal lands in view without scrolling the user's boxes away.
- 02: the seeded box first rendered with no label because my seed text lacked `fontSize`, `fontFamily`, `lineHeight`; with them it shows "Login". The citation is underlined and blue, clicking it selects the box ("1 selected: Login"), and the tasks view shows both cards with their citations.
- 03: the run card goes straight to Done with branch `blueprint/login-page`, $0.0500, and a PR link.
- Each video opens with roughly 1 to 1.5 seconds of white while the page loads.
- The panel transcript shows the propose tool's raw result `{"proposalId":"p_..."}` and absolute `/private/var/...` paths for the Write tool. Both are existing transcript behaviour (tool results render their text summary), not changed here; worth a polish pass.

## Self-review

- Every wait is a locator expectation or `expect.poll`; no sleeps.
- Each test owns its temp repo and server; teardown kills the server and deletes the repo even when the test fails.
- A seed that throws leaves its temp dir behind (the repo is pushed for cleanup only after the seed runs); acceptable for a test helper.
- `pnpm e2e` / `pnpm demo` rebuild the app once per worker (about 3 seconds); a worker restarted after a failure rebuilds again.
- No em dashes in any file I wrote.

## Concerns

1. "See its card go Working then Done" is not observable.
   The fake run has no step that takes time or waits, so the run is Done before the sessions view first fetches runs (the first resolved status was "Done" in every attempt).
   I did not touch Task 1's fake or scenario; the test asserts Done plus the PR link, with a comment saying why Working is not asserted.
   Options if Working must show: (a) add an `ask` step to the scenario's run rule (for example `Bash` `gh pr create`), which holds the card at "Needs you" until the test clicks Allow, a deterministic and realistic mid-run state, or (b) add a fake step that holds the turn until the test releases it.
2. `tsconfig.json` and `biome.json` were changed beyond the brief's file list, for the reasons above.
3. The BoardView fix is outside the brief's file list; it is a separate `fix(ui)` commit so it can be reviewed or dropped on its own.

## Commits

- `6692890` fix(ui): proposal labels are measured in Excalifont, so accepted boxes fit them
- `8ad61f5` test(e2e): Playwright flows for ask, compile, and launch, with a recorded demo

## Fix round 0

Ruling applied: the run rule in `e2e/scenario.json` now starts with an `ask` step for `Bash` `git push -u origin HEAD` ("Push the branch to open its PR"), before the write step.

- `launch a run` now waits for the card's status "Needs you", checks the permission dialog reads "Allow Bash", hovers and clicks "Allow once", then waits for "Done" and the PR link, and checks the worktree branch as before.
- Working is still not asserted.
  Before the ask, the card is Working only until the ask arrives, and after Allow only until the instant write and say steps finish, so neither stretch is held long enough for an expectation to see it.
  In the recording no frame shows Working (checked at 10 fps); the held states, Needs you with the dialog and then Done, are what the test waits on.
- The demo's `slowMo` went from 250 to 500 ms, and the test hovers Allow before clicking it, so the dialog stays on screen for about a second in `03-launch-run.webm` (at 250 ms it showed for one or two frames).
  This re-recorded all three videos: 15.1, 5.6, and 4.4 seconds.
- `docs/demo/README.md`: flow 3's line mentions allowing the push.
- Frames checked: Needs you badge, "Allow Bash: running `git push -u origin HEAD`" with Allow once, Allow always, Deny; then Done, $0.0500, PR link.

Verification:
- `pnpm check`: exit 0, no errors or warnings.
- `pnpm e2e` three times in a row: 3 passed (9.5s), 3 passed (9.0s), 3 passed (9.1s).
- `pnpm demo`: 3 passed.

Commit: `9fc1030` test(e2e): the launch flow answers the run's permission ask before it finishes
