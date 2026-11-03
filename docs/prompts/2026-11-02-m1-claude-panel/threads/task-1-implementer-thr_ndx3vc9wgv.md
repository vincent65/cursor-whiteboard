### Spec Compliance
- Spec compliant. All seven brief steps are in the diff: the dependency (`package.json:31` in the diff), the three types (`src/shared/types.ts:16-38`), `readSessions` and `writeSessions` (`src/server/files.ts:238-251`), the Zod schema (`src/server/files.ts:46-68`), the spike script (`scripts/sdk-check.mjs`), and both listed tests (`test/server/files.test.ts:278-295`). The commit message matches the brief and has no trailer.
- The `Interfaces` block matches exactly. I checked every field name, nullability, the six `RunStatus` literals, and both method signatures.
- Deviation, accepted: both tests call `await store.init()` first. Without it the `.blueprint/` directory does not exist, so the brief's verbatim corrupt-file test would throw ENOENT inside its own `writeFile`. The assertions themselves are unchanged.
- Extra: the spike exits 1 on an `is_error` result (`scripts/sdk-check.mjs:23`). It is small and makes a failed spike show up in the exit code. Acceptable.
- Lockfile churn: besides the SDK packages, the `vitest` and `jest-dom` peer keys gained `@opentelemetry/api@1.10.0`. That is a normal side effect of `pnpm add` and needs no action.
- Cannot verify from the diff: the spike output (`apiKeySource: none`, version, model, `ready`), the RED/GREEN runs, and that `pnpm check` is clean. These rest on the report only. The evidence is present and not truncated.
- Checked outside the diff, risk "sessions.json should be gitignored": `docs/build-plan.md:100` says `sessions.json` is committed. Not adding it to `GITIGNORE_LINES` is correct.
- Checked outside the diff, risk "write helper is not atomic": `src/server/files.ts:290-300` writes a temp file and then renames it, so `writeSessions` is atomic.

### Strengths
- `readSessions` only treats ENOENT as "missing". Every other read error, bad JSON, and a wrong shape all reject, so a corrupt file is never silently replaced with defaults (`src/server/files.ts:239-246`).
- It reuses the existing atomic `write` helper and adds a small private `sessionsPath()` next to `boardPath` / `docPath`. This matches the file's existing pattern.
- `writeSessions` writes pretty JSON with a trailing newline, which gives clean diffs for a committed file.
- The spike is minimal, uses no API key, clears its timer, and handles the case where the query ends without a result.
- The report is candid: it calls out the sandbox network failure, that user MCP servers and plugins start because `settingSources` is left at its default, and that unknown keys are stripped on read.

### Issues
#### Critical (Must Fix)
None.

#### Important (Should Fix)
None.

#### Minor (Nice to Have)
- The schema and the type can drift without a compile error (`src/server/files.ts:46` and `src/shared/types.ts:16-22`).
  - The `z.ZodType<SessionsFile>` annotation only checks that what the schema produces fits `SessionsFile`. It does not check the reverse.
  - Example: if someone adds a status such as `"queued"` to `RunStatus` but not to the `z.enum`, `tsc` still passes.
  - The app would then write a file that its own `readSessions` rejects.
  - The report says the annotation "makes `tsc` fail if a required field drifts". That only holds for adding required fields.
  - Fix: one line, `const _check: z.infer<typeof SessionsSchema> extends SessionsFile ? (SessionsFile extends z.infer<typeof SessionsSchema> ? true : never) : never = true;` or similar. Alternatively, keep the status literals in a shared `as const` array.
- The tests never exercise the run record part of the schema (`test/server/files.test.ts:281-284`).
  - The round-trip only uses `runs: []`.
  - Nothing tests a run record with `prUrl: null` or `endedAt: null`, or a wrong shape that is still valid JSON.
  - Step 4 of the brief says a wrong shape must throw, but only invalid JSON is tested.
  - Fix: add one populated `RunRecord` to the round-trip, and one test where valid JSON with the wrong shape (for example `{"plan":null}`) rejects.
- `z.object` strips unknown keys on read (`src/server/files.ts:46`). A field written by a newer version would be lost on the next read-modify-write. The report already notes this. `z.looseObject` would keep those keys if later versions need it.
- In the spike, `allowedTools: []` (`scripts/sdk-check.mjs:12`) does not stop tools from being available. It is only an auto-approve list. With `maxTurns: 1` this does no harm, and the brief requires it, so this is a note for later tasks rather than a fix here.

### Assessment
Task quality: Approved

Reasoning: Everything in the brief and its `Interfaces` block is implemented to the letter. The error handling is correct, and the one deviation from the verbatim tests is justified. The remaining items are small hardening: the schema and type can drift in one direction, and the tests do not cover run records.
