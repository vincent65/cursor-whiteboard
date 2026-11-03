import { resolve, sep } from "node:path";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const PLAN_REASON =
  "Blueprint board files are read-only here. Propose changes with the propose tool instead.";

export function isProtectedPath(root: string, filePath: string): boolean {
  const path = resolve(root, filePath);
  return ["boards", "assets"].some((d) =>
    path.startsWith(resolve(root, ".blueprint", d) + sep),
  );
}

// `reason` is what Claude reads on a denial; run sessions have no propose tool.
// `roots` are fixed for the session: the repository root, plus the worktree for a run,
// whose `..` reaches the live board. The hook's `cwd` is the agent's current directory,
// which moves with `cd`, so it only resolves relative paths.
// ponytail: guards the file tools only; a Bash command can still write there.
export const denyBoardWrites =
  (roots: string | string[], reason = PLAN_REASON): HookCallback =>
  async (input) => {
    if (
      input.hook_event_name !== "PreToolUse" ||
      !WRITE_TOOLS.has(input.tool_name)
    )
      return {};
    const args = (input.tool_input ?? {}) as {
      file_path?: unknown;
      notebook_path?: unknown;
    };
    const path = args.file_path ?? args.notebook_path;
    if (typeof path !== "string") return {};
    const target = resolve(input.cwd, path);
    if (![roots].flat().some((root) => isProtectedPath(root, target)))
      return {};
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    };
  };
