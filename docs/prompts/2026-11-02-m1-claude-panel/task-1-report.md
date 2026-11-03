# Task 1 report: SDK dependency, sessions file, and the login spike

Status: DONE

Commit: `a18f831 feat(agent): add the Agent SDK, the sessions file, and a login spike` (no trailer).

## What I implemented

- `package.json` / `pnpm-lock.yaml`: added `@anthropic-ai/claude-agent-sdk@^0.3.316` (resolved 0.3.316) with `pnpm add`.
  `node -e "import('@anthropic-ai/claude-agent-sdk').then(m => console.log(typeof m.query))"` printed `function`.
- `src/shared/types.ts`: `RunStatus`, `RunRecord`, `SessionsFile`, exactly as the brief specifies (formatted by Biome).
- `src/server/files.ts`:
  - `SessionsSchema: z.ZodType<SessionsFile>`, a Zod schema mirroring the type; the annotation makes `tsc` fail if a required field drifts between the two.
  - `readSessions()`: a missing file (ENOENT) returns `{ plan: null, runs: [] }`; any other read error, a JSON syntax error, or a wrong shape rejects with the underlying error (`SyntaxError` / `ZodError`).
  - `writeSessions(s)`: writes `JSON.stringify(s, null, 2) + "\n"` to `.blueprint/sessions.json` through the existing atomic `write` helper.
  - A private `sessionsPath()` helper beside `boardPath` / `docPath`.
- `scripts/sdk-check.mjs`: runs one `query` with `cwd: process.cwd()`, `maxTurns: 1`, `allowedTools: []`, prompt `Reply with the single word ready.`.
  Prints `apiKeySource`, `claude_code_version`, and `model` from the init message, then the result text.
  Exits 1 if no result arrives within 120 seconds, or if the query ends without a result.
  It also exits 1 when the result is an error result (`is_error`), which the brief did not ask for but makes a failed spike visible in the exit code.
  No API key is set or read.
- `test/server/files.test.ts`: the two tests from the brief.

## TDD evidence

RED: `pnpm vitest run test/server/files.test.ts -t sessions`

```
 FAIL  test/server/files.test.ts > a corrupt sessions file is reported, not silently replaced
TypeError: store.readSessions is not a function
 ❯ test/server/files.test.ts:294:22
...
 Test Files  1 failed (1)
      Tests  2 failed | 11 skipped (13)
```

(Both tests failed with `store.readSessions is not a function`.)

GREEN: `pnpm vitest run test/server/files.test.ts`

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

`pnpm check` (tsc x2, biome, vitest), run once before committing after one Biome format fix to the spike script:

```
Checked 52 files in 25ms. No fixes applied.
 Test Files  14 passed (14)
      Tests  64 passed (64)
```

Exit 0, no warnings or errors in the output.

## Spike output

`node scripts/sdk-check.mjs` (with `api.anthropic.com` reachable):

```
apiKeySource: none
claude_code_version: 2.1.316
model: claude-opus-5-5
result (success): ready
exit: 0
```

The first run inside my sandbox could not reach `api.anthropic.com`, which my sandbox blocked, and timed out:

```
apiKeySource: none
claude_code_version: 2.1.316
model: claude-opus-5-5
no result within 120 seconds
exit: 1
```

That was my sandbox's network policy, not an authentication problem; the re-run above with the host allowed succeeded.

## Files changed

- `package.json`
- `pnpm-lock.yaml`
- `src/shared/types.ts`
- `src/server/files.ts`
- `scripts/sdk-check.mjs` (new)
- `test/server/files.test.ts`

## Self-review findings

- Deviation from the verbatim tests: each test starts with `await store.init()`.
  Without it `.blueprint/` does not exist, so the corrupt-file test's own `writeFile` throws ENOENT, and `writeSessions` fails the same way.
  Every other store test calls `init()` first, and `writeSessions` matches the other writers, which also assume `init()` ran.
- I did not wrap the corrupt-file and wrong-shape errors in a domain error class.
  Later tasks that call `readSessions` must handle `SyntaxError` / `ZodError`, for example by showing the error instead of overwriting the file.
- `z.object` strips unknown keys on read, so a field that a future version adds would be dropped on the next read-modify-write.
  This is acceptable for now.

## Concerns

- The spike did not set `settingSources`, so the SDK loaded the user's own Claude Code settings: it tried to reach `mcp.context7.com`, `mcp-proxy.anthropic.com`, and `registry.npmjs.org`, which means user MCP servers and plugins started.
  Later tasks that embed the SDK in the server should decide deliberately which setting sources and MCP servers a Blueprint session loads.
- Environment note: `pnpm add` inside my sandbox could not write the global pnpm store and fell back to a project-local `.pnpm-store/`.
  I re-ran it outside the sandbox against the global store and deleted the stray `.pnpm-store/` directory; nothing from it was committed.
- `pnpm add` printed existing peer-dependency warnings (radix vs React 19) and "Ignored build scripts: esbuild"; both were present before this task.
