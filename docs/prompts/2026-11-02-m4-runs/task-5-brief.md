### Task 5: Other sessions in the repository

**Files:**
- Create: `src/server/sessions.ts`
- Modify: `src/server/agent/session.ts` (extract the transcript builder), `src/server/runRoutes.ts` or `src/server/routes.ts`
- Test: `test/server/sessions.test.ts`

**Interfaces:**
- Produces in `src/server/agent/session.ts`: `export function transcriptFrom(messages: SessionMessage[]): PanelEvent[]` (the loop `restore()` runs, so both share it).
- Produces in `src/server/sessions.ts`:

```ts
export type OtherSession = { sessionId: string; summary: string; lastModified: number; cwd: string | null; gitBranch: string | null };
export async function listOtherSessions(deps: { listSessions: typeof listSessions; root: string; exclude: Set<string> }): Promise<OtherSession[]>;
   // listSessions({ dir: root, includeWorktrees: true }) minus the plan session and every run's session id, newest first
```

- Routes: `GET /api/sessions` → `OtherSession[]`; `GET /api/sessions/:id/transcript` → `PanelEvent[]` via `getSessionMessages` and `transcriptFrom` (404 when empty).

- [ ] **Step 1: Write the failing tests**

```ts
test("listOtherSessions excludes Blueprint's own sessions and sorts newest first", ...);
test("GET /api/sessions/:id/transcript maps a saved session and 404s an unknown one", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/server/sessions.ts src/server/agent/session.ts src/server/runRoutes.ts src/server/routes.ts test/server/sessions.test.ts test/server/agent/session.test.ts
git commit -m "feat(server): list the repository's other Claude sessions with read-only transcripts"
```

---

