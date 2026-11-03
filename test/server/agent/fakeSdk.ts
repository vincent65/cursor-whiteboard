import type {
  Options,
  SDKMessage,
  SDKResultError,
  SDKResultSuccess,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export const sdk = (msg: unknown) => msg as SDKMessage;

// Result fixtures typed against the SDK, so a field the session reads cannot be left out.
export type ResultKeys =
  | "type"
  | "subtype"
  | "session_id"
  | "is_error"
  | "num_turns"
  | "duration_ms"
  | "total_cost_usd";
export type SuccessFixture = Pick<SDKResultSuccess, ResultKeys | "result"> & {
  uuid: string;
};
export type ErrorFixture = Pick<SDKResultError, ResultKeys | "errors"> & {
  uuid: string;
};

export const init = (sessionId: string) =>
  sdk({ type: "system", subtype: "init", session_id: sessionId, uuid: "i" });

// One text turn in the order the SDK emits it with partial messages on: the block's deltas,
// then one assistant message for the finished block, then the block and message stops.
export function textTurn(
  msgId: string,
  text: string,
  resultId: string,
): SDKMessage[] {
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

export type Script = (text: string, turn: number) => AsyncIterable<SDKMessage>;

// A fake `query` that reads the prompt iterable in the background, like the SDK does, and
// yields the scripted messages for each user message in order. With readLimit it stops
// reading after that many, like a CLI that has not taken the rest (the SDK writes nothing
// before the CLI is initialized), which stay queued. `read` records every message taken.
export function fakeQuery(
  script: Script,
  endAfter?: number,
  readLimit?: number,
) {
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

export async function* turnsOf(...msgs: SDKMessage[]) {
  yield* msgs;
}
