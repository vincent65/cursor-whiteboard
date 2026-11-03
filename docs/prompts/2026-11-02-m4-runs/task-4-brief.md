### Task 4: Gating, run routes, and server wiring

**Files:**
- Create: `src/server/runs/gate.ts`, `src/server/runRoutes.ts`
- Modify: `src/server/app.ts`, `src/server/index.ts`
- Test: `test/server/runs/gate.test.ts`, `test/server/runRoutes.test.ts`

**Interfaces:**
- Produces in `src/server/runs/gate.ts`:

```ts
export type GateResult = { ok: boolean; missing: { slug: string; reason: "no run" | "not done" | "not merged" }[] };
export async function checkGate(input: { task: Task; runs: RunRecord[]; isAncestor: (branch: string) => Promise<boolean> }): Promise<GateResult>;
```

- Produces in `src/server/runRoutes.ts`, mounted at `/api/runs`: `GET /` → `RunView[]`; `GET /gate/:slug` → `GateResult` (404 unknown task); `POST /` body `{ taskSlug, permissionMode, override?: boolean }` → 201 `RunRecord`, 409 `{ error, missing }` when the gate fails and `override` is not true, 404 unknown task, 400 bad body; `POST /:id/message { text }` → 202 `{ id }`; `POST /:id/stop` → 204; `POST /:id/resume` → 204 (409 unless interrupted); `POST /:id/permission` → 204 / 404; `GET /:id/transcript` → `PanelEvent[]`.
- `createApp(store, agent?, runs?)` mounts the routes when a manager is given; `startServer` builds `RunStore` (load, with the corrupt-file handling from milestone 1 kept: the agent reports it and runs start empty), `RunManager`, calls `start()`, and closes it in `close()`.

- [ ] **Step 1: Write the failing tests**

```ts
test("checkGate reports each missing dependency with its reason", ...);   // no run, a failed run, a done run not merged, a done merged run → ok
test("POST /api/runs refuses a gated task without override and launches with it", ...);
test("run routes forward message, stop, resume, permission, and transcript with the right codes", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm check`
Expected: pristine.

- [ ] **Step 5: Commit**

```bash
git add src/server/runs/gate.ts src/server/runRoutes.ts src/server/app.ts src/server/index.ts test/server/runs/gate.test.ts test/server/runRoutes.test.ts
git commit -m "feat(server): dependency gate, run routes, and run manager wiring"
```

---

