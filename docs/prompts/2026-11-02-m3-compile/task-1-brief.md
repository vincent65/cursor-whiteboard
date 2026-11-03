### Task 1: Task schema, frontmatter, and ordering

**Files:**
- Create: `src/shared/tasks.ts`
- Test: `test/shared/tasks.test.ts`

**Interfaces:**
- Produces in `src/shared/tasks.ts`:

```ts
import { z } from "zod";
export const Task = z.object({
  slug: z.string().regex(SLUG_RE), title: z.string().min(1), body: z.string(),
  dependsOn: z.array(z.string()), files: z.array(z.string()), acceptance: z.array(z.string()),
  sources: z.array(z.string()),
});
export type Task = z.infer<typeof Task>;
export const TaskGraph = z.object({ tasks: z.array(Task).min(1) });
export type TaskGraph = z.infer<typeof TaskGraph>;
export type TaskFile = { file: string; task: Task };           // file is "<nn>-<slug>.md"
export function orderTasks(tasks: Task[]): Task[];             // stable topological order; throws Error("duplicate task slug <s>"), Error("task <s> depends on unknown task <t>"), or Error("tasks <a> and <b> depend on each other") naming the first problem found
export function taskFileName(index: number, slug: string): string;   // "01-auth.md"
export function taskToMarkdown(task: Task): string;            // frontmatter with JSON values for title, dependsOn, files, acceptance, sources; then a blank line and the body
export function taskFromMarkdown(text: string): Task;          // throws Error("task frontmatter: <reason>") on a missing fence or a line that is not `key: <json>`
```

- [ ] **Step 1: Write the failing tests**

```ts
test("orderTasks sorts by dependencies and keeps the given order otherwise", () => {
  const t = (slug: string, dependsOn: string[] = []) => ({ slug, title: slug, body: "", dependsOn, files: [], acceptance: [], sources: [] });
  expect(orderTasks([t("c", ["a"]), t("a"), t("b")]).map((x) => x.slug)).toEqual(["a", "c", "b"]);
});
test("orderTasks rejects cycles, duplicates, and unknown dependencies by name", () => {
  expect(() => orderTasks([t("a", ["b"]), t("b", ["a"])])).toThrow("depend on each other");
  expect(() => orderTasks([t("a"), t("a")])).toThrow("duplicate task slug a");
  expect(() => orderTasks([t("a", ["zz"])])).toThrow("depends on unknown task zz");
});
test("a task round-trips through Markdown with JSON frontmatter", () => {
  const task = { slug: "auth", title: "Auth: cookies & \"sessions\"", body: "## Why\n\nText with [[board:main#e1]].\n", dependsOn: ["db"], files: ["src/a.ts"], acceptance: ["login sets a cookie"], sources: ["[[board:main#e1]]"] };
  const md = taskToMarkdown(task);
  expect(md.startsWith('---\ntitle: "Auth: cookies & \\"sessions\\""\n')).toBe(true);
  expect(taskFromMarkdown(md)).toEqual(task);
  expect(taskFileName(0, "auth")).toBe("01-auth.md");
});
test("taskFromMarkdown names what is wrong", () => {
  expect(() => taskFromMarkdown("no fence")).toThrow("task frontmatter");
  expect(() => taskFromMarkdown("---\ntitle: not json\n---\n")).toThrow("task frontmatter");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run test/shared/tasks.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

The slug comes from the file name on read (`taskFromMarkdown` is given the text only; `FileStore` fills `slug` from the file name in Task 2, so `taskFromMarkdown` reads `slug` from the frontmatter when present and `taskToMarkdown` writes it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run test/shared/tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/tasks.ts test/shared/tasks.test.ts
git commit -m "feat(tasks): task schema, ordering, and Markdown frontmatter"
```

---

