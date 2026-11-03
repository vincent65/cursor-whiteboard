import type { PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { PermissionBroker } from "../../../src/server/agent/broker.js";

const suggestion: PermissionUpdate = {
  type: "addRules",
  rules: [{ toolName: "Bash", ruleContent: "ls" }],
  behavior: "allow",
  destination: "session",
};

function ask(
  broker: PermissionBroker,
  toolUseID: string,
  signal = new AbortController().signal,
) {
  return broker.ask({
    toolUseID,
    tool: "Bash",
    input: { command: "ls" },
    suggestions: [suggestion],
    signal,
  });
}

test("ask resolves allow, deny with default message, and always with the suggestions", async () => {
  const broker = new PermissionBroker({ onChange() {} });
  const allowed = ask(broker, "t1");
  const denied = ask(broker, "t2");
  const always = ask(broker, "t3");
  const noSuggestions = broker.ask({
    toolUseID: "t4",
    tool: "Read",
    input: {},
    signal: new AbortController().signal,
  });
  expect(broker.answer("t1", { behavior: "allow" })).toBe(true);
  expect(broker.answer("t2", { behavior: "deny" })).toBe(true);
  expect(broker.answer("t3", { behavior: "always" })).toBe(true);
  expect(broker.answer("t4", { behavior: "always" })).toBe(true);
  await expect(allowed).resolves.toEqual({ behavior: "allow" });
  await expect(denied).resolves.toEqual({
    behavior: "deny",
    message: "The user denied this action in Blueprint.",
  });
  await expect(always).resolves.toEqual({
    behavior: "allow",
    updatedPermissions: [suggestion],
  });
  // Without suggestions there is no rule to keep, so always allows once.
  await expect(noSuggestions).resolves.toEqual({ behavior: "allow" });
});

test("pending lists open asks, answer with an unknown id is false, cancelAll denies with the reason", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-02T10:00:00.000Z") });
  const onChange = vi.fn();
  const broker = new PermissionBroker({ onChange });
  const first = ask(broker, "t1");
  const second = broker.ask({
    toolUseID: "t2",
    tool: "Read",
    input: { file_path: "a.md" },
    signal: new AbortController().signal,
  });
  vi.useRealTimers();
  const expected = [
    {
      id: "t1",
      tool: "Bash",
      summary: "running ls",
      canAlways: true,
      at: "2026-11-02T10:00:00.000Z",
    },
    {
      id: "t2",
      tool: "Read",
      summary: "reading a.md",
      canAlways: false,
      at: "2026-11-02T10:00:00.000Z",
    },
  ];
  expect(broker.pending()).toEqual(expected);
  expect(onChange).toHaveBeenLastCalledWith(expected);
  expect(broker.answer("nope", { behavior: "allow" })).toBe(false);
  expect(
    broker.answer("t2", { behavior: "deny", message: "not that file" }),
  ).toBe(true);
  expect(broker.answer("t2", { behavior: "allow" })).toBe(false);
  await expect(second).resolves.toEqual({
    behavior: "deny",
    message: "not that file",
  });
  expect(onChange).toHaveBeenLastCalledWith([expected[0]]);
  broker.cancelAll("session closed");
  await expect(first).resolves.toEqual({
    behavior: "deny",
    message: "session closed",
  });
  expect(broker.pending()).toEqual([]);
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test("an aborted signal denies as interrupted and clears the entry", async () => {
  const onChange = vi.fn();
  const broker = new PermissionBroker({ onChange });
  const controller = new AbortController();
  const result = ask(broker, "t1", controller.signal);
  expect(broker.pending()).toHaveLength(1);
  controller.abort();
  await expect(result).resolves.toEqual({
    behavior: "deny",
    message: "interrupted",
  });
  expect(broker.pending()).toEqual([]);
  expect(onChange).toHaveBeenLastCalledWith([]);
  expect(broker.answer("t1", { behavior: "allow" })).toBe(false);

  const preAborted = new AbortController();
  preAborted.abort();
  await expect(ask(broker, "t2", preAborted.signal)).resolves.toEqual({
    behavior: "deny",
    message: "interrupted",
  });
  expect(broker.pending()).toEqual([]);
});

test("an ask shows paths relative to the session directory", () => {
  const broker = new PermissionBroker({ cwd: "/repo", onChange() {} });
  void broker.ask({
    toolUseID: "t1",
    tool: "Write",
    input: { file_path: "/repo/src/login.ts" },
    signal: new AbortController().signal,
  });
  expect(broker.pending()[0]?.summary).toBe("editing src/login.ts");
});

// A row may cut a command short, but an ask must show everything it would allow.
test("an ask shows the whole command, however long", () => {
  const broker = new PermissionBroker({ cwd: "/repo", onChange() {} });
  const command = `pytest -q && git add .\ngit commit -m "${"x".repeat(80)}" && git push`;
  void broker.ask({
    toolUseID: "t1",
    tool: "Bash",
    input: { command },
    signal: new AbortController().signal,
  });
  expect(broker.pending()[0]?.summary).toBe(`running ${command}`);
});

// A row may shorten paths, but a command shown with a path cut away is not the command run.
test("an ask shows a command verbatim, with its paths as written", () => {
  const broker = new PermissionBroker({ cwd: "/repo", onChange() {} });
  const command = "cd /tmp && rm -rf /repo/build";
  void broker.ask({
    toolUseID: "t1",
    tool: "Bash",
    input: { command },
    signal: new AbortController().signal,
  });
  expect(broker.pending()[0]?.summary).toBe(`running ${command}`);
});
