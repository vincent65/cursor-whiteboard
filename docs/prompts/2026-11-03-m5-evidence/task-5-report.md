# Task 5 report: README

Status: DONE_WITH_CONCERNS

## What I implemented

A new `README.md` at the repository root, with one sentence per line and no em dashes.
Sections, in order:

- What Blueprint is, in three sentences, with `docs/design/after-board-proposal.png` (the board with a pending proposal) as the screenshot.
- Requirements: macOS or Linux, Node 22.1 or later plus pnpm, git, Claude Code installed and logged in once with `claude`, optionally `gh`.
- Install and run: clone to `~/blueprint`, `pnpm install`, `pnpm build`, `node ~/blueprint/dist/cli/index.js` from the target repository, the `--port`, `--no-open`, and `init` options from `src/cli/args.ts`, and `pnpm link --global` for a `blueprint` command (with the `pnpm setup` hint for a missing global bin directory).
- The login caveat in plain words: no credentials, no API, your own Claude Code login through the Agent SDK; Anthropic's terms reserve claude.ai login for first-party products; a personal tool, not offered as a service.
- The loop: board, ask, accept or refine, compile, split, launch, watch, using the UI's real labels (New board, Accept, Reject, Refine, Compile, Split into tasks, Launch, Launch anyway, Needs you), then links to the three demo videos.
- Trying it without a subscription with `BLUEPRINT_FAKE_SDK=e2e/scenario.json` from the clone, the full-path form for another repository, what the scenario does, and the exact cleanup commands.
- What lives in `.blueprint/` as a table, from `docs/build-plan.md` section 5 and `SUBDIRS` and `GITIGNORE_LINES` in `src/server/files.ts`.
- Known limitations: the six from the brief, with the cleanup commands for an unusable run.
- Development commands: `pnpm dev` (server on 4242, Vite UI on 5173, per `vite.config.ts`), `pnpm check`, `pnpm e2e`, `pnpm demo`.

## TDD evidence

Not applicable: documentation only, no behaviour.

## Manual verification (fresh clone at /tmp/claude/bpv/blueprint, cloned from the local repository at 4582cf2)

- `pnpm install`: completed with pnpm 10.30.1 and Node 22.23.1 (needs registry.npmjs.org; warns that esbuild's build script was ignored, which is pnpm 10's default and harmless).
- `pnpm build`: succeeded, with only the existing chunk size warning.
- `node <clone>/dist/cli/index.js --no-open --port 4311` in a scratch repository with one empty commit: printed `Blueprint running at http://localhost:4311`, served the UI (HTTP 200), created `.blueprint/{assets,boards,docs,export,tasks,worktrees}`, and wrote the two ignored lines to `.gitignore`.
- `node <clone>/dist/cli/index.js init` printed `Initialized .blueprint/ in ...`; an unknown flag printed `unknown flag: --bogus`.
- `pnpm link --global` with `PNPM_HOME` pointed at a temporary directory: linked, and `blueprint init` then worked from the scratch repository through the linked command.
- `BLUEPRINT_FAKE_SDK=e2e/scenario.json node dist/cli/index.js` in the clone: printed `Using the fake SDK from /private/tmp/claude/bpv/blueprint/e2e/scenario.json` before the address, as the README says.
- The whole loop in a browser at 1280 by 800 against that server, as a reader would do it: New board named `main`, drew a rectangle, selected it, asked; the Sign-in flow proposal appeared with Accept, Reject, Refine; Accept cleared it; Compile wrote the spec; Split into tasks made two tasks; Launch on the Home task showed `login-page: no run` and the Launch anyway checkbox; Launch on the Login task went to Sessions, read Needs you, Allow once, then Done with a PR link on the card.
- Found while following it, and fixed in the README: the scenario's spec cites `board:main#login`, which a hand-drawn board does not have, so the Spec page reported `Dropped 1 citation that no longer resolves: [[board:main#login]]`. The README now says so and points to the compile video for the resolved chip.
- The cleanup block (`git worktree remove --force .blueprint/worktrees/login-page`, `git branch -D blueprint/login-page`, `rm -rf .blueprint`) left the clone clean with one worktree.
- Other README fixes from following it: the clone path is now explicit (`~/blueprint`) so later commands that use it work; the cleanup is scoped to the clone so nobody runs `rm -rf .blueprint` in a real project.
- `pnpm dev`: the Vite half served on 5173, but the server half could not start in my sandbox because tsx's watch mode could not listen on its IPC pipe (`listen EPERM ... tsx-501/*.pipe`), even with a writable `TMPDIR`. This is the sandbox, not the command; the server itself was verified through the built CLI above.

## Checks

- `pnpm check`: pristine; 54 test files, 407 tests passed. Biome formats Markdown, so the `.blueprint/` table is in its aligned form.
- `pnpm e2e` not rerun: the task changes only `README.md`.

## Files changed

- `README.md` (new).

## Commit

- `ef4f836 docs: README with setup, the login caveat, and the walkthrough`

## Self-review

- Every UI label in the README was checked against the source or seen in the browser.
- Claims I softened after checking the code: "a run finishes, commits, pushes" became "each run is told to", since that is the run prompt's definition of done, not something Blueprint enforces; "two processes overwrite each other" became "not supported", since I did not verify the overwrite.
- The clone URL is the repository's `origin` (`https://github.com/vincent65/cursor-whiteboard.git`); nothing was pushed.

## Concerns

- The fake run's final message says it committed `src/login.ts`, but the fake only writes the file, so the worktree shows it uncommitted. The README does not repeat that claim. A scenario that cites a real drawn element or that commits is a possible follow-up for the demo, not this task.
- The browser console showed `ENOENT ... scandir .blueprint/boards` 500s after I deleted `.blueprint/` while the server and page were still open. That came from my cleanup, not from the walkthrough. Still, a server whose `.blueprint/` disappears answers 500 until restarted, which may be worth a follow-up.
- `pnpm dev` could not be fully exercised in the sandbox (see above).
