import { prUrlIn, runPrompt } from "../../../src/server/runs/prompt.js";
import type { Task } from "../../../src/shared/tasks.js";

const task: Task = {
  slug: "auth-api",
  title: "Auth API",
  body: "Add the login route.",
  dependsOn: ["db", "config"],
  files: ["src/auth.ts", "test/auth.test.ts"],
  acceptance: ["login returns a token", "bad passwords get 401"],
  sources: [],
};

test("runPrompt carries the task, the spec, the branch, and the definition of done", () => {
  const prompt = runPrompt({
    task,
    taskFile: ".blueprint/tasks/02-auth-api.md",
    spec: "## Goals\n- ship",
    branch: "blueprint/auth-api",
  });
  expect(
    prompt,
  ).toBe(`You are implementing one task of a plan in this worktree, on branch blueprint/auth-api.

## Task (.blueprint/tasks/02-auth-api.md)
Add the login route.

Depends on: db, config
Files likely touched: src/auth.ts, test/auth.test.ts
Acceptance:
- login returns a token
- bad passwords get 401

## Specification
## Goals
- ship

## Definition of done
1. Implement the task with tests where the project has them; keep the existing checks green.
2. Commit with clear conventional commit messages on this branch.
3. Push the branch and open a pull request with \`gh pr create\` if \`gh\` is installed and authenticated; if it is not, say so and stop after pushing or committing.
4. Print the pull request URL on its own line, then summarize what you did and anything left open.`);
  for (const heading of [
    "## Task (",
    "## Specification",
    "## Definition of done",
  ])
    expect(prompt).toContain(heading);
  expect(prompt).toContain("open a pull request with `gh pr create`");
});

test("runPrompt says nothing, unknown, and none listed when a task has no dependencies, files, or acceptance", () => {
  const prompt = runPrompt({
    task: { ...task, dependsOn: [], files: [], acceptance: [] },
    taskFile: "t.md",
    spec: "",
    branch: "b",
  });
  expect(prompt).toContain(
    "Depends on: nothing\nFiles likely touched: unknown\nAcceptance:\n- none listed; use the task description and the specification\n\n## Specification",
  );
});

test("prUrlIn finds a PR URL on its own line and ignores inline mentions", () => {
  expect(prUrlIn("Done.\nhttps://github.com/a/b/pull/12\nSummary")).toBe(
    "https://github.com/a/b/pull/12",
  );
  expect(prUrlIn("see https://github.com/a/b/pull/12 for details")).toBeNull();
  expect(prUrlIn("https://github.com/a/b/issues/3")).toBeNull();
});

test("prUrlIn allows surrounding whitespace and takes the first URL line", () => {
  expect(
    prUrlIn(
      "  https://github.com/o/r/pull/7  \r\nhttps://github.com/o/r/pull/8",
    ),
  ).toBe("https://github.com/o/r/pull/7");
  expect(prUrlIn("https://github.com/o/r/pull/7/files")).toBeNull();
  expect(prUrlIn("")).toBeNull();
});
