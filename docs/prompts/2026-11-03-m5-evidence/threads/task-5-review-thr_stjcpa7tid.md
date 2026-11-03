### Spec Compliance
- Spec compliant. Every item in the brief is in `README.md`:
  - A three-sentence intro with a screenshot from `docs/design/` (README.md:3-7).
  - Requirements (README.md:9-15).
  - Install and run with `pnpm install`, `pnpm build`, `node dist/cli/index.js` and `pnpm link --global` (README.md:17-46).
  - The login caveat with all three points the brief asks for (README.md:48-53).
  - The seven-step loop with links to the demo videos (README.md:55-84).
  - The fake SDK path using `BLUEPRINT_FAKE_SDK=e2e/scenario.json` (README.md:86-108).
  - The `.blueprint/` table with what is committed (README.md:110-124).
  - All six known limitations (README.md:126-136).
  - The four dev commands (README.md:138-148).
- Extras: the `--port`, `--no-open` and `init` options (README.md:36), the `pnpm setup` hint (README.md:45), and the clone cleanup commands (README.md:102-108). Each one helps a reader follow the steps. None is scope creep.
- Cannot verify from the diff alone:
  - The fresh-clone run-through in Step 2 (install, build, link, the browser loop). I only have the report's description of it.
  - The UI labels Spec, Tasks, Sessions, New doc and Needs you. I only checked "Launch anyway" (`src/ui/plan/LaunchDialog.tsx:107`).
  - `pnpm dev` (README.md:143). The report says its server half could not start in the sandbox, so this command was not run end to end.

### Strengths
- The claims hold up against the code. I checked these:
  - Every linked asset exists: the screenshot, the three `.webm` videos, `DESIGN.md` and `docs/build-plan.md`.
  - `bin.blueprint` is `dist/cli/index.js`, and `packageManager` pins pnpm 10.30.1.
  - The ignored rows of the table match `GITIGNORE_LINES` (`src/server/files.ts:75`).
  - The squash and rebase limitation matches `merge-base --is-ancestor` (`src/server/runs/git.ts:46`).
  - The fake SDK message comes from `src/server/index.ts`.
- The cleanup commands are scoped to the clone, and the clone's `.gitignore` already has both lines. So the walkthrough leaves the clone clean, and nobody is told to run `rm -rf .blueprint` in a real project.
- Claims were made accurate instead of left aspirational:
  - "Each run is told to" commit, push and open a pull request (README.md:79), rather than claiming Blueprint does it.
  - The dropped `board:main#login` citation is explained (README.md:98) instead of left as a surprise.
- Style rules are met: no em dashes (`grep -c '—'` returned 0), one sentence per line, and "Claude Code" appears only as the thing Blueprint runs beside.

### Issues
#### Critical (Must Fix)
- None.

#### Important (Should Fix)
- None.

#### Minor (Nice to Have)
- The `pnpm dev` line was not checked end to end (README.md:143). Its wording does match the script in `package.json:13` (`tsx watch ... --no-open` plus `vite`). Someone should run it once outside the sandbox.
- The fake scenario's final message says it committed `src/login.ts`, but the fake only writes the file (raised in the report's Concerns). The README sensibly does not repeat the claim. It belongs in a follow-up to the scenario, not this task.
- The report says a server answers 500 after `.blueprint/` is deleted while it is running (Concerns). This is out of scope here, but worth a follow-up.

### Assessment
Task quality: Approved
Reasoning: The README covers every item in the brief, and every claim I spot-checked matches the code and the repository. The only open point is that `pnpm dev` was not run end to end, which is minor.
