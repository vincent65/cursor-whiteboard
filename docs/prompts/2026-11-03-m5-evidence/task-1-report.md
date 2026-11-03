# Task 1 report: Fake SDK mode

Status: DONE_WITH_CONCERNS

Commit: `07dc67e feat(server): a fake SDK mode that replays a scenario`

## What I implemented

- `src/server/fake/scenario.ts` holds the brief's Zod schema, verbatim.
  One addition: `match` is refined to be a valid regular expression, so a bad regex is named by its path too.
  `loadScenario(path)` reads the file synchronously and throws `The fake SDK scenario <path> could not be read: ...` or `... is invalid:` followed by `z.prettifyError`, which names the path (for example `→ at plan[0].steps[1].do`).
- `src/server/fake/sdk.ts` has `createFakeSdk(scenarioPath)`, which returns `{ query, getSessionMessages, listSessions }` with the SDK's signatures.
  - The session kind is picked from the options: `outputFormat` means split, `mcpServers.blueprint` means plan, anything else means run.
  - `query` emits an init message, then for each user message the first rule whose `match` tests true:
    - `say` emits stream deltas (only with `includePartialMessages`, as the SDK does) and an assistant text message.
    - `tool` emits a `mcp__blueprint__<name>` tool_use, parses the input with the registered tool's `inputSchema` (so Zod defaults apply, like the MCP server), calls its handler through `_registeredTools` (one private-field access, in `toolsOf`), and returns a tool_result. A thrown error becomes an error result with the error's message, as the MCP server reports it.
    - `write` emits a `Write` tool_use with the absolute path, refuses a path that resolves outside the session `cwd` with an error tool result, and otherwise creates the directories and writes the file.
    - `ask` emits a tool_use, awaits `options.canUseTool` (racing the turn's abort signal), and reports allow (ok) or deny (error with the deny message). A deny with `interrupt: true` ends the turn as an interrupt.
  - Each turn ends with a success result whose `total_cost_usd` is the query's running total (the real SDK's semantics, which the run manager relies on).
    A message no rule matches ends with an `error_during_execution` result naming the session kind.
  - With `outputFormat`, the result carries `structured_output: scenario.split` and costs 0.01.
  - `interrupt()` aborts the turn in flight; the turn stops between steps and ends with an `error_during_execution` result with no errors, which PlanSession shows as interrupted. The transcript saves `[Request interrupted by user]` like the CLI does.
    `close()` aborts the turn and stops reading input.
  - Sessions are kept in a per-fake `Map`; `resume` of a known id keeps the id and appends; an unknown id throws `No conversation found with session ID: <id>` before init, which PlanSession already treats as a refused resume.
    `getSessionMessages` returns the saved user and assistant messages in the `SessionMessage` shape (with timestamps), so `transcriptFrom` replays them.
    `listSessions` returns `[]`.
- `src/server/index.ts` gains `loadSdk()`, which reads `BLUEPRINT_FAKE_SDK` once per `startServer`, resolves it against the process cwd, dynamically imports `./fake/sdk.js` only when it is set, logs `Using the fake SDK from <path>`, and passes the result to `createAgent` (plan session and split), `RunManager`, and the sessions routes.
  With the variable unset, `claudeSdk` is passed everywhere, as before.
- `src/server/agent/index.ts`, `runs/manager.ts`, and `sessions.ts` already accepted injected SDK functions, so they needed no change.
- `e2e/scenario.json` scripts:
  - plan, compile (matched on `Compile the plan into \.blueprint/spec\.md`): writes a two-section spec (Goals, Acceptance criteria) citing `[[board:main#login]]`, then says two lines; cost 0.02.
  - plan, anything else: says one line, calls `propose` with two `add_node` ops (Login, Home) and an `add_arrow` from `$0` to `$1`, then says how to accept or refine.
  - split: two tasks, `login-page` and `home-page` (depends on `login-page`), both validated against `TaskGraph`.
  - run, anything: writes `src/login.ts`, then says a summary with `https://github.com/example/blueprint-demo/pull/1` on its own line; cost 0.05.

## TDD evidence

- Wrote `test/server/fake/sdk.test.ts` first; the first run failed because `src/server/fake/sdk.js` did not exist (`Test Files 1 failed`, import error at `createFakeSdk`).
- After implementing: 15 tests pass, covering every item in the brief's Step 1:
  - parse errors name the bad step (`plan[0].steps[1]`), a bad regex (`run[0].match`), and a non-JSON file (its path);
  - `say` streams and ends with a result at `costUsd`; results report the running total; an unmatched message ends with an error;
  - plan and run rule selection;
  - `tool` calls the handler with parsed input (default applied), and reports a thrown error, invalid input, and an unknown tool as error results;
  - `write` writes under cwd and refuses `../escape.txt`;
  - `ask` goes through canUseTool with the tool_use id and a signal, and reports allow and deny;
  - interrupt while an ask waits aborts the signal and ends with `error_during_execution`, never reaching the next step;
  - split structured output through the real `splitSpec`;
  - resume keeps the session id and `transcriptFrom(getSessionMessages(id))` shows both turns; an unknown resume throws.
  - `startServer` with a bad scenario rejects naming `run[0].steps[0]`.
  - `startServer` with a scenario, in a real git repository: logs the line, the plan session answers from the fake, the sessions route serves the in-memory transcript (the real SDK would 404), the split writes the fake's task, and a launched run writes its file in the worktree and ends `done` with the PR URL. This pins plan-section point 1 (every session uses the fake).
- `pnpm check`: pristine; 52 files, 367 tests passed.
- `pnpm build`: only the pre-existing chunk-size warning.

## Manual verification

Built with `pnpm build`, made a scratch git repository with one commit under `$TMPDIR`, and ran `BLUEPRINT_FAKE_SDK=<repo>/e2e/scenario.json node dist/cli/index.js --no-open --port 4917` there.
Drove the UI with the Playwright MCP browser (the gstack browse binary could not launch Chromium inside the sandbox, and the sandbox bypass was refused).
Screenshots are in `.superpowers/sdd/2026-11-03-m5-evidence/task-1-evidence/`.

- The server printed `Using the fake SDK from /Users/.../e2e/scenario.json` and `Blueprint running at http://localhost:4917`.
- Created board `main`, asked "Sketch the sign-in flow": the panel streamed the text, showed `proposing 3 changes`, the ghosts Login -> Home appeared with the proposals bar "Claude proposed Sign-in flow · 3 added", and the turn ended `Turn done · $0.0100 total` (`bp-ask.png`).
- Accept: the bar went away; the board file holds 5 elements tagged `origin: "ai"` and the log has the `accepted` entry.
- Compile: the panel showed the Write row and its result; `.blueprint/spec.md` held the two sections; the turn ended at `$0.0300 total` (running total).
- Spec view: "Dropped 1 citation that no longer resolves: [[board:main#login]]", because the accepted Login box has a random id (see concern 1).
  After I renamed that box's id to `login` in the board file, the spec view showed the citation without the warning (`bp-spec.png`).
- Split: "Split cost $0.0100" and two task cards, the second "Depends on: login-page", each citing `[[board:main#login]]` as a link to `#/boards/main?focus=login` (`bp-tasks.png`).
- Launch (Accept edits) on the first task: the run card read Done with a PR link and `$0.0500 total`; `.blueprint/worktrees/login-page/src/login.ts` exists on branch `blueprint/login-page` (`bp-run.png`).
- No real Claude was involved: there is no API key and no login in this environment's server, and every turn finished in milliseconds. `pgrep` and `ps` are blocked by the sandbox, so I could not list processes as extra proof.
- A bad scenario stops the CLI with exit code 1 and `The fake SDK scenario /tmp/.../bad.json is invalid: ✖ Invalid discriminator value ... → at plan[0].steps[1].do`; a missing file stops it with the resolved path and `ENOENT`.

## Files changed

- `src/server/fake/scenario.ts` (new)
- `src/server/fake/sdk.ts` (new)
- `src/server/index.ts`
- `e2e/scenario.json` (new)
- `test/server/fake/sdk.test.ts` (new)

## Self-review

- The fake ships in `dist/server/fake/` and is only loaded by the dynamic import when the variable is set.
- The `_registeredTools` access is in one helper, `toolsOf`, with a comment.
- The path check is lexical (`relative` against cwd); a symlink inside cwd that points out could still escape. The scenario is a file the user chose, so I left it at the lexical check the brief asks for.
- `tool` steps do not go through `canUseTool`. The real CLI would ask, and the agent always allows its own blueprint tools, so the result is the same; I skipped it to keep the fake small.
- PreToolUse hooks (`denyBoardWrites`) are not run for `write` steps; the scenario controls every path, so a hook would never fire in practice.
- `getSessionMessages` ignores `limit` and `offset`; no caller passes them.
- After a server restart the in-memory sessions are gone, so the plan session and runs show "previous session could not be loaded; starting fresh", which is the documented fallback.

## Concerns

1. The compile citation cannot resolve in a fresh flow. Accepted ghosts get random Excalidraw ids, so `[[board:main#login]]` is dropped unless board `main` has an element whose id is `login`.
   Task 2's `compile and split` flow needs a citation it can click, so its fixture should commit a seeded `.blueprint/boards/main.excalidraw.json` with a labelled rectangle whose id is `login` (each test gets its own repository anyway).
   The alternative is a placeholder in `write` content that the fake fills from the board, which the brief's schema does not include, so I did not add it.
2. A UI bug I saw but did not fix, because the task limits which files I can touch: after Accept, the "Login" node's label wraps to "Logi" plus "n" (stored text `"Logi\nn"`), and the stray "n" overlaps the arrow (`bp-accepted.png`). The ghost rendered "Login" on one line, so the wrap comes in on accept. This belongs in the design or backlog task.
3. The browse skill's preamble added `.gstack/` to `.gitignore` and created `.gstack/`; I reverted and removed both, so they are not in the commit.
