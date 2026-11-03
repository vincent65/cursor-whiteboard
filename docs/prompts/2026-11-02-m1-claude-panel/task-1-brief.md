### Task 1: SDK dependency, sessions file, and the login spike

**Files:**
- Modify: `package.json` (dependency), `src/shared/types.ts`, `src/server/files.ts`
- Create: `scripts/sdk-check.mjs`
- Test: `test/server/files.test.ts`

**Interfaces:**
- Produces in `src/shared/types.ts`:

```ts
export type RunStatus = "working" | "needs_you" | "idle" | "done" | "failed" | "interrupted";
export type RunRecord = {
  id: string; taskSlug: string; sessionId: string; worktree: string; branch: string;
  status: RunStatus; prUrl: string | null; costUsd: number; startedAt: string; endedAt: string | null;
};
export type SessionsFile = { plan: { sessionId: string; updatedAt: string } | null; runs: RunRecord[] };
```

- Produces on `FileStore`: `readSessions(): Promise<SessionsFile>` (a missing file is `{ plan: null, runs: [] }`) and `writeSessions(s: SessionsFile): Promise<void>` (atomic, pretty JSON at `.blueprint/sessions.json`).

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @anthropic-ai/claude-agent-sdk@^0.3.316`
Expected: the package and its platform binary optional dependency install; `node -e "import('@anthropic-ai/claude-agent-sdk').then(m => console.log(typeof m.query))"` prints `function`.

- [ ] **Step 2: Write the failing tests**

```ts
test("sessions file round-trips and defaults when missing", async () => {
  expect(await store.readSessions()).toEqual({ plan: null, runs: [] });
  const s = { plan: { sessionId: "abc", updatedAt: "2026-11-02T00:00:00.000Z" }, runs: [] };
  await store.writeSessions(s);
  expect(await store.readSessions()).toEqual(s);
  expect(JSON.parse(await readFile(join(store.dir, "sessions.json"), "utf8"))).toEqual(s);
});
test("a corrupt sessions file is reported, not silently replaced", async () => {
  await writeFile(join(store.dir, "sessions.json"), "{not json");
  await expect(store.readSessions()).rejects.toThrow();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/files.test.ts -t sessions`
Expected: FAIL, `readSessions is not a function`.

- [ ] **Step 4: Implement the types and the two methods**

Add the types to `src/shared/types.ts`; implement the methods in `src/server/files.ts` using the existing atomic `write` helper and a Zod schema for `SessionsFile` so a wrong shape throws.

- [ ] **Step 5: Write the spike script**

`scripts/sdk-check.mjs` runs one query from the current directory with `maxTurns: 1`, `allowedTools: []`, and the prompt `Reply with the single word ready.`, prints the init message's `apiKeySource`, `claude_code_version`, and `model`, prints the result text, and exits 1 if no result message arrives within 120 seconds. It is run by hand, never by tests.

- [ ] **Step 6: Run the tests and the spike**

Run: `pnpm vitest run test/server/files.test.ts && node scripts/sdk-check.mjs`
Expected: tests PASS; the spike prints `apiKeySource: none` (the claude.ai login), a version, a model, and a result containing `ready`. Record the exact output in the report; if it fails with an authentication error, report BLOCKED with the output.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/types.ts src/server/files.ts scripts/sdk-check.mjs test/server/files.test.ts
git commit -m "feat(agent): add the Agent SDK, the sessions file, and a login spike"
```

---

