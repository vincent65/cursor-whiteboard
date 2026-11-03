### Task 1: Fake SDK mode

**Files:**
- Create: `src/server/fake/sdk.ts`, `src/server/fake/scenario.ts`, `e2e/scenario.json`
- Modify: `src/server/index.ts`, `src/server/agent/index.ts`, `src/server/runs/manager.ts`, `src/server/sessions.ts` (accept injected SDK functions where they do not already)
- Test: `test/server/fake/sdk.test.ts`

**Interfaces:**
- `src/server/fake/scenario.ts` defines the scenario file with Zod:

```ts
const Step = z.discriminatedUnion("do", [
  z.object({ do: z.literal("say"), text: z.string() }),
  z.object({ do: z.literal("tool"), server: z.literal("blueprint"), name: z.string(), input: z.record(z.string(), z.unknown()) }),
  z.object({ do: z.literal("write"), path: z.string(), content: z.string() }),   // relative to the session cwd
  z.object({ do: z.literal("ask"), tool: z.string(), input: z.record(z.string(), z.unknown()) }),   // goes through canUseTool
]);
const Rule = z.object({ match: z.string(), steps: z.array(Step), costUsd: z.number().default(0.01) });   // match: a regex tested against the user message
const Scenario = z.object({ plan: z.array(Rule), run: z.array(Rule), split: z.object({ tasks: z.array(z.unknown()) }) });
```

- `createFakeSdk(scenarioPath: string): { query; getSessionMessages; listSessions }` with the SDK's signatures. `query` emits an init message, then for each user message the first matching rule's steps as SDK messages (stream deltas and assistant text for `say`; a tool_use and its result for `tool`, calling the blueprint MCP server instance from `options.mcpServers.blueprint`; a Write tool_use plus the file write for `write`; `ask` awaits `options.canUseTool` and reports allow or deny), then a success result with `costUsd`. With `outputFormat` set it returns `structured_output` from `split`. Sessions are kept in memory so `getSessionMessages` and resume work within one server process; `listSessions` returns `[]`.
- `startServer` reads `process.env.BLUEPRINT_FAKE_SDK` once; when set it logs `Using the fake SDK from <path>` and passes the fake to the agent, the split, the run manager, and the sessions routes.
- `e2e/scenario.json` scripts the three flows: an ask that proposes a two-node flowchart; a compile that writes a two-section spec with one board citation; a split of two tasks; a run turn that writes one file and ends with a PR URL line.

- [ ] **Step 1: Write the failing tests** (scenario parsing errors name the bad step; a `say` rule streams text and ends with a result; a `tool` rule calls the blueprint tool and reports its result; a `write` rule writes the file under cwd and refuses paths outside it; an `ask` rule goes through canUseTool; structured output for the split; resume replays the in-memory transcript)
- [ ] **Step 2: Run them to verify they fail**
- [ ] **Step 3: Implement**, then verify by hand: `BLUEPRINT_FAKE_SDK=e2e/scenario.json node dist/cli/index.js --no-open` in a scratch repo; ask, accept, compile, split, launch, and see each step complete with no real Claude process.
- [ ] **Step 4: `pnpm check`**, pristine.
- [ ] **Step 5: Commit** `feat(server): a fake SDK mode that replays a scenario`

---

