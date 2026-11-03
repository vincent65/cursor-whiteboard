import type { Task } from "../../shared/tasks.js";

// The first message of every run: the task file, the spec, and what done means.
export function runPrompt(input: {
  task: Task;
  taskFile: string;
  spec: string;
  branch: string;
}): string {
  const { task, taskFile, spec, branch } = input;
  const acceptance =
    task.acceptance.map((line) => `- ${line}`).join("\n") ||
    "- none listed; use the task description and the specification";
  return `You are implementing one task of a plan in this worktree, on branch ${branch}.

## Task (${taskFile})
${task.body}

Depends on: ${task.dependsOn.join(", ") || "nothing"}
Files likely touched: ${task.files.join(", ") || "unknown"}
Acceptance:
${acceptance}

## Specification
${spec}

## Definition of done
1. Implement the task with tests where the project has them; keep the existing checks green.
2. Commit with clear conventional commit messages on this branch.
3. Push the branch and open a pull request with \`gh pr create\` if \`gh\` is installed and authenticated; if it is not, say so and stop after pushing or committing.
4. Print the pull request URL on its own line, then summarize what you did and anything left open.`;
}

const PR_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/;

// The PR a run opened: a line holding only its URL, as the definition of done asks.
export function prUrlIn(text: string): string | null {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => PR_URL.test(line)) ?? null
  );
}
