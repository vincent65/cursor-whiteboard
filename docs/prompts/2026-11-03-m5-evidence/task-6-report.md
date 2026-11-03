# Task 6 report: Milestone acceptance

Status: DONE_WITH_CONCERNS

Commits on `m5-evidence` after `ef4f836`:

- `5cbc8a9 fix(server): an ask shows the whole command it would allow`
- `6c45328 fix(server): the compile lists the files to read and names the stack`
- `91ca1ca fix(ui): task and run cards render inline Markdown instead of backticks`
- `901f9e1 fix(ui): a citation centers its shape in the compact board layout`
- `59549c4 fix(ui): a proposed node leaves room around its label`
- `a10d0f6 fix(server): an ask shows its command verbatim`

None of them has a co-author trailer.

## Step 1: gates

- Before any change: `pnpm check` was pristine with 407 tests, and `pnpm build` warned only about the chunk size.
- `pnpm e2e` failed inside the sandbox, as earlier tasks recorded.
  Outside the sandbox it passed three times in a row, 3 of 3 each time.
- After all fixes: `pnpm check` is pristine with 417 tests, `pnpm build` warns only about the chunk size, and `pnpm e2e` passed three times in a row, 3 of 3 each time.

## Step 2: the real loop

I made a scratch repository with no remote at `$TMPDIR/bp-accept`.
It holds a tiny JavaScript notes CLI: `README.md`, `package.json`, and `src/notes.js`, in one commit.
I ran the built CLI there with `BLUEPRINT_FAKE_SDK` unset, on port 4931, against the real Claude Code 2.1.306 login, and drove it with the Playwright MCP browser at 1280 by 800.
All screenshots are in `task-6-evidence/`.

| Step | What I saw | Screenshot |
| --- | --- | --- |
| Empty app | The empty state and the Claude panel read cleanly. | `01-empty.png` |
| Draw | **New board** asks for a name in a native `prompt()`. I drew two boxes, `notes add <text>` and `notes list`. | `02-drawn.png` |
| Ask for a diagram | Working status, then a 5-shape ghost flowchart beside the selection, with the proposals bar. Turn done at $0.2503. | `03-asking.png`, `04-proposal.png`, `04b-proposal-panel-top.png` |
| Refine | **Refine** focuses the box and shows a "Refining p_…" chip. Claude revised the ghosts in place. Turn done at $0.3206 total. | `05-refine-open.png`, `06-refined.png`, `06b-refined-panel.png` |
| Accept | The ghosts became ordinary shapes, and the labels stayed on one line. The boxes hugged their labels (fix F). | `07-accepted.png` |
| Compile | Claude asked to write `spec.md` (Allow once). The panel showed two EISDIR error rows and Claude's own note "I had no Glob tool here" (fix B). Turn done at $0.4487 total. | `09-compiled.png`, `10-compiled.png` |
| Spec | Six sections with citation chips. A chip opens the board with the shape selected, but the shape was not centered at 1280 by 800 (fix D). | `11-spec.png`, `11b-spec-full.png`, `12-chip-opens-board.png` |
| Split | "Splitting…", then 4 task files about 2 minutes later, for $0.2999. The view does not move on by itself. The tasks were planned in Python and pytest for a JavaScript repository (fix B), and titles and checks showed raw backticks (fix C). | `13-splitting.png`, `14-tasks.png`, `14b-tasks-full.png` |
| Launch task 1 | The launch dialog has Accept edits selected by default. Sessions showed the run as Needs you. Every Bash ask cut its command at 60 characters (fix A). | `15-launch-dialog.png`, `16-launched.png`, `17-run-needs-you.png` |
| Watch it finish | After 5 asks the run ended **Idle** at $0.3838, committed on `blueprint/notes-store`, and its reply said there was no remote, so no PR. | `18-run-idle.png`, `18b-run-idle-full.png` |
| Mark done | The badge went to Done. | `19-marked-done.png` |
| Launch the dependent | The dialog listed "notes-store: branch not merged into HEAD" and needed **Launch anyway**, as the README describes. The run merged the dependency branch itself, asked 5 times, and ended Idle at $0.4863. | `21-launch-dependent.png`, `21b-launch-anyway.png`, `22-dependent-running.png`, `24-dependent-idle.png` |
| Other sizes | At the Playwright default of 1280 by 720, Sessions, Tasks, Spec, and the board lay out correctly. At 1440 by 900 the board uses Excalidraw's desktop layout. | `25-default-1280x720-*.png`, `26-1440x900-board.png` |

Before allowing any ask, I read the full command in the run's session transcript under `~/.claude/projects/`.
Each was a read, a test run, a local `git commit`, a ff-only merge of the dependency branch, or a `pip install .` into a temporary venv.
No push was possible, since the repository has no remote.

## Fixes

Each fix is test first: the new test failed, then passed after the change.

### A. A permission ask showed a truncated command (safety)

The ask reused the tool row's summary, which cuts a Bash command at 60 characters.
In the real run, one ask read `python3 -m pytest test_notes.py -q 2>&1 | tail -1 && git add` while the hidden rest ran `git commit`.
Another read `… V=$(mktemp -d); python3` and hid a venv, a `pip install .`, and a dozen CLI calls (`23-truncated-multiline-ask.png`).
`summarizeTool` gained a `full` flag that the broker sets: an ask shows the whole command, and `.ask .cmd` keeps its line breaks.
In self-review I found that the ask still went through `relativeTo`, which drops the session directory anywhere in the text.
That would show `cd /tmp && rm -rf /repo/build` as `… rm -rf build`, so `a10d0f6` shows the command verbatim.
Tests: `test/server/agent/broker.test.ts` covers "an ask shows the whole command, however long" and "an ask shows a command verbatim, with its paths as written".
Fake-SDK check: the ask reads `git push -u origin HEAD` in full (`after-A-C-run-ask.png`).

### B. The compile asked for a Glob tool that Claude Code no longer has, and the split guessed the stack

Claude Code 2.1.306 has no Glob tool; its tool list in the session transcript has none.
The compile instruction "Read files with the Read and Glob tools" left Claude calling Read on `.blueprint/export/boards` and `.blueprint/docs`, which gave two EISDIR rows.
Claude reported that it could not check for other boards, so a plan with a second board would compile without it.
Separately, the split runs with no tools and sees only the spec, and nothing in the spec named the language, so it planned pytest and argparse tasks in a JavaScript repository.
The first run then dutifully wrote `notes.py` beside `src/notes.js`.
The fix has two parts.
First, `compileMessage(boards, docs)` now lists each board export path, and the docs under `.blueprint/docs/` with their heading slugs as before; `writeBoardExports` returns the names it exported.
Second, the instruction asks the spec to state the repository's language and test command under Constraints, from the README and manifest at its root.
Tests are in `test/server/agent/prompt.test.ts` and `test/server/agentRoutes.test.ts`; the latter checks that the message names `main` and leaves out the broken board.
Real re-check (one compile, one split):
- The compile read `notes.md`, `README.md`, and `package.json`, with no errors, for $0.1266.
- Constraints now say "JavaScript on Node.js, as ES modules", with no test command defined yet.
- The new split ($0.1313) planned `npm test` and `node --test` tasks.
- Screenshots: `after-B-compiled.png`, `after-B-tasks.png`.

### C. Task and run cards showed Markdown backticks

Task titles, acceptance checks, the launch dialog title, run card titles, and the run preview rendered Claude's Markdown as plain text, for example `` `notes add <text>` CLI command ``.
`Inline` in `src/ui/markdown.tsx` runs the renderer's existing inline pass, and `.md-inline code` gets the same chip as `.md code`.
Tests are in `markdown.test.tsx`, `TasksView.test.tsx`, `RunCard.test.tsx`, and `LaunchDialog.test.tsx`.
Screenshots: `after-C-tasks.png`, `after-C-launch-dialog.png`, `after-C-run-done.png`.

### D. A citation chip landed off center at 1280 by 800

The focus kept 232 px clear for Excalidraw's properties panel.
At 1280 by 800 the board is 680 px wide, so Excalidraw 0.18.1 uses its compact layout, which has no side panel.
The cited box landed 115 px right of center, with its neighbours under the Claude panel (`12-chip-opens-board.png`).
`leftInset` in `src/ui/board/focus.ts` follows Excalidraw's `isMobileBreakpoint`: under 730 px wide, or under 500 px high and under 1000 px wide.
Test: `test/ui/focus.test.ts`.
After: `after-D-chip-focus-1280.png`.

### F. A proposed node's border touched its label

`renderNode` let Excalidraw size the shape to its label alone, with 5 px of padding.
It now adds 20 px on each side and 15 px above and below.
Test: `test/ui/mermaid.test.ts`.
After: `after-F-ghosts.png` and `after-F-accepted.png` (Login and Home).

## Seen but not fixed

All of these are recorded with screenshots.
None blocked a step.

1. Ghost placement ignores what is already there.
   `placeBeside` puts additions right of the selection even when shapes occupy that spot; the fake proposal's Home box landed on top of "Read + print" (`after-F-ghosts.png`).
   Fixing it needs collision-aware placement, which is more than a smallest fix.
2. Citation chips show raw element ids, such as `notes#038d46a8-ea46-4fba-8f34-d67d2ae1e2f7`, rather than the shape's label (`11-spec.png`, `14-tasks.png`).
   This was already deferred in Task 3 as "chip kind label"; on a real board it is the most visible rough edge of the spec and tasks.
3. Tool rows in the panel:
   - ToolSearch's result reads just "done".
   - A propose result reads "proposal p_a57feb3f is on the board", which shows an internal id and contradicts "nothing stays until you accept".
   - Read results dump file contents with line numbers, for example "1 # Board: notes 2 3 ## Diagram …" (`04b-proposal-panel-top.png`, `10-compiled.png`).
4. **New board** and **New doc** use the browser's native `prompt()` dialog.
5. After a split finishes on the Spec view, the button just re-enables.
   Nothing says that 4 tasks were written or points to Tasks.
6. **Mark done** does not ungate dependents: the next launch still needs **Launch anyway** while the branch is unmerged.
   That matches the README; I note it because in a repository without a remote, every dependent needs the override.
7. A run card reads `$0.0000 total` while its first turn is running, because the cost arrives at the end of the turn.
8. Every run is told to commit, push, and open a PR, so in a repository without a remote it spends a few asks on `git remote -v` and `gh auth status` before concluding there is no PR.
   The run that ended Idle explained this clearly.
9. The user's global `~/.claude/CLAUDE.md` reaches the runs.
   One run amended its commit to drop a co-author line because of it.
   That is Claude Code's normal behaviour, not Blueprint's.

## Files changed

- `src/server/agent/events.ts`, `src/server/agent/broker.ts`, `src/ui/styles.css` (A)
- `src/server/agent/prompt.ts`, `src/server/agent/index.ts` (B)
- `src/ui/markdown.tsx`, `src/ui/plan/TasksView.tsx`, `src/ui/plan/LaunchDialog.tsx`, `src/ui/sessions/RunCard.tsx`, `src/ui/styles.css` (C)
- `src/ui/board/focus.ts`, `src/ui/board/BoardView.tsx` (D)
- `src/ui/board/mermaid.ts` (F)
- Tests:
  - `test/server/agent/broker.test.ts`, `test/server/agent/prompt.test.ts`, `test/server/agent/session.test.ts`, `test/server/agentRoutes.test.ts`
  - `test/ui/markdown.test.tsx`, `test/ui/TasksView.test.tsx`, `test/ui/RunCard.test.tsx`, `test/ui/LaunchDialog.test.tsx`, `test/ui/focus.test.ts`, `test/ui/mermaid.test.ts`

## Self-review

- The brief expected no file changes.
  These fixes touch existing files only and add no dependencies.
  A and B change what a real user sees and allows; C, D, and F are visual defects seen on every real plan at 1280 by 800, so I fixed them under the "fix what breaks a step" and pixel-perfection standards.
  If C, D, and F are judged out of scope, they are separate commits that revert cleanly.
- A: rows still cut commands at 60 characters, which the transcript needs.
  Only the ask gets the full, verbatim command.
  Edit and Read asks still show relativized paths, which is lossless for a single file path.
- B: the doc list keeps bare file names, so citations stay `[[doc:api.md#…]]` and Claude is not tempted to cite a full path.
  The first line of the instruction is unchanged, so the restored-transcript label and the e2e scenario's match still work.
- D: the breakpoint is copied from Excalidraw 0.18.1 and marked as a fixed value, next to the panel width it already pinned.
- F: the padding goes through `convertToExcalidrawElements` with an explicit size, so Excalidraw still lays out the label inside the container.
  Accept kept every label on one line.
- The split re-check overwrote the scratch repository's task files.
  That only affects the scratch repository.

## Cleanup

- Every server I started is stopped: the real one on 4931 twice, and a fake-SDK one on 4932 against a copy of the plan at `$TMPDIR/bp-fake`.
  `ps` and `lsof` show no Blueprint process or listener left.
- I closed the browser and removed the `.playwright-mcp/` snapshots the browser tool wrote into the repository.
  `git status` is clean.
- The scratch repositories under `$TMPDIR` remain, with their worktrees, for inspection.

## Concerns

- Real spend: about $1.88 on the user's allowance.
  - Plan session: $0.5753 across ask, refine, and two compiles.
  - Splits: $0.30 and $0.13.
  - Runs: $0.38 and $0.49.
- Seen-but-not-fixed items 1 to 3 (ghost overlap, raw-id chips, tool-row wording) are the most visible remaining polish.
  I suggest them for a final wave.
- The real check of B is one sample.
  The prompt now asks for the language and test command, and Claude followed it here, but a repository with no README or manifest leaves Constraints to Claude's judgement.
