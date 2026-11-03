import type {
  SDKMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PanelEvent } from "../../shared/panel.js";

const SUMMARY_LIMIT = 120;

export function summarizeTool(
  name: string,
  input: Record<string, unknown>,
): string {
  switch (name) {
    case "Read":
      return `reading ${input.file_path}`;
    case "Edit":
    case "Write":
    case "MultiEdit":
      return `editing ${input.file_path}`;
    case "Bash":
      return `running \`${String(input.command).slice(0, 60)}\``;
    case "Grep":
    case "Glob":
      return `searching ${input.pattern}`;
    case "ToolSearch":
      return "loading tools";
    case "mcp__blueprint__get_board":
      return "reading the board";
    case "mcp__blueprint__get_selection":
      return "reading the selection";
    case "mcp__blueprint__propose": {
      const n = Array.isArray(input.ops) ? input.ops.length : 0;
      return `proposing ${n} change${n === 1 ? "" : "s"}`;
    }
    case "mcp__blueprint__revise":
      return `revising ${input.proposalId}`;
    default:
      return name;
  }
}

// A failed turn's message, or undefined when it succeeded. The CLI reports auth and API
// failures as a success result flagged is_error, with the message in `result`.
export function resultError(msg: SDKResultMessage): string | undefined {
  if (msg.subtype !== "success") return msg.errors.join("\n");
  return msg.is_error ? msg.result : undefined;
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content.slice(0, SUMMARY_LIMIT);
  const texts = Array.isArray(content)
    ? content.flatMap((part: { type?: string; text?: string }) =>
        part.type === "text" && typeof part.text === "string"
          ? [part.text]
          : [],
      )
    : [];
  return texts.length ? texts.join("\n").slice(0, SUMMARY_LIMIT) : "done";
}

export class SdkEventMapper {
  #sessionId: string | undefined;
  #messageId = "";
  // Text accumulated per content block index of the message being streamed.
  #streamed = new Map<number, string>();
  // Ids of streamed text blocks not yet delivered as a full assistant message, in order.
  #unfinished: string[] = [];

  get sessionId(): string | undefined {
    return this.#sessionId;
  }

  // idBase replaces the message id in a non-streamed text block's event id; restore passes
  // the transcript line's uuid, since lines split from one response share its message id.
  map(msg: SDKMessage, idBase?: string): PanelEvent[] {
    // A subagent's own traffic; its Task tool row already shows that it ran.
    if ("parent_tool_use_id" in msg && msg.parent_tool_use_id) return [];
    const at = new Date().toISOString();
    switch (msg.type) {
      case "system":
        if (msg.subtype === "init") this.#sessionId = msg.session_id;
        return [];
      case "stream_event": {
        const event = msg.event;
        if (event.type === "message_start") {
          this.#messageId = event.message.id;
          this.#streamed.clear();
          this.#unfinished = [];
        } else if (event.type === "content_block_start") {
          this.#streamed.set(event.index, "");
        } else if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const id = `${this.#messageId}:${event.index}`;
          if (!this.#streamed.has(event.index))
            this.#streamed.set(event.index, "");
          const text = this.#streamed.get(event.index) + event.delta.text;
          this.#streamed.set(event.index, text);
          if (!this.#unfinished.includes(id)) this.#unfinished.push(id);
          return [{ kind: "assistant_text", id, text, partial: true, at }];
        }
        return [];
      }
      case "assistant": {
        // With partial messages on, the SDK delivers each finished block as its own assistant
        // message, so a text block takes the id its stream used; otherwise id base + position.
        const events = msg.message.content.flatMap(
          (block, index): PanelEvent[] => {
            if (block.type === "text") {
              const id =
                this.#unfinished.shift() ??
                `${idBase ?? msg.message.id}:${index}`;
              return [
                {
                  kind: "assistant_text",
                  id,
                  text: block.text,
                  partial: false,
                  at,
                },
              ];
            }
            if (block.type === "tool_use") {
              const input = (block.input ?? {}) as Record<string, unknown>;
              const summary = summarizeTool(block.name, input);
              return [
                {
                  kind: "tool_use",
                  id: block.id,
                  tool: block.name,
                  summary,
                  at,
                },
              ];
            }
            return [];
          },
        );
        this.#streamed.clear();
        this.#unfinished = [];
        return events;
      }
      case "user": {
        const content = msg.message.content;
        if (typeof content === "string") return [];
        return content.flatMap((block): PanelEvent[] =>
          block.type === "tool_result"
            ? [
                {
                  kind: "tool_result",
                  id: `${block.tool_use_id}:result`,
                  toolUseId: block.tool_use_id,
                  ok: !block.is_error,
                  summary: resultText(block.content),
                  at,
                },
              ]
            : [],
        );
      }
      case "result": {
        const error = resultError(msg);
        if (error !== undefined)
          return [
            {
              kind: "error",
              id: msg.uuid,
              message: error,
              costUsd: msg.total_cost_usd,
              at,
            },
          ];
        return [
          {
            kind: "result",
            id: msg.uuid,
            subtype: "success",
            costUsd: msg.total_cost_usd,
            durationMs: msg.duration_ms,
            at,
          },
        ];
      }
      default:
        return [];
    }
  }
}
