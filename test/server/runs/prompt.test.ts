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
1. Create and edit files with the Write and Edit tools, not shell redirection.
2. Implement the task with tests where the project has them; keep the existing checks green.
3. Commit with clear conventional commit messages on this branch.
4. Push the branch and open a pull request with \`gh pr create\` if \`gh\` is installed and authenticated; if it is not, say so and stop after pushing or committing.
5. Print the pull request URL on its own line, then summarize what you did and anything left open.`);
  for (const heading of [
    "## Task (",
    "## Specification",
    "## Definition of done",
  ])
    expect(prompt).toContain(heading);
  expect(prompt).toContain("open a pull request with `gh pr create`");
  // Shell redirection makes acceptEdits ask; the edit tools do not.
  expect(prompt).toContain(
    "1. Create and edit files with the Write and Edit tools, not shell redirection.",
  );
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

test("prUrlIn finds a PR URL on its own line before any inline mention", () => {
  expect(prUrlIn("Done.\nhttps://github.com/a/b/pull/12\nSummary")).toBe(
    "https://github.com/a/b/pull/12",
  );
  // A later inline mention does not beat the line.
  expect(
    prUrlIn(
      "https://github.com/a/b/pull/12\nIt replaces https://github.com/a/b/pull/3 here.",
    ),
  ).toBe("https://github.com/a/b/pull/12");
  expect(prUrlIn("https://github.com/a/b/issues/3")).toBeNull();
});

const URL = "https://github.com/acme/my-app.js/pull/42";

test.each([
  ["angle brackets", `<${URL}>`],
  ["a Markdown link", `[acme/my-app.js#42](${URL})`],
  ["a Markdown link with the URL as its text", `[${URL}](${URL})`],
  ["a PR: label", `PR: ${URL}`],
  ["a Pull request: label", `Pull request: ${URL}`],
  ["a bold label", `**PR:** ${URL}`],
  ["a bold URL", `**${URL}**`],
  ["trailing punctuation", `${URL}.`],
  ["a label, a link, and punctuation", `Pull request: [#42](${URL}).`],
])("prUrlIn accepts a line holding the URL in %s", (_form, line) => {
  expect(prUrlIn(`Opened it.\n\n${line}\n\nSummary: added the route.`)).toBe(
    URL,
  );
});

test("prUrlIn falls back to the last PR URL anywhere when no line holds one", () => {
  expect(prUrlIn("see https://github.com/a/b/pull/12 for details")).toBe(
    "https://github.com/a/b/pull/12",
  );
  expect(
    prUrlIn(
      "Closed https://github.com/a/b/pull/3 and opened https://github.com/a/b/pull/4, done.",
    ),
  ).toBe("https://github.com/a/b/pull/4");
  expect(prUrlIn("No PR: gh is not installed.")).toBeNull();
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
