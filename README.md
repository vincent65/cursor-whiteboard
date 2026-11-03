# Blueprint

Blueprint is a local planning whiteboard that runs beside Claude Code in one of your repositories and opens in your browser.
You plan on Excalidraw boards and in Markdown docs, ask Claude from a panel beside the board, and accept, reject, or refine the shapes it proposes before they become part of the board.
When the plan is ready, Blueprint compiles it into a spec and tasks that cite the board, launches one Claude Code session per task in its own git worktree, and shows those sessions on one page where you can watch, message, and stop them.

![A board with Claude's proposed sign-in flow drawn as dashed ghost shapes beside the Login box, the Accept, Reject, and Refine bar below it, and the Claude panel on the right](docs/design/after-board-proposal.png)

## Requirements

- macOS or Linux.
- Node 22.1 or later, and pnpm (`corepack enable` provides the version `package.json` pins).
- git.
- Claude Code installed and logged in once by running `claude`.
- Optionally, the GitHub CLI `gh`, logged in, so a run can open its pull request.

## Install and run

Clone the repository and build it; the rest of this README assumes the clone is at `~/blueprint`:

```sh
git clone https://github.com/vincent65/cursor-whiteboard.git ~/blueprint
cd ~/blueprint
pnpm install
pnpm build
```

Then start Blueprint from the root of the repository you want to plan in:

```sh
cd ~/code/your-project
node ~/blueprint/dist/cli/index.js
```

It creates `.blueprint/`, adds its ignored paths to `.gitignore`, serves the UI at http://localhost:4242, and opens it in your browser.
`--port <n>` picks another port, `--no-open` skips the browser, and `init` creates `.blueprint/` without serving.

For a `blueprint` command on your PATH, link the clone once:

```sh
cd ~/blueprint
pnpm link --global
```

If pnpm reports that it has no global bin directory, run `pnpm setup`, open a new shell, and link again.
After that, `blueprint` in any repository does the same as the `node` command above.

## The login caveat

Blueprint holds no credentials and calls no API.
Every model call runs in Claude Code, which Blueprint drives through Anthropic's Agent SDK on your own Claude Code login, so it spends your plan's usage like a terminal session does.
Anthropic's terms, as the Agent SDK documentation states them, reserve claude.ai login for first-party products, and Blueprint is not one.
Blueprint is a personal tool built for its author's own use; it is not offered as a service, and if you run it on your login you take that on yourself.

## The loop

1. **Board.**
   Press **New board** in the left rail, name it, and draw.
   Docs work the same way with **New doc**, and pasted images are stored under `.blueprint/assets/`.
2. **Ask.**
   Select shapes and type in the Claude panel.
   Claude sees what you selected and answers with text, or proposes shapes that appear as dashed ghosts beside the selection.
3. **Accept or refine.**
   **Accept** keeps the ghosts as ordinary shapes, **Reject** removes them, and **Refine** lets you tell Claude what to change so it revises the ghosts in place.
   Nothing Claude proposes stays on the board until you accept it.
4. **Compile.**
   **Compile** in the Claude panel writes `.blueprint/spec.md` from your boards and docs.
   Under **Spec**, each citation is a chip that opens the board with the cited shape selected.
5. **Split.**
   **Split into tasks** on the spec writes one file per task under `.blueprint/tasks/`, with its dependencies, files, acceptance criteria, and sources.
6. **Launch.**
   Under **Tasks**, **Launch** starts a Claude Code session for that task on a new branch `blueprint/<slug>` in its own worktree, in the permission mode you pick.
   A task whose dependencies have not finished and merged into your current branch needs **Launch anyway**.
7. **Watch.**
   **Sessions** shows a card per run with its status, transcript, and a message box.
   A run that asks to use a tool reads **Needs you** until you allow or deny it on its card.
   Each run is told to commit on its branch, push, and open a pull request with `gh` if it can, then print the pull request's URL, which its card shows as a link.
   Without `gh`, or without a remote, a run ends **Idle** with its work committed on its branch.
   **Mark done** on its card marks it finished; once you merge its branch into your current branch, the tasks that depend on it launch without **Launch anyway**.

The three recorded flows show this loop end to end against the fake SDK:

- [Plan, ask, and accept](docs/demo/01-plan-ask-accept.webm)
- [Compile and split](docs/demo/02-compile-split.webm)
- [Launch a run](docs/demo/03-launch-run.webm)

## Try it without a subscription

`BLUEPRINT_FAKE_SDK` points Blueprint at a scenario file that a fake SDK replays instead of running Claude.
`e2e/scenario.json` in the clone is the scenario the tests and demo videos use.
A relative path is resolved from the directory Blueprint runs in, so the simplest place to try it is the clone itself:

```sh
cd ~/blueprint
BLUEPRINT_FAKE_SDK=e2e/scenario.json node dist/cli/index.js
```

The server prints `Using the fake SDK from` and the scenario's full path before its address.
From another repository, give the full path instead, as in `BLUEPRINT_FAKE_SDK="$HOME/blueprint/e2e/scenario.json" blueprint`.

The scenario answers every question with the same Login and Home flowchart, compiles a fixed spec, splits it into two tasks, and has each run write `src/login.ts`, ask to push, and print an example PR link.
The spec cites the first labelled shape on a board named `main`, so name your board `main` and the spec's citation chip opens that shape.
Allowing the push runs nothing, but a launched run does make a real branch and worktree.
When you are done, remove what the walkthrough made in the clone:

```sh
git worktree remove --force .blueprint/worktrees/login-page
git branch -D blueprint/login-page
rm -rf .blueprint
```

## What lives in `.blueprint/`

| Path                            | What it holds                                          | In git    |
| ------------------------------- | ------------------------------------------------------ | --------- |
| `boards/<name>.excalidraw.json` | Board scenes, with images stored separately            | Committed |
| `assets/<sha256>.<ext>`         | Pasted images and files                                | Committed |
| `docs/<name>.md`                | Markdown docs                                          | Committed |
| `spec.md`                       | The compiled spec                                      | Committed |
| `tasks/<nn>-<slug>.md`          | One task per file, with frontmatter                    | Committed |
| `sessions.json`                 | Blueprint's index of the plan session and its runs     | Committed |
| `proposals.jsonl`               | Every proposal and whether it was accepted or rejected | Committed |
| `export/`                       | Board Markdown and PNG regenerated for Claude to read  | Ignored   |
| `worktrees/<slug>/`             | One worktree per run                                   | Ignored   |

Blueprint writes the files and you commit them like any other change; it never commits plan files for you.

## Known limitations

- Claude Code approves read-only Bash commands, such as `ls` or `git status`, without asking, so they never show an ask in Blueprint.
- A task runs once: a second launch fails because its branch and worktree already exist.
  To retry a run that failed, send it a message on its card instead.
- The dependency check asks git whether a dependency's branch is an ancestor of your current branch, so a dependency merged by squash or rebase reads as not merged, and its dependents need **Launch anyway**.
- Blueprint never removes a worktree or branch.
  A run whose session cannot resume and whose worktree is unusable needs manual cleanup: `git worktree remove --force .blueprint/worktrees/<slug>` and `git branch -D blueprint/<slug>`, after which the task can launch again.
- Windows is untested.
- One Blueprint per repository: a second Blueprint process on the same repository is not supported.

## Development

```sh
pnpm dev     # the server on port 4242 with reload, and the UI at http://localhost:5173
pnpm check   # type checks, Biome, and the unit tests
pnpm exec playwright install chromium   # once, before the first e2e or demo run
pnpm e2e     # Playwright flows against the fake SDK
pnpm demo    # the same flows, recorded into docs/demo/
```

`pnpm dev` serves the repository you run it in, which is the clone itself.
The design notes behind the MVP are in [docs/build-plan.md](docs/build-plan.md), and the UI's design system is in [DESIGN.md](DESIGN.md).
