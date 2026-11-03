import type { HookInput } from "@anthropic-ai/claude-agent-sdk";
import {
  denyBoardWrites,
  isProtectedPath,
} from "../../../src/server/agent/hooks.js";

const cwd = "/repo";
const pre = (tool_name: string, tool_input: unknown) =>
  ({
    hook_event_name: "PreToolUse",
    session_id: "s",
    transcript_path: "/t",
    cwd,
    tool_name,
    tool_input,
    tool_use_id: "u",
  }) as HookInput;
const run = (input: HookInput) =>
  denyBoardWrites(input, "u", { signal: new AbortController().signal });

test("denyBoardWrites denies a Write under .blueprint/boards and allows src/x.ts", async () => {
  expect(
    await run(
      pre("Write", { file_path: ".blueprint/boards/flow.excalidraw.json" }),
    ),
  ).toEqual({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Blueprint boards are edited only through proposals; use the propose tool in a later milestone, or ask the user to draw it.",
    },
  });
  expect(await run(pre("Write", { file_path: "src/x.ts" }))).toEqual({});
  expect(
    await run(pre("Edit", { file_path: "/repo/.blueprint/assets/x.png" })),
  ).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
  expect(
    await run(
      pre("NotebookEdit", { notebook_path: ".blueprint/boards/n.ipynb" }),
    ),
  ).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
  expect(
    await run(
      pre("Read", { file_path: ".blueprint/boards/flow.excalidraw.json" }),
    ),
  ).toEqual({});
  expect(
    await run({
      ...pre("Write", {}),
      hook_event_name: "PostToolUse",
    } as HookInput),
  ).toEqual({});
});

test("isProtectedPath covers boards and assets only, after resolving against cwd", () => {
  expect(isProtectedPath(cwd, ".blueprint/boards/a.json")).toBe(true);
  expect(isProtectedPath(cwd, "/repo/.blueprint/assets/x.png")).toBe(true);
  expect(isProtectedPath(cwd, "src/../.blueprint/boards/a.json")).toBe(true);
  expect(isProtectedPath(cwd, ".blueprint/docs/a.md")).toBe(false);
  expect(isProtectedPath(cwd, ".blueprint/boards")).toBe(false);
  expect(isProtectedPath(cwd, ".blueprint/boards-old/a.json")).toBe(false);
  expect(isProtectedPath(cwd, "/other/.blueprint/boards/a.json")).toBe(false);
});
