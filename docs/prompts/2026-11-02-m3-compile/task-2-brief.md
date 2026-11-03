### Task 2: Spec and task files in the store, served with cleaned citations

**Files:**
- Modify: `src/server/files.ts`, `src/server/routes.ts`
- Test: `test/server/files.test.ts`, `test/server/routes.test.ts`

**Interfaces:**
- Consumes: Task 1; `buildCitationIndex`, `dropUnknownCitations`, `excalidrawToBoardGraph` from the export module.
- Produces on `FileStore`: `readSpec(): Promise<string | null>` (null when `.blueprint/spec.md` is missing); `listTasks(): Promise<TaskFile[]>` (files sorted by name, each parsed, a bad file throws with its name); `replaceTasks(tasks: Task[]): Promise<TaskFile[]>` (orders with `orderTasks`, deletes every `*.md` in `tasks/`, writes the new files atomically, returns them); `citationIndex(): Promise<Set<string>>` (over every board and doc).
- Produces in `src/server/routes.ts`: `GET /api/spec` → `{ text: string | null, dropped: Citation[] }` with unknown citations removed from `text`; `GET /api/tasks` → `TaskFile[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// files.test.ts
test("spec is null until written, then read back", ...);
test("replaceTasks writes numbered files in dependency order and removes old ones", async () => {
  await writeFile(join(store.dir, "tasks", "99-old.md"), "stale");
  const files = await store.replaceTasks([t("c", ["a"]), t("a")]);
  expect(files.map((f) => f.file)).toEqual(["01-a.md", "02-c.md"]);
  expect(await readdir(join(store.dir, "tasks"))).toEqual(["01-a.md", "02-c.md"]);
  expect((await store.listTasks())[1].task.dependsOn).toEqual(["a"]);
});
test("replaceTasks with a cycle changes nothing", ...);   // old file still there, rejects "depend on each other"
test("citationIndex covers board elements and doc headings", ...);
// routes.test.ts
test("GET /api/spec drops unknown citations and reports them", async () => {
  // board main has element e1; spec text cites [[board:main#e1]] and [[board:main#gone]]
  // → text keeps the first, loses the second; dropped has one entry with id "gone"
});
test("GET /api/tasks lists parsed task files", ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/server/files.test.ts test/server/routes.test.ts -t "spec|tasks|citation"`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/files.ts src/server/routes.ts test/server/files.test.ts test/server/routes.test.ts
git commit -m "feat(server): spec and task files, served with unknown citations dropped"
```

---

