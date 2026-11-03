import type { Task } from "../../shared/tasks.js";

const head = (branch: string) =>
  `You are implementing one task of a plan in this worktree, on branch ${branch}.`;
const LAST_LINE =
  "5. Print the pull request URL on its own line, then summarize what you did and anything left open.";

// What the transcript shows for the run prompt: the whole prompt goes to Claude only.
export const runLabel = (slug: string) => `Start task ${slug}`;

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
  return `${head(branch)}

## Task (${taskFile})
${task.body}

Depends on: ${task.dependsOn.join(", ") || "nothing"}
Files likely touched: ${task.files.join(", ") || "unknown"}
Acceptance:
${acceptance}

## Specification
${spec}

## Definition of done
1. Create and edit files with the Write and Edit tools, not shell redirection.
2. Implement the task with tests where the project has them; keep the existing checks green.
3. Commit with clear conventional commit messages on this branch.
4. Push the branch and open a pull request with \`gh pr create\` if \`gh\` is installed and authenticated; if it is not, say so and stop after pushing or committing.
${LAST_LINE}`;
}

// A saved prompt as the run's transcript showed it live: its own run prompt reads as the
// label, and words a message sent after it (with no session to resume) read as themselves.
// Undefined for anything that is not this run's prompt.
export function shownRunPrompt(
  prompt: string,
  run: { taskSlug: string; branch: string },
): string | undefined {
  if (!prompt.startsWith(`${head(run.branch)}\n`)) return undefined;
  const end = prompt.indexOf(`${LAST_LINE}\n\n`);
  return end < 0
    ? runLabel(run.taskSlug)
    : prompt.slice(end + LAST_LINE.length + 2);
}

const PR_URL = String.raw`https://github\.com/[\w.-]+/[\w.-]+/pull/\d+`;
// A line holding only the URL: bare, in angle brackets, or as a Markdown link.
const URL_LINE = new RegExp(
  String.raw`^(?:<(${PR_URL})>|\[[^\]]*\]\((${PR_URL})\)|(${PR_URL}))$`,
);
// Not followed by more path, so a PR's /files page is not the PR.
const URL_ANYWHERE = new RegExp(String.raw`${PR_URL}(?![\w/])`, "g");

// The PR a run opened: the first line holding only its URL, as the definition of done
// asks, once bold markers, a short label such as "PR:", and trailing punctuation are
// set aside. With no such line, the last PR URL anywhere in the text.
export function prUrlIn(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw
      .replaceAll("**", "")
      .trim()
      // The space after the colon keeps "https:" from reading as a label.
      .replace(/^[A-Za-z][\w ]{0,24}:\s+/, "")
      .replace(/[.,;:!]+$/, "");
    const m = URL_LINE.exec(line);
    if (m) return m[1] ?? m[2] ?? m[3];
  }
  return text.match(URL_ANYWHERE)?.at(-1) ?? null;
}
