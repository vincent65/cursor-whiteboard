### Task 2: Playwright flows and the recorded demo

**Files:**
- Create: `playwright.config.ts`, `e2e/flows.spec.ts`, `e2e/fixtures.ts`, `docs/demo/README.md`
- Modify: `package.json` (`@playwright/test` dev dependency; scripts `e2e` and `demo`), `.gitignore` (`test-results/`, `playwright-report/`)

**Interfaces:**
- `e2e/fixtures.ts` builds the CLI once, makes a temp git repository with one commit per test, starts `node dist/cli/index.js --no-open --port 0` there with `BLUEPRINT_FAKE_SDK=e2e/scenario.json`, reads the printed port, and stops it after the test.
- `e2e/flows.spec.ts` has three tests:
  1. `plan, ask, and accept`: create a board, draw two rectangles with the Excalidraw toolbar, select them, ask in the panel, see the proposals bar, Accept, and assert the board file holds elements tagged `origin: "ai"`.
  2. `compile and split`: press Compile, see the spec view with an underlined citation, click it and land on the board with the element selected, press Split, and see two task cards.
  3. `launch a run`: from the tasks view launch the first task, see its card go Working then Done with a PR link, and assert `.blueprint/worktrees/<slug>` exists on branch `blueprint/<slug>`.
- `pnpm demo` runs the three flows with `video: "on"` at 1280 by 800 and copies the videos to `docs/demo/` as `01-plan-ask-accept.webm`, `02-compile-split.webm`, `03-launch-run.webm`; `docs/demo/README.md` lists them.
- No `waitForTimeout`; every wait is a locator expectation.

- [ ] **Step 1: Write the three flows** against the fake.
- [ ] **Step 2: Run `pnpm e2e` three times**; all pass each time.
- [ ] **Step 3: Run `pnpm demo`** and commit the videos.
- [ ] **Step 4: Commit** `test(e2e): Playwright flows for ask, compile, and launch, with a recorded demo`

---

