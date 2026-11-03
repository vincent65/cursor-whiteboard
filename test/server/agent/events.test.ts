import type {
  SDKMessage,
  SDKResultError,
  SDKResultSuccess,
} from "@anthropic-ai/claude-agent-sdk";
import {
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
    `running \`${"x".repeat(60)}\``,
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
  expect(summarizeTool("WebFetch", { url: "https://x" })).toBe("WebFetch");
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
              { type: "text", text: "a".repeat(100) },
              { type: "text", text: "b".repeat(100) },
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
      summary: `${"a".repeat(100)}\n${"b".repeat(19)}`,
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
      summary: "(non-text result)",
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
        total_cost_usd: 0,
        is_error: true,
        num_turns: 1,
        errors: ["first", "second"],
      } satisfies ErrorFixture),
    ),
  ).toEqual([{ kind: "error", id: "u-err", message: "first\nsecond", at: AT }]);
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
      at: AT,
    },
  ]);
});
