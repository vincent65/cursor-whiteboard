import { z } from "zod";
import { SLUG_RE } from "./slug.js";

// One implementation task, as the split returns it and as a task file holds it.
export const Task = z.object({
  slug: z.string().regex(SLUG_RE),
  title: z.string().min(1),
  body: z.string(),
  dependsOn: z.array(z.string()),
  files: z.array(z.string()),
  acceptance: z.array(z.string()),
  sources: z.array(z.string()),
});
export type Task = z.infer<typeof Task>;

export const TaskGraph = z.object({ tasks: z.array(Task).min(1) });
export type TaskGraph = z.infer<typeof TaskGraph>;

// file is "<nn>-<slug>.md".
export type TaskFile = { file: string; task: Task };

// Dependencies first; among tasks that are ready, the earliest given goes
// first. Throws naming the first duplicate, unknown dependency, or cycle.
// ponytail: O(n^2) rescans, fine for the dozen tasks a split returns.
export function orderTasks(tasks: Task[]): Task[] {
  const slugs = new Set<string>();
  for (const task of tasks) {
    if (slugs.has(task.slug))
      throw new Error(`duplicate task slug ${task.slug}`);
    slugs.add(task.slug);
  }
  for (const task of tasks)
    for (const dep of task.dependsOn)
      if (!slugs.has(dep))
        throw new Error(`task ${task.slug} depends on unknown task ${dep}`);

  const placed = new Set<string>();
  const ordered: Task[] = [];
  while (ordered.length < tasks.length) {
    const next = tasks.find(
      (task) =>
        !placed.has(task.slug) && task.dependsOn.every((d) => placed.has(d)),
    );
    if (!next) throw new Error(cycleMessage(tasks, placed));
    placed.add(next.slug);
    ordered.push(next);
  }
  return ordered;
}

// Every unplaced task waits on another unplaced one, so following those
// waits from any of them must come back around; name two tasks on the loop.
function cycleMessage(tasks: Task[], placed: Set<string>): string {
  const waitsOn = new Map<string, string>();
  for (const task of tasks) {
    const dep = task.dependsOn.find((d) => !placed.has(d));
    if (dep !== undefined) waitsOn.set(task.slug, dep);
  }
  const seen = new Set<string>();
  let last = "";
  let slug = waitsOn.keys().next().value ?? "";
  while (!seen.has(slug)) {
    seen.add(slug);
    last = slug;
    slug = waitsOn.get(slug) ?? "";
  }
  return `tasks ${slug} and ${last} depend on each other`;
}

export const taskFileName = (index: number, slug: string): string =>
  `${String(index + 1).padStart(2, "0")}-${slug}.md`;

const KEYS = [
  "title",
  "slug",
  "dependsOn",
  "files",
  "acceptance",
  "sources",
] as const;

// Each frontmatter value is a JSON literal, which is also valid YAML.
export function taskToMarkdown(task: Task): string {
  const lines = KEYS.map((key) => `${key}: ${JSON.stringify(task[key])}`);
  return `---\n${lines.join("\n")}\n---\n\n${task.body}`;
}

export function taskFromMarkdown(text: string): Task {
  const fail = (reason: string) => new Error(`task frontmatter: ${reason}`);
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1)
    throw fail("expected a block between --- lines");
  const fields = Object.fromEntries(
    lines.slice(1, end).map((line) => {
      const match = /^(\w+): (.*)$/.exec(line);
      try {
        if (match) return [match[1], JSON.parse(match[2])];
      } catch {
        // falls through to the error below
      }
      throw fail(`not a \`key: <json>\` line: ${line}`);
    }),
  );
  const rest = lines.slice(end + 1);
  if (rest[0] === "") rest.shift();
  const result = Task.safeParse({ ...fields, body: rest.join("\n") });
  if (!result.success) {
    const issue = result.error.issues[0];
    throw fail(`${issue.path.join(".")}: ${issue.message}`);
  }
  return result.data;
}
