import type { HookInput } from "@anthropic-ai/claude-agent-sdk";
import {
  denyBoardWrites,
  isProtectedPath,
} from "../../../src/server/agent/hooks.js";

const cwd = "/repo";
const pre = (tool_name: string, tool_input: unknown, at = cwd) =>
  ({
    hook_event_name: "PreToolUse",
    session_id: "s",
    transcript_path: "/t",
    cwd: at,
    tool_name,
    tool_input,
    tool_use_id: "u",
  }) as HookInput;
const run = (input: HookInput) =>
  denyBoardWrites(cwd)(input, "u", { signal: new AbortController().signal });

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
        "Blueprint board files are read-only here. Propose changes with the propose tool instead.",
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

test("denyBoardWrites anchors on the repository root, not the agent's current directory", async () => {
  const denied = { hookSpecificOutput: { permissionDecision: "deny" } };
  // After a `cd src` in Bash, an absolute board path is still under the root.
  expect(
    await run(
      pre(
        "Write",
        { file_path: "/repo/.blueprint/boards/x.excalidraw.json" },
        "/repo/src",
      ),
    ),
  ).toMatchObject(denied);
  // A relative path resolves against the agent's current directory.
  expect(
    await run(
      pre("Edit", { file_path: "../.blueprint/assets/x.png" }, "/repo/src"),
    ),
  ).toMatchObject(denied);
  expect(
    await run(
      pre("Write", { file_path: ".blueprint/boards/x.json" }, "/repo/src"),
    ),
  ).toEqual({});
});

test("denyBoardWrites gives the reason it was built with", async () => {
  expect(
    await denyBoardWrites(cwd, "Leave the board alone.")(
      pre("Write", { file_path: ".blueprint/boards/flow.excalidraw.json" }),
      "u",
      { signal: new AbortController().signal },
    ),
  ).toMatchObject({
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: "Leave the board alone.",
    },
  });
});

test("denyBoardWrites with several roots denies a board under any of them", async () => {
  const worktree = "/repo/.blueprint/worktrees/auth";
  const guard = denyBoardWrites([cwd, worktree], "read-only in a run");
  const write = (file_path: string) =>
    guard(pre("Write", { file_path }, worktree), "u", {
      signal: new AbortController().signal,
    });
  const denied = {
    hookSpecificOutput: {
      permissionDecision: "deny",
      permissionDecisionReason: "read-only in a run",
    },
  };
  // From the worktree, a relative path climbs to the live board under the repository root.
  expect(await write("../../boards/x.excalidraw.json")).toMatchObject(denied);
  expect(
    await write("/repo/.blueprint/boards/x.excalidraw.json"),
  ).toMatchObject(denied);
  expect(await write(".blueprint/boards/x.excalidraw.json")).toMatchObject(
    denied,
  );
  expect(await write("src/x.ts")).toEqual({});
});
