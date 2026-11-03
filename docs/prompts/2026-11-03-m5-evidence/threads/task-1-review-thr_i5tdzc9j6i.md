I've finished checking the diff against the brief and a few nearby files. Here is the review.

### Spec Compliance
- **Spec compliant.** Every item in the brief's Interfaces section and every Step 1 test is in the diff:
  - **Scenario schema:** matches the brief verbatim (`src/server/fake/scenario.ts:123-150`).
  - **`createFakeSdk` messages:** it emits an init message, then for each user message the first matching rule's steps (`src/server/fake/sdk.ts:431-476`).
  - **`say`:** stream deltas plus the assistant text (`sdk.ts:303-326`).
  - **`tool`:** calls the tool through `options.mcpServers.blueprint` (`sdk.ts:328-348`).
  - **`write`:** a Write tool_use, the file write, and a refusal for paths outside cwd (`sdk.ts:350-361`).
  - **`ask`:** goes through `canUseTool` and reports allow or deny (`sdk.ts:363-397`).
  - **Split:** `structured_output` comes from `split` (`sdk.ts:440-447`).
  - **Sessions:** kept in memory, and `listSessions` returns `[]` (`sdk.ts:491-495`).
  - **`startServer`:** `loadSdk` reads `BLUEPRINT_FAKE_SDK`, logs the line, and passes the fake to the agent, the split (through `createAgent`), `RunManager`, and the sessions routes (`src/server/index.ts:514-556`). With the variable unset it returns `claudeSdk`, so behaviour is unchanged.
- **Brief's Step 1 tests, all present:**
  - Parse error names the step: `test/server/fake/sdk.test.ts:652`
  - `say` streams and ends with a result: `:677`
  - `tool` calls the blueprint tool: `:743`
  - `write` writes under cwd and refuses outside it: `:809`
  - `ask` goes through canUseTool: `:842`
  - Split structured output, through the real `splitSpec`: `:896`
  - Resume replays the transcript, through the real `transcriptFrom`: `:904`
- **Brief's listed modifications to `agent/index.ts`, `runs/manager.ts`, `sessions.ts`:** not needed, and the report's claim holds. I checked `src/server/agent/index.ts:74-79,134,302`: `createAgent` already takes `deps.sdk` and passes `sdk.query` to both the plan session and `splitSpec`.
- **`e2e/scenario.json` flows:**
  - Ask proposes two nodes and one arrow (`e2e/scenario.json:38-59`).
  - Compile writes two sections with one citation (`:24-36`).
  - Split has two tasks (`:79-100`).
  - Run writes one file, then a URL line and a summary (`:62-78`).
  - The run text puts the URL on its own line and then summarizes, so the URL is not the last line. That matches what the real run prompt asks for (`src/server/runs/prompt.ts:33`, "Print the pull request URL on its own line, then summarize"), and `prUrlIn` finds the first URL-only line. I treat this as compliant.
- **Extra:** the `isRegExp` refine on `match` (`scenario.ts:142`). It is small and makes bad regexes fail at load time with a path. Acceptable.
- **Cannot verify from the diff:** the claims that `pnpm check` is pristine (367 tests) and that `pnpm build` warns only about chunk size. Also the manual run of the CLI. I relied on the report for these; the screenshots are in `task-1-evidence/` and I did not open them.

### Strengths
- **Tests use real code, not mocks.** They go through `SdkEventMapper`, `transcriptFrom`, `splitSpec`, a real `createSdkMcpServer`, and a full `startServer` in a real git repo (`sdk.test.ts:956-1037`). That last test shows every one of the four injection points uses the fake, which a unit test alone could not.
- **The fake behaves like the real SDK where it matters:**
  - `total_cost_usd` is the query's running total (`sdk.ts:264,473`), which the run manager relies on.
  - An unknown `resume` throws `No conversation found with session ID` before init (`sdk.ts:252-253`), which PlanSession already handles.
  - The tool input goes through the tool's schema, so defaults apply (`sdk.ts:335-341`).
  - An interrupt saves `[Request interrupted by user]` (`sdk.ts:470`).
- **Interrupt and close are handled correctly.** Interrupt races the abort signal against `canUseTool` (`sdk.ts:373-393`), and the interrupt test proves the next step never runs. The only Query methods consumers call are `interrupt` and `close` (I checked `session.ts:225,272` and `manager.ts:137,208`), so the partial `Query` cast is safe. `close()` cannot hang the `for await`, because `#stopRun` calls `input.end()` before `query.close()` (`session.ts:270-271`).
- **Fails early and only loads when asked for.** `loadSdk` runs before the store initializes, so a bad scenario stops the server before any side effects. The fake is loaded only by the dynamic import.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
1. **The scenario's citation does not resolve in a natural ask, accept, compile flow** (`e2e/scenario.json:29,88,97`).
   - `[[board:main#login]]` needs an element whose id is `login`.
   - Accepted ghosts get random ids, and `add_node` cannot set an id (`src/shared/proposals.ts:25-30`).
   - So the spec view shows "Dropped 1 citation", and the split tasks' sources point at nothing.
   - The report names this (concern 1). Task 2's fixture must seed `.blueprint/boards/main.excalidraw.json` with a rectangle whose id is `login`, or its evidence screenshots will show the warning. Carry this into the Task 2 brief.
2. **`toolsOf` reaches into the private `_registeredTools` field** (`sdk.ts:221-228`).
   - If an SDK upgrade renames the field, `toolsOf(...)` returns `undefined`. Then `[name]` throws a TypeError at `sdk.ts:332`, outside `callTool`'s try, and the whole query fails instead of returning a tool error.
   - The `tool` test would catch the rename, so this fails loudly, but guarding with `?? {}` would turn it into an error result instead of a crash.
3. **Small ordering and type differences:**
   - `say` sends the assistant message before `content_block_stop` (`sdk.ts:321-325`), while the real SDK sends it after the block closes.
   - The events test (`sdk.test.ts:690-696`) and the manual run show the panel handles this order, so there is no visible effect today.
   - `loadSdk`'s return type (`index.ts:514-516`) repeats `FakeSdk` (`sdk.ts:196-200`). This is harmless.
4. **UI bug left unfixed.** The report's concern 2 is real by its own evidence: after Accept, the Login label wraps to `"Logi\nn"` and the stray "n" overlaps the arrow (`bp-accepted.png`). It was not fixed because it is outside this task's files. It needs an owner (the design or backlog task), not just a mention in a report.

### Assessment
Task quality: Approved
Reasoning: The fake follows the brief's interface and the real SDK's behaviour where callers depend on it, and the tests use the real code, ending in a full server test. The open items are the citation fixture and the label-wrap bug; both are documented and belong in Task 2 and the backlog.
