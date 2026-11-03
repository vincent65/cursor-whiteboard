import {
  orderTasks,
  taskFileName,
  taskFromMarkdown,
  taskToMarkdown,
} from "../../src/shared/tasks.js";

const t = (slug: string, dependsOn: string[] = []) => ({
  slug,
  title: slug,
  body: "",
  dependsOn,
  files: [],
  acceptance: [],
  sources: [],
});

test("orderTasks sorts by dependencies and keeps the given order otherwise", () => {
  expect(
    orderTasks([t("c", ["a"]), t("a"), t("b")]).map((x) => x.slug),
  ).toEqual(["a", "c", "b"]);
});

test("orderTasks rejects cycles, duplicates, and unknown dependencies by name", () => {
  expect(() => orderTasks([t("a", ["b"]), t("b", ["a"])])).toThrow(
    "depend on each other",
  );
  expect(() => orderTasks([t("a"), t("a")])).toThrow("duplicate task slug a");
  expect(() => orderTasks([t("a", ["zz"])])).toThrow(
    "depends on unknown task zz",
  );
});

test("a task round-trips through Markdown with JSON frontmatter", () => {
  const task = {
    slug: "auth",
    title: 'Auth: cookies & "sessions"',
    body: "## Why\n\nText with [[board:main#e1]].\n",
    dependsOn: ["db"],
    files: ["src/a.ts"],
    acceptance: ["login sets a cookie"],
    sources: ["[[board:main#e1]]"],
  };
  const md = taskToMarkdown(task);
  expect(md.startsWith('---\ntitle: "Auth: cookies & \\"sessions\\""\n')).toBe(
    true,
  );
  expect(taskFromMarkdown(md)).toEqual(task);
  expect(taskFileName(0, "auth")).toBe("01-auth.md");
});

test("taskFromMarkdown names what is wrong", () => {
  expect(() => taskFromMarkdown("no fence")).toThrow("task frontmatter");
  expect(() => taskFromMarkdown("---\ntitle: not json\n---\n")).toThrow(
    "task frontmatter",
  );
  const noSlug = taskToMarkdown(t("a")).replace('slug: "a"\n', "");
  expect(() => taskFromMarkdown(noSlug)).toThrow("task frontmatter");
});
