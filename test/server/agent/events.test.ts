import type {
  SDKMessage,
  SDKResultError,
  SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import {
  relativeTo,
  SdkEventMapper,
  summarizeTool,
} from "../../../src/server/agent/events.js";

const AT = "2026-11-02T10:00:00.000Z";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(AT) });
});
afterEach(() => {
  vi.useRealTimers();
});

const sdk = (msg: unknown) => msg as SDKMessage;

// Result fixtures typed against the SDK, so a field the mapper reads cannot be left out.
type ResultKeys =
  | "type"
  | "subtype"
  | "session_id"
  | "is_error"
  | "num_turns"
  | "duration_ms"
  | "total_cost_usd";
type SuccessFixture = Pick<SDKResultSuccess, ResultKeys | "result"> & {
  uuid: string;
};
type ErrorFixture = Pick<SDKResultError, ResultKeys | "errors"> & {
  uuid: string;
};

test("summarizeTool follows the table", () => {
  expect(summarizeTool("Read", { file_path: "docs/a.md" })).toBe(
    "reading docs/a.md",
  );
  expect(summarizeTool("Edit", { file_path: "a.ts" })).toBe("editing a.ts");
  expect(summarizeTool("Write", { file_path: "b.ts" })).toBe("editing b.ts");
  expect(summarizeTool("MultiEdit", { file_path: "c.ts" })).toBe(
    "editing c.ts",
  );
  expect(summarizeTool("Bash", { command: "x".repeat(80) })).toBe(
    `running ${"x".repeat(60)}`,
  );
  expect(summarizeTool("Grep", { pattern: "TODO" })).toBe("searching TODO");
  expect(summarizeTool("Glob", { pattern: "**/*.ts" })).toBe(
    "searching **/*.ts",
  );
  expect(summarizeTool("mcp__blueprint__get_board", {})).toBe(
    "reading the board",
  );
  expect(summarizeTool("mcp__blueprint__get_selection", {})).toBe(
    "reading the selection",
  );
  expect(summarizeTool("ToolSearch", { query: "select:Read" })).toBe(
    "loading tools",
  );
  expect(summarizeTool("WebFetch", { url: "https://x" })).toBe("WebFetch");
});

test("summarizeTool names proposals", () => {
  expect(summarizeTool("mcp__blueprint__propose", { ops: [1, 2, 3] })).toBe(
    "proposing 3 changes",
  );
  expect(summarizeTool("mcp__blueprint__propose", { ops: [1] })).toBe(
    "proposing 1 change",
  );
  // A revise names its proposal by title, never by its id.
  expect(
    summarizeTool("mcp__blueprint__revise", {
      proposalId: "p_1a2b3c4d",
      title: "Sign-in flow",
      ops: [],
    }),
  ).toBe('revising "Sign-in flow"');
  expect(
    summarizeTool("mcp__blueprint__revise", {
      proposalId: "p_1a2b3c4d",
      ops: [],
    }),
  ).toBe("revising the proposal");
});

test("mapper turns a scripted SDK stream into panel events in order", () => {
  const mapper = new SdkEventMapper();
  const stream: SDKMessage[] = [
    sdk({ type: "system", subtype: "init", session_id: "sess-1", uuid: "u0" }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u1",
      parent_tool_use_id: null,
      event: { type: "message_start", message: { id: "msg_1" } },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u2",
      parent_tool_use_id: null,
      event: {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u3",
      parent_tool_use_id: null,
      event: {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Let me " },
      },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u4",
      parent_tool_use_id: null,
      event: {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "look." },
      },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u5",
      parent_tool_use_id: null,
      event: { type: "content_block_stop", index: 0 },
    }),
    sdk({
      type: "assistant",
      session_id: "sess-1",
      uuid: "u6",
      parent_tool_use_id: null,
      message: {
        id: "msg_1",
        content: [{ type: "text", text: "Let me look." }],
      },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u7",
      parent_tool_use_id: null,
      event: {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "tool_use",
          id: "toolu_1",
          name: "Read",
          input: {},
        },
      },
    }),
    sdk({
      type: "stream_event",
      session_id: "sess-1",
      uuid: "u8",
      parent_tool_use_id: null,
      event: {
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: "{}" },
      },
    }),
    sdk({
      type: "assistant",
      session_id: "sess-1",
      uuid: "u9",
      parent_tool_use_id: null,
      message: {
        id: "msg_1",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "Read",
            input: { file_path: "plan.md" },
          },
        ],
      },
    }),
    sdk({
      type: "user",
      session_id: "sess-1",
      uuid: "u10",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_1",
            content: [
              { type: "text", text: "1\t# Plan" },
              { type: "text", text: "2\tShip it." },
            ],
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_2",
            is_error: true,
            content: "File not found",
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_3",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: "" },
              },
            ],
          },
        ],
      },
    }),
    sdk({
      type: "result",
      subtype: "success",
      session_id: "sess-1",
      uuid: "u11",
      duration_ms: 4200,
      total_cost_usd: 0.0123,
      is_error: false,
      num_turns: 2,
      result: "done",
    } satisfies SuccessFixture),
  ];
  expect(stream.flatMap((m) => mapper.map(m))).toEqual([
    {
      kind: "assistant_text",
      id: "msg_1:0",
      text: "Let me ",
      partial: true,
      at: AT,
    },
    {
      kind: "assistant_text",
      id: "msg_1:0",
      text: "Let me look.",
      partial: true,
      at: AT,
    },
    {
      kind: "assistant_text",
      id: "msg_1:0",
      text: "Let me look.",
      partial: false,
      at: AT,
    },
    {
      kind: "tool_use",
      id: "toolu_1",
      tool: "Read",
      summary: "reading plan.md",
      at: AT,
    },
    {
      kind: "tool_result",
      id: "toolu_1:result",
      toolUseId: "toolu_1",
      ok: true,
      summary: "read 2 lines",
      at: AT,
    },
    {
      kind: "tool_result",
      id: "toolu_2:result",
      toolUseId: "toolu_2",
      ok: false,
      summary: "File not found",
      at: AT,
    },
    {
      kind: "tool_result",
      id: "toolu_3:result",
      toolUseId: "toolu_3",
      ok: true,
      summary: "returned an image",
      at: AT,
    },
    {
      kind: "result",
      id: "u11",
      subtype: "success",
      costUsd: 0.0123,
      durationMs: 4200,
      at: AT,
    },
  ]);
  expect(mapper.sessionId).toBe("sess-1");
});

test("an assistant message without streaming gets an id per message and block", () => {
  const mapper = new SdkEventMapper();
  const events = mapper.map(
    sdk({
      type: "assistant",
      session_id: "s",
      uuid: "u",
      parent_tool_use_id: null,
      message: {
        id: "msg_9",
        content: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
        ],
      },
    }),
  );
  expect(events.map((e) => e.id)).toEqual(["msg_9:0", "msg_9:1"]);
});

test("an error result becomes an error event with the joined messages", () => {
  const mapper = new SdkEventMapper();
  expect(
    mapper.map(
      sdk({
        type: "result",
        subtype: "error_during_execution",
        session_id: "s",
        uuid: "u-err",
        duration_ms: 10,
        total_cost_usd: 0.04,
        is_error: true,
        num_turns: 1,
        errors: ["first", "second"],
      } satisfies ErrorFixture),
    ),
  ).toEqual([
    {
      kind: "error",
      id: "u-err",
      message: "first\nsecond",
      costUsd: 0.04,
      at: AT,
    },
  ]);
});

test("a success result flagged is_error becomes an error event with its result text", () => {
  // The CLI reports auth and API failures this way, e.g. when the user is logged out.
  const mapper = new SdkEventMapper();
  expect(
    mapper.map(
      sdk({
        type: "result",
        subtype: "success",
        session_id: "s",
        uuid: "u-auth",
        duration_ms: 3,
        total_cost_usd: 0,
        is_error: true,
        num_turns: 0,
        result: "Not logged in · Please run /login",
      } satisfies SuccessFixture),
    ),
  ).toEqual([
    {
      kind: "error",
      id: "u-auth",
      message: "Not logged in · Please run /login",
      costUsd: 0,
      at: AT,
    },
  ]);
});

test("subagent messages are skipped and leave the main stream's state alone", () => {
  const mapper = new SdkEventMapper();
  const stream = (parent: string | null, event: unknown) =>
    sdk({ type: "stream_event", parent_tool_use_id: parent, event });
  const delta = (parent: string | null, text: string) =>
    stream(parent, {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text },
    });

  mapper.map(
    stream(null, { type: "message_start", message: { id: "msg_main" } }),
  );
  mapper.map(delta(null, "Hello"));

  const sub = "toolu_task";
  const subagent = [
    stream(sub, { type: "message_start", message: { id: "msg_sub" } }),
    delta(sub, "inner"),
    sdk({
      type: "assistant",
      parent_tool_use_id: sub,
      message: {
        id: "msg_sub",
        content: [
          { type: "text", text: "inner" },
          { type: "tool_use", id: "toolu_inner", name: "Read", input: {} },
        ],
      },
    }),
    sdk({
      type: "user",
      parent_tool_use_id: sub,
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_inner", content: "x" },
        ],
      },
    }),
  ];
  expect(subagent.flatMap((m) => mapper.map(m))).toEqual([]);

  expect(mapper.map(delta(null, " world"))).toEqual([
    {
      kind: "assistant_text",
      id: "msg_main:0",
      text: "Hello world",
      partial: true,
      at: AT,
    },
  ]);
});

// A mapper with helpers that feed it one tool use and one tool result.
function toolRows() {
  const mapper = new SdkEventMapper();
  const use = (id: string, name: string, input: object = {}) =>
    mapper.map(
      sdk({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          id: `msg_${id}`,
          content: [{ type: "tool_use", id, name, input }],
        },
      }),
    );
  const result = (id: string, content: unknown, isError = false) =>
    mapper.map(
      sdk({
        type: "user",
        parent_tool_use_id: null,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: id,
              content,
              is_error: isError,
            },
          ],
        },
      }),
    );
  const summary = (events: ReturnType<typeof result>) =>
    events.map((e) => (e.kind === "tool_result" ? e.summary : e.kind));
  return { use, result, summary };
}

test("a proposal's result row names it by title as ghosts, never by its id", () => {
  const { use, result, summary } = toolRows();
  const json = [{ type: "text", text: '{"proposalId":"p_3f004e69"}' }];
  use("t1", "mcp__blueprint__propose", { title: "Sign-in flow", ops: [] });
  expect(summary(result("t1", json))).toEqual([
    'drew "Sign-in flow" as ghosts',
  ]);
  use("t2", "mcp__blueprint__propose", { ops: [] });
  expect(summary(result("t2", json))).toEqual(["drew the proposal as ghosts"]);
  use("t3", "mcp__blueprint__revise", {
    proposalId: "p_3f004e69",
    title: "Sign-in flow",
    ops: [],
  });
  expect(summary(result("t3", json))).toEqual([
    'redrew "Sign-in flow" as ghosts',
  ]);
  use("t4", "mcp__blueprint__revise", { proposalId: "p_3f004e69", ops: [] });
  expect(summary(result("t4", json))).toEqual([
    "redrew the proposal as ghosts",
  ]);
});

test("a proposal id past the row's length still marks the result as a proposal", () => {
  const { use, result, summary } = toolRows();
  use("t1", "mcp__blueprint__propose", { title: "Flow", ops: [] });
  const long = `${" ".repeat(200)}{"proposalId":"p_3f004e69"}`;
  expect(summary(result("t1", [{ type: "text", text: long }]))).toEqual([
    'drew "Flow" as ghosts',
  ]);
});

test("the mapper forgets a tool once its result arrives", () => {
  const { use, result, summary } = toolRows();
  const json = [{ type: "text", text: '{"proposalId":"p_1"}' }];
  use("t1", "mcp__blueprint__propose", { title: "Flow", ops: [] });
  expect(summary(result("t1", json))).toEqual(['drew "Flow" as ghosts']);
  // A second result for the same id finds no tool, so it is shown as it came.
  expect(summary(result("t1", json))).toEqual(['{"proposalId":"p_1"}']);
});

test("a tool search's row names the tools it loaded", () => {
  const { use, result, summary } = toolRows();
  const ref = (tool_name: string) => ({ type: "tool_reference", tool_name });
  use("t1", "ToolSearch", { query: "select:mcp__blueprint__revise" });
  expect(summary(result("t1", [ref("mcp__blueprint__revise")]))).toEqual([
    "loaded the revise tool",
  ]);
  use("t2", "ToolSearch", { query: "select:a,b,c" });
  expect(
    summary(
      result("t2", [
        ref("mcp__blueprint__get_selection"),
        ref("mcp__blueprint__propose"),
        ref("WebFetch"),
      ]),
    ),
  ).toEqual(["loaded the get_selection, propose, and WebFetch tools"]);
});

test("a Read's row counts the lines it read instead of showing them", () => {
  const { use, result, summary } = toolRows();
  use("t1", "Read", { file_path: "notes.md" });
  expect(
    summary(result("t1", "1\t# Board: notes\n2\t\n3\t## Diagram\n")),
  ).toEqual(["read 3 lines"]);
  use("t2", "Read", { file_path: "one.md" });
  expect(summary(result("t2", "1\tonly"))).toEqual(["read 1 line"]);
  // A failure keeps its message.
  use("t3", "Read", { file_path: "docs" });
  expect(
    summary(result("t3", "EISDIR: illegal operation on a directory", true)),
  ).toEqual(["EISDIR: illegal operation on a directory"]);
});

test("another tool's result shows its text, cut short, and one with no text says what came back", () => {
  const { use, result, summary } = toolRows();
  use("t0", "Bash", { command: "cat log" });
  expect(
    summary(
      result("t0", [
        { type: "text", text: "a".repeat(100) },
        { type: "text", text: "b".repeat(100) },
      ]),
    ),
  ).toEqual([`${"a".repeat(100)}\n${"b".repeat(19)}`]);
  use("t1", "Screenshot");
  expect(
    summary(
      result("t1", [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "" },
        },
      ]),
    ),
  ).toEqual(["returned an image"]);
  use("t2", "Noop");
  expect(summary(result("t2", []))).toEqual(["finished with no output"]);
});

test("Blueprint's own tool results read as sentences, and their failures keep the message", () => {
  const mapper = new SdkEventMapper();
  const use = (id: string, name: string) =>
    mapper.map(
      sdk({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          id: `msg_${id}`,
          content: [{ type: "tool_use", id, name, input: {} }],
        },
      }),
    );
  const result = (id: string, content: unknown, isError = false) =>
    mapper.map(
      sdk({
        type: "user",
        parent_tool_use_id: null,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: id,
              content,
              is_error: isError,
            },
          ],
        },
      }),
    );
  const summary = (events: ReturnType<typeof result>) =>
    events.map((e) => (e.kind === "tool_result" ? e.summary : e.kind));
  const json = [{ type: "text", text: '{"proposalId":"p_3f004e69"}' }];

  use("t1", "mcp__blueprint__propose");
  expect(summary(result("t1", json))).toEqual(["drew the proposal as ghosts"]);
  use("t2", "mcp__blueprint__revise");
  expect(summary(result("t2", json))).toEqual([
    "redrew the proposal as ghosts",
  ]);
  use("t3", "mcp__blueprint__get_board");
  expect(
    summary(
      result("t3", [
        { type: "text", text: "```mermaid\nflowchart TD\n```" },
        { type: "image", data: "", mimeType: "image/png" },
      ]),
    ),
  ).toEqual(["read the board"]);
  use("t4", "mcp__blueprint__get_selection");
  expect(summary(result("t4", [{ type: "text", text: "Login" }]))).toEqual([
    "read the selection",
  ]);
  use("t5", "mcp__blueprint__propose");
  expect(
    summary(
      result("t5", [{ type: "text", text: "unknown element id x" }], true),
    ),
  ).toEqual(["unknown element id x"]);
  // Another tool's JSON is shown as it came.
  use("t6", "Bash");
  expect(summary(result("t6", '{"proposalId":"p_1"}'))).toEqual([
    '{"proposalId":"p_1"}',
  ]);
});

test("relativeTo drops the session directory only where a path starts", () => {
  const rel = relativeTo("/repo");
  expect(rel("/repo/a.ts")).toBe("a.ts");
  expect(rel("cat /repo/a.ts\ttail /repo/b.ts\n/repo/c.ts")).toBe(
    "cat a.ts\ttail b.ts\nc.ts",
  );
  expect(rel(`cp "/repo/a b.ts" '/repo/c.ts'`)).toBe(`cp "a b.ts" 'c.ts'`);
  // Another repository whose path ends with the same name is left whole.
  expect(rel("diff /other/repo/x.ts /repo/x.ts")).toBe(
    "diff /other/repo/x.ts x.ts",
  );
  expect(rel("see a/repo/x.ts")).toBe("see a/repo/x.ts");
});

test("rows show paths relative to the session directory, under either spelling of it", async () => {
  const { mkdtemp, realpath, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // On macOS tmpdir() is under /var, which the CLI reports as /private/var.
  const cwd = await mkdtemp(join(tmpdir(), "blueprint-rel-"));
  const real = await realpath(cwd);
  try {
    const rel = relativeTo(cwd);
    expect(
      summarizeTool("Write", { file_path: `${real}/src/login.ts` }, rel),
    ).toBe("editing src/login.ts");
    expect(summarizeTool("Read", { file_path: `${cwd}/a.md` }, rel)).toBe(
      "reading a.md",
    );
    expect(summarizeTool("Read", { file_path: "/elsewhere/a.md" }, rel)).toBe(
      "reading /elsewhere/a.md",
    );

    const mapper = new SdkEventMapper(cwd);
    const [use] = mapper.map(
      sdk({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          id: "msg_w",
          content: [
            {
              type: "tool_use",
              id: "tw",
              name: "Write",
              input: { file_path: `${real}/src/login.ts` },
            },
          ],
        },
      }),
    );
    expect(use).toMatchObject({ summary: "editing src/login.ts" });
    const [result] = mapper.map(
      sdk({
        type: "user",
        parent_tool_use_id: null,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tw",
              content: `File created successfully at: ${real}/src/login.ts`,
            },
          ],
        },
      }),
    );
    expect(result).toMatchObject({
      summary: "File created successfully at: src/login.ts",
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
