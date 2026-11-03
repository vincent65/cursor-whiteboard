import type {
  Options,
  SDKMessage,
  SDKResultError,
  SDKResultSuccess,
  SDKUserMessage,
  SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";
import {
  PlanSession,
  type SessionDeps,
} from "../../../src/server/agent/session.js";
import type { PanelEvent } from "../../../src/shared/panel.js";

const sdk = (msg: unknown) => msg as SDKMessage;

// Result fixtures typed against the SDK, so a field the session reads cannot be left out.
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

const init = (sessionId: string) =>
  sdk({ type: "system", subtype: "init", session_id: sessionId, uuid: "i" });

// One text turn in the order the SDK emits it with partial messages on: the block's deltas,
// then one assistant message for the finished block, then the block and message stops.
function textTurn(msgId: string, text: string, resultId: string): SDKMessage[] {
  const stream = (event: unknown) =>
    sdk({ type: "stream_event", parent_tool_use_id: null, event });
  return [
    stream({ type: "message_start", message: { id: msgId } }),
    stream({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    }),
    stream({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text },
    }),
    sdk({
      type: "assistant",
      parent_tool_use_id: null,
      message: { id: msgId, content: [{ type: "text", text }] },
    }),
    stream({ type: "content_block_stop", index: 0 }),
    stream({ type: "message_stop" }),
    sdk({
      type: "result",
      subtype: "success",
      session_id: "s",
      uuid: resultId,
      is_error: false,
      num_turns: 1,
      result: text,
      total_cost_usd: 0.01,
      duration_ms: 5,
    } satisfies SuccessFixture),
  ];
}

type Script = (text: string, turn: number) => AsyncIterable<SDKMessage>;

// A fake `query` that reads the prompt iterable in the background, like the SDK does, and
// yields the scripted messages for each user message in order. With readLimit it stops
// reading after that many, like a CLI that has not taken the rest (the SDK writes nothing
// before the CLI is initialized), which stay queued. `read` records every message taken.
function fakeQuery(script: Script, endAfter?: number, readLimit?: number) {
  const runs: {
    options: Options | undefined;
    read: string[];
    inputEnded: boolean;
    interrupt: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[] = [];
  const query = vi.fn(
    (params: {
      prompt: string | AsyncIterable<SDKUserMessage>;
      options?: Options;
    }) => {
      const run = {
        options: params.options,
        read: [] as string[],
        inputEnded: false,
        interrupt: vi.fn(async () => undefined),
        close: vi.fn(),
      };
      runs.push(run);
      const received: string[] = [];
      let wake: (() => void) | undefined;
      void (async () => {
        const input = (params.prompt as AsyncIterable<SDKUserMessage>)[
          Symbol.asyncIterator
        ]();
        for (let taken = 0; taken !== readLimit; taken++) {
          const next = await input.next();
          if (next.done) {
            run.inputEnded = true;
            wake?.();
            return;
          }
          received.push(next.value.message.content as string);
          run.read.push(next.value.message.content as string);
          wake?.();
        }
      })();
      async function* messages() {
        let turn = 0;
        while (true) {
          const text = received.shift();
          if (text !== undefined) {
            yield* script(text, turn++);
            if (turn === endAfter) return;
          } else if (run.inputEnded) {
            return;
          } else {
            await new Promise<void>((r) => {
              wake = r;
            });
          }
        }
      }
      return Object.assign(messages(), {
        interrupt: run.interrupt,
        close: run.close,
      });
    },
  );
  return { query, runs };
}

async function* turnsOf(...msgs: SDKMessage[]) {
  yield* msgs;
}

function setup(
  script: Script,
  opts: {
    resumeId?: string;
    getSessionMessages?: SessionDeps["getSessionMessages"];
    onEvent?: (e: PanelEvent) => void;
    endAfter?: number;
    readLimit?: number;
  } = {},
) {
  const { query, runs } = fakeQuery(script, opts.endAfter, opts.readLimit);
  const events: PanelEvent[] = [];
  const statuses: [string, string | undefined][] = [];
  const sessionIds: string[] = [];
  const deps: SessionDeps = {
    query: query as unknown as SessionDeps["query"],
    getSessionMessages:
      opts.getSessionMessages ?? vi.fn(async () => [] as SessionMessage[]),
    cwd: "/proj",
    options: { model: "claude-test" },
    onEvent: (e) => {
      opts.onEvent?.(e);
      events.push(e);
    },
    onStatus: (s, m) => statuses.push([s, m]),
    onSessionId: (id) => sessionIds.push(id),
  };
  const session = new PlanSession(deps, opts.resumeId);
  return { session, query, runs, events, statuses, sessionIds };
}

const kinds = (events: PanelEvent[]) =>
  events.map((e) =>
    e.kind === "assistant_text" ? `${e.kind}:${e.partial}` : e.kind,
  );

test("send shows the typed text in the user event and sends the composed text", async () => {
  const { session, runs, events } = setup((_text, turn) =>
    turnsOf(...(turn === 0 ? [init("s")] : []), ...textTurn("m", "x", "r")),
  );
  session.send("[note]\n\nhi", "hi");
  expect(events[0]).toMatchObject({ kind: "user", text: "hi" });
  await vi.waitFor(() => expect(session.status).toBe("idle"));
  expect(runs[0].read).toEqual(["[note]\n\nhi"]);
});

test("send starts the query, streams events, and goes idle on result", async () => {
  const { session, query, runs, events, statuses, sessionIds } = setup(
    (text, turn) =>
      turnsOf(
        ...(turn === 0 ? [init("sess-1")] : []),
        ...textTurn("msg_1", `echo ${text}`, "r1"),
      ),
  );

  const id = session.send("hello");

  expect(events[0]).toMatchObject({ kind: "user", id, text: "hello" });
  expect(session.status).toBe("starting");
  await vi.waitFor(() => expect(session.status).toBe("idle"));

  expect(query).toHaveBeenCalledTimes(1);
  expect(runs[0].options).toMatchObject({
    model: "claude-test",
    cwd: "/proj",
    includePartialMessages: true,
  });
  expect(runs[0].options?.resume).toBeUndefined();
  expect(kinds(events)).toEqual([
    "user",
    "assistant_text:true",
    "assistant_text:false",
    "result",
  ]);
  expect(events[2]).toMatchObject({ id: "msg_1:0", text: "echo hello" });
  expect(statuses.map(([s]) => s)).toEqual(["starting", "working", "idle"]);
  expect(session.sessionId).toBe("sess-1");
  expect(sessionIds).toEqual(["sess-1"]);
  // Partial and final text share an id, so the transcript keeps only the final one.
  expect(kinds(session.transcript())).toEqual([
    "user",
    "assistant_text:false",
    "result",
  ]);
});

test("a second send during a turn is held by the session and handed over after the first result", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, query, runs, events, statuses } = setup((text, turn) =>
    (async function* () {
      if (turn === 0) yield init("sess-1");
      const [result, ...rest] = textTurn(
        `msg_${turn}`,
        `echo ${text}`,
        `r${turn}`,
      ).reverse();
      yield* rest.reverse();
      if (turn === 0) await gate;
      yield result;
    })(),
  );

  session.send("first");
  await vi.waitFor(() => expect(session.status).toBe("working"));
  const second = session.send("second");

  expect(events.at(-1)).toMatchObject({
    kind: "user",
    id: second,
    text: "second",
  });
  // The SDK gets only the turn in flight; the second waits in the session.
  await new Promise((r) => setTimeout(r, 10));
  expect(runs[0].read).toEqual(["first"]);
  release();
  await vi.waitFor(() =>
    expect(events.filter((e) => e.kind === "result")).toHaveLength(2),
  );

  expect(query).toHaveBeenCalledTimes(1);
  const order = events.flatMap((e) =>
    e.kind === "user" || (e.kind === "assistant_text" && !e.partial)
      ? [e.text]
      : e.kind === "result"
        ? [e.id]
        : [],
  );
  expect(order).toEqual([
    "first",
    "echo first",
    "second",
    "r0",
    "echo second",
    "r1",
  ]);
  expect(events.at(-1)).toMatchObject({ kind: "result", id: "r1" });
  expect(runs[0].read).toEqual(["first", "second"]);
  expect(session.status).toBe("idle");
  // Handed over at the first result, the second turn never reads idle in between.
  expect(statuses.map(([s]) => s)).toEqual(["starting", "working", "idle"]);
});

test("a thrown query becomes an error event and status error, and the next send starts a new query with resume", async () => {
  const { session, query, runs, events, statuses } = setup((text, turn) =>
    (async function* () {
      if (text === "boom") {
        yield init("sess-1");
        throw new Error("process exited");
      }
      if (turn === 0) yield init("sess-1");
      yield* textTurn("msg_2", "recovered", "r2");
    })(),
  );

  session.send("boom");
  await vi.waitFor(() => expect(session.status).toBe("error"));

  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: "process exited",
  });
  expect(statuses.at(-1)).toEqual(["error", "process exited"]);

  session.send("again");
  await vi.waitFor(() => expect(session.status).toBe("idle"));

  expect(query).toHaveBeenCalledTimes(2);
  expect(runs[1].options).toMatchObject({
    resume: "sess-1",
    includePartialMessages: true,
  });
  expect(events.at(-1)).toMatchObject({ kind: "result", id: "r2" });
});

test("a resumed run that throws before init drops the saved id and the next send starts fresh", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  let attempt = 0;
  const { session, runs, events, statuses, sessionIds } = setup(
    () =>
      (async function* () {
        if (attempt++ === 0)
          throw new Error("No conversation found with session ID: old");
        yield init("new");
        yield* textTurn("m", "x", "r");
      })(),
    { resumeId: "old" },
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("error"));
  expect(runs[0].options?.resume).toBe("old");
  expect(session.sessionId).toBeUndefined();
  expect(warn).toHaveBeenCalledWith(
    "could not resume session old: No conversation found with session ID: old",
  );
  warn.mockRestore();
  const restoreFailed =
    "The previous session could not be loaded (No conversation found with session ID: old); starting fresh.";
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: restoreFailed,
  });
  expect(statuses.at(-1)).toEqual(["error", restoreFailed]);

  session.send("two");
  await vi.waitFor(() => expect(session.status).toBe("idle"));
  expect(runs[1].options?.resume).toBeUndefined();
  expect(session.sessionId).toBe("new");
  expect(sessionIds).toEqual(["new"]);
});

test("an error result sets status error and the next send starts a fresh query with resume", async () => {
  const { session, query, runs, events, statuses } = setup((text) =>
    turnsOf(
      init("sess-1"),
      text === "one"
        ? sdk({
            type: "result",
            subtype: "error_max_turns",
            session_id: "sess-1",
            uuid: "r-err",
            is_error: true,
            num_turns: 3,
            errors: ["max turns reached"],
            total_cost_usd: 0,
            duration_ms: 1,
          } satisfies ErrorFixture)
        : sdk({
            type: "result",
            subtype: "success",
            session_id: "sess-1",
            uuid: "r-ok",
            is_error: false,
            num_turns: 1,
            result: "ok",
            total_cost_usd: 0,
            duration_ms: 1,
          } satisfies SuccessFixture),
    ),
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("error"));
  expect(statuses.at(-1)).toEqual(["error", "max turns reached"]);
  expect(events.at(-1)).toMatchObject({ kind: "error", id: "r-err" });

  session.send("two");
  await vi.waitFor(() => expect(session.status).toBe("idle"));
  expect(query).toHaveBeenCalledTimes(2);
  expect(runs[0].close).toHaveBeenCalled();
  expect(runs[0].inputEnded).toBe(true);
  expect(runs[1].options?.resume).toBe("sess-1");
});

test("a send held behind a turn that ends in an error result still runs on the same query", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, query, events, statuses } = setup((text) =>
    text === "one"
      ? (async function* () {
          yield init("sess-1");
          await gate;
          yield sdk({
            type: "result",
            subtype: "error_max_turns",
            session_id: "sess-1",
            uuid: "r-err",
            is_error: true,
            num_turns: 3,
            errors: ["max turns reached"],
            total_cost_usd: 0,
            duration_ms: 1,
          } satisfies ErrorFixture);
        })()
      : turnsOf(...textTurn("m", "x", "r-ok")),
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("working"));
  session.send("two");
  release();
  await vi.waitFor(() =>
    expect(events.at(-1)).toMatchObject({ kind: "result", id: "r-ok" }),
  );

  expect(query).toHaveBeenCalledTimes(1);
  expect(events).toContainEqual(
    expect.objectContaining({ kind: "error", id: "r-err" }),
  );
  expect(statuses.map(([s]) => s)).toEqual(["starting", "working", "idle"]);
});

test("a success result flagged is_error sets status error with its result text", async () => {
  const { session, events, statuses } = setup(() =>
    turnsOf(
      init("sess-1"),
      sdk({
        type: "result",
        subtype: "success",
        session_id: "sess-1",
        uuid: "r-auth",
        is_error: true,
        num_turns: 0,
        result: "Not logged in · Please run /login",
        total_cost_usd: 0,
        duration_ms: 2,
      } satisfies SuccessFixture),
    ),
  );

  session.send("hi");
  await vi.waitFor(() => expect(session.status).toBe("error"));

  expect(statuses.at(-1)).toEqual([
    "error",
    "Not logged in · Please run /login",
  ]);
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    id: "r-auth",
    message: "Not logged in · Please run /login",
  });
  expect(events.some((e) => e.kind === "result")).toBe(false);
});

test("a throwing event handler closes the run and the next send starts exactly one new query", async () => {
  let thrown = false;
  const { session, query, runs, statuses } = setup(
    (_text, turn) =>
      turnsOf(
        ...(turn === 0 ? [init("sess-1")] : []),
        ...textTurn("m", "x", "r"),
      ),
    {
      onEvent: (e) => {
        if (e.kind === "assistant_text" && !thrown) {
          thrown = true;
          throw new Error("broadcast failed");
        }
      },
    },
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("error"));
  expect(statuses.at(-1)).toEqual(["error", "broadcast failed"]);
  expect(runs[0].close).toHaveBeenCalled();
  await vi.waitFor(() => expect(runs[0].inputEnded).toBe(true));

  session.send("two");
  await vi.waitFor(() => expect(session.status).toBe("idle"));
  expect(query).toHaveBeenCalledTimes(2);
  expect(runs[1].options?.resume).toBe("sess-1");
});

test("messages still queued when a run throws are each reported as not sent", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, runs, events } = setup(() =>
    (async function* () {
      yield init("sess-1");
      await gate;
      throw new Error("process exited");
    })(),
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("working"));
  session.send("two");
  session.send("three");
  release();
  await vi.waitFor(() => expect(session.status).toBe("error"));

  expect(runs[0].read).toEqual(["one"]);
  expect(
    events.flatMap((e) => (e.kind === "error" ? [e.message] : [])),
  ).toEqual([
    "process exited",
    "Message not sent: Claude session ended before it ran",
    "Message not sent: Claude session ended before it ran",
  ]);
});

test("a query that ends on its own sets error and the next send starts a new query with resume", async () => {
  const { session, query, runs, events, statuses } = setup(
    (_text, turn) =>
      turnsOf(
        ...(turn === 0 ? [init("sess-1")] : []),
        ...textTurn("m", "x", "r"),
      ),
    { endAfter: 1 },
  );

  session.send("one");
  await vi.waitFor(() => expect(session.status).toBe("error"));
  expect(statuses.at(-1)).toEqual(["error", "Claude session ended"]);
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: "Claude session ended",
  });
  expect(runs[0].close).toHaveBeenCalled();

  session.send("two");
  // The second run answers its turn, then also ends because the fake ends every run after one.
  await vi.waitFor(() =>
    expect(events.filter((e) => e.kind === "result")).toHaveLength(2),
  );
  expect(query).toHaveBeenCalledTimes(2);
  expect(runs[1].options?.resume).toBe("sess-1");
});

test("restore seeds the transcript from the saved session and a failure starts fresh with an error event", async () => {
  const saved = [
    {
      type: "user",
      uuid: "u1",
      session_id: "old",
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: { role: "user", content: "plan the auth flow" },
    },
    {
      type: "assistant",
      uuid: "a1",
      session_id: "old",
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: { id: "msg_old", content: [{ type: "text", text: "Sure." }] },
    },
  ] as SessionMessage[];
  const getSessionMessages = vi.fn(async () => saved);
  const restored = setup(
    (_text, turn) =>
      turnsOf(...(turn === 0 ? [init("old")] : []), ...textTurn("m", "x", "r")),
    { resumeId: "old", getSessionMessages },
  );

  await restored.session.restore();

  expect(getSessionMessages).toHaveBeenCalledWith("old", { dir: "/proj" });
  expect(restored.query).not.toHaveBeenCalled();
  expect(restored.session.status).toBe("idle");
  expect(restored.session.sessionId).toBe("old");
  expect(restored.session.transcript()).toMatchObject([
    { kind: "user", id: "u1", text: "plan the auth flow" },
    {
      kind: "assistant_text",
      id: "a1:0",
      text: "Sure.",
      partial: false,
    },
  ]);
  restored.session.send("continue");
  await vi.waitFor(() => expect(restored.session.status).toBe("idle"));
  expect(restored.runs[0].options?.resume).toBe("old");

  const failed = setup(
    (_text, turn) =>
      turnsOf(...(turn === 0 ? [init("new")] : []), ...textTurn("m", "x", "r")),
    {
      resumeId: "gone",
      getSessionMessages: vi.fn(async () => {
        throw new Error("ENOENT");
      }),
    },
  );

  await failed.session.restore();

  expect(failed.events).toMatchObject([
    {
      kind: "error",
      message: "previous session could not be loaded; starting fresh",
    },
  ]);
  expect(failed.session.status).toBe("idle");
  expect(failed.session.sessionId).toBeUndefined();
  failed.session.send("hi");
  await vi.waitFor(() => expect(failed.session.status).toBe("idle"));
  expect(failed.runs[0].options?.resume).toBeUndefined();
  expect(failed.session.sessionId).toBe("new");
});

test("restore keeps every text block when transcript lines share one message id", async () => {
  // Claude Code writes one transcript line per content block, all with the response's id.
  const line = (uuid: string, text: string) => ({
    type: "assistant",
    uuid,
    session_id: "old",
    parent_tool_use_id: null,
    parent_agent_id: null,
    message: { id: "msg_shared", content: [{ type: "text", text }] },
  });
  const saved = [
    line("a1", "First."),
    line("a2", "Second."),
  ] as SessionMessage[];
  const { session } = setup(() => turnsOf(), {
    resumeId: "old",
    getSessionMessages: vi.fn(async () => saved),
  });

  await session.restore();

  expect(session.transcript()).toMatchObject([
    { kind: "assistant_text", id: "a1:0", text: "First." },
    { kind: "assistant_text", id: "a2:0", text: "Second." },
  ]);
});

test("restore shows the CLI's interrupt marker as a stopped result, not a user message", async () => {
  const saved = [
    {
      type: "user",
      uuid: "u1",
      session_id: "old",
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: { role: "user", content: "write an essay" },
    },
    {
      type: "user",
      uuid: "u2",
      session_id: "old",
      parent_tool_use_id: null,
      parent_agent_id: null,
      message: {
        role: "user",
        content: [{ type: "text", text: "[Request interrupted by user]" }],
      },
    },
  ] as SessionMessage[];
  const { session } = setup(() => turnsOf(), {
    resumeId: "old",
    getSessionMessages: vi.fn(async () => saved),
  });

  await session.restore();

  expect(session.transcript()).toMatchObject([
    { kind: "user", id: "u1", text: "write an essay" },
    { kind: "result", id: "u2", subtype: "interrupted", costUsd: null },
  ]);
});

test("interrupt calls query.interrupt and close ends the input stream", async () => {
  const { session, runs, statuses } = setup((_text, turn) =>
    turnsOf(...(turn === 0 ? [init("s")] : []), ...textTurn("m", "x", "r")),
  );

  await session.interrupt();
  expect(runs).toHaveLength(0);

  session.send("go");
  await vi.waitFor(() => expect(session.status).toBe("idle"));
  await session.interrupt();
  expect(runs[0].interrupt).toHaveBeenCalledTimes(1);

  await session.close();

  expect(session.status).toBe("stopped");
  expect(statuses.at(-1)).toEqual(["stopped", undefined]);
  expect(runs[0].close).toHaveBeenCalled();
  await vi.waitFor(() => expect(runs[0].inputEnded).toBe(true));
});

test("an error result after interrupt ends the turn as interrupted, not as an error", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, query, events, statuses } = setup((text, turn) =>
    (async function* () {
      if (turn === 0) yield init("sess-1");
      if (text === "long") {
        yield textTurn("msg_long", "partial answer", "unused")[0];
        await gate;
        yield sdk({
          type: "result",
          subtype: "error_during_execution",
          session_id: "sess-1",
          uuid: "r-stop",
          is_error: true,
          num_turns: 1,
          errors: ["[ede_diagnostic] interrupted"],
          total_cost_usd: 0.02,
          duration_ms: 7,
        } satisfies ErrorFixture);
      } else {
        yield sdk({
          type: "result",
          subtype: "error_max_turns",
          session_id: "sess-1",
          uuid: "r-err",
          is_error: true,
          num_turns: 3,
          errors: ["max turns reached"],
          total_cost_usd: 0.02,
          duration_ms: 1,
        } satisfies ErrorFixture);
      }
    })(),
  );

  session.send("long");
  await vi.waitFor(() => expect(session.status).toBe("working"));
  await session.interrupt();
  release();
  await vi.waitFor(() => expect(session.status).toBe("idle"));

  expect(events.at(-1)).toMatchObject({
    kind: "result",
    id: "r-stop",
    subtype: "interrupted",
    costUsd: 0.02,
    durationMs: 7,
  });
  expect(events.some((e) => e.kind === "error")).toBe(false);
  expect(statuses.some(([s]) => s === "error")).toBe(false);

  // The next turn runs on the same query, and its own error result is still an error.
  session.send("next");
  await vi.waitFor(() => expect(session.status).toBe("error"));
  expect(query).toHaveBeenCalledTimes(1);
  expect(events.at(-1)).toMatchObject({ kind: "error", id: "r-err" });
});

test("interrupt drops the messages still queued, so the SDK never gets them, and reports each as not sent", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const { session, runs, events } = setup((text, turn) =>
    text === "after"
      ? turnsOf(...textTurn("msg_after", "ok", "r-after"))
      : (async function* () {
          if (turn === 0) yield init("sess-1");
          yield textTurn("msg_long", "partial answer", "unused")[0];
          await gate;
          yield sdk({
            type: "result",
            subtype: "error_during_execution",
            session_id: "sess-1",
            uuid: "r-stop",
            is_error: true,
            num_turns: 1,
            errors: ["[ede_diagnostic] interrupted"],
            total_cost_usd: 0.02,
            duration_ms: 7,
          } satisfies ErrorFixture);
        })(),
  );

  session.send("long");
  await vi.waitFor(() => expect(session.status).toBe("working"));
  session.send("two");
  session.send("three");
  // An initialized SDK writes whatever the prompt yields to the CLI at once.
  await new Promise((r) => setTimeout(r, 10));
  expect(runs[0].read).toEqual(["long"]);
  await session.interrupt();

  expect(runs[0].interrupt).toHaveBeenCalledTimes(1);
  expect(
    events.flatMap((e) => (e.kind === "error" ? [e.message] : [])),
  ).toEqual(["Message not sent: stopped", "Message not sent: stopped"]);
  // A send after Stop waits for the stopped turn's result, then runs.
  session.send("after");
  release();
  await vi.waitFor(() =>
    expect(events.at(-1)).toMatchObject({ kind: "result", id: "r-after" }),
  );
  expect(events.filter((e) => e.kind === "result").map((e) => e.id)).toEqual([
    "r-stop",
    "r-after",
  ]);
  expect(runs[0].read).toEqual(["long", "after"]);
  expect(session.status).toBe("idle");
});

test("interrupt while the CLI is still starting closes the run instead of interrupting it", async () => {
  // The CLI never initializes, so it takes no input.
  const { session, query, runs, events, statuses } = setup(() => turnsOf(), {
    readLimit: 0,
  });

  session.send("one");
  expect(session.status).toBe("starting");
  await session.interrupt();

  expect(runs[0].interrupt).not.toHaveBeenCalled();
  expect(runs[0].close).toHaveBeenCalled();
  expect(session.status).toBe("stopped");
  expect(statuses.at(-1)).toEqual(["stopped", undefined]);
  expect(events.at(-1)).toMatchObject({
    kind: "error",
    message: "Message not sent: stopped",
  });

  session.send("again");
  expect(query).toHaveBeenCalledTimes(2);
  expect(session.status).toBe("starting");
  await session.close();
});

test("the transcript keeps the last 500 events", async () => {
  const { session } = setup((_text, turn) =>
    turnsOf(...(turn === 0 ? [init("s")] : [])),
  );
  for (let i = 0; i < 510; i++) session.send(`m${i}`);

  const transcript = session.transcript();
  expect(transcript).toHaveLength(500);
  expect(transcript[0]).toMatchObject({ kind: "user", text: "m10" });
  expect(transcript.at(-1)).toMatchObject({ kind: "user", text: "m509" });
  await session.close();
});
