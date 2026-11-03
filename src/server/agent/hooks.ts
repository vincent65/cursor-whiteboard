import { resolve, sep } from "node:path";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const REASON =
  "Blueprint boards are edited only through proposals; use the propose tool in a later milestone, or ask the user to draw it.";

export function isProtectedPath(cwd: string, filePath: string): boolean {
  const path = resolve(cwd, filePath);
  return ["boards", "assets"].some((d) =>
    path.startsWith(resolve(cwd, ".blueprint", d) + sep),
  );
}

// ponytail: guards the file tools only; a Bash command can still write there.
export const denyBoardWrites: HookCallback = async (input) => {
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
  if (typeof path !== "string" || !isProtectedPath(input.cwd, path)) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: REASON,
    },
  };
};
