import { realpathSync } from "node:fs";
import { sep } from "node:path";
import type {
  SDKMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PanelEvent } from "../../shared/panel.js";

const SUMMARY_LIMIT = 120;

type Relativize = (text: string) => string;

// Strips the session directory from the paths in a row, so it reads `editing src/a.ts`.
// Both spellings count: macOS reports a temp directory under /var as /private/var.
export function relativeTo(cwd: string | undefined): Relativize {
  if (!cwd) return (text) => text;
  let real = cwd;
  try {
    real = realpathSync(cwd);
  } catch {}
  // Longest first, so /var/x/ never cuts into /private/var/x/.
  const roots = [...new Set([cwd, real])]
    .map((root) => (root.endsWith(sep) ? root : root + sep))
    .sort((a, b) => b.length - a.length);
  return (text) => roots.reduce((t, root) => t.replaceAll(root, ""), text);
}

export function summarizeTool(
  name: string,
  input: Record<string, unknown>,
  relativize: Relativize = (text) => text,
): string {
  return relativize(summarize(name, input));
}

function summarize(name: string, input: Record<string, unknown>): string {
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
  if (typeof content === "string") return content;
  const texts = Array.isArray(content)
    ? content.flatMap((part: { type?: string; text?: string }) =>
        part.type === "text" && typeof part.text === "string"
          ? [part.text]
          : [],
      )
    : [];
  return texts.length ? texts.join("\n") : "done";
}

// Blueprint's own tools answer in a sentence rather than their raw output.
function ownResult(tool: string | undefined, text: string): string | undefined {
  switch (tool) {
    case "mcp__blueprint__get_board":
      return "read the board";
    case "mcp__blueprint__get_selection":
      return "read the selection";
    case "mcp__blueprint__propose":
    case "mcp__blueprint__revise": {
      const id = /"proposalId":"([^"]+)"/.exec(text)?.[1];
      return id && `proposal ${id} is on the board`;
    }
  }
}

export class SdkEventMapper {
  #sessionId: string | undefined;
  #messageId = "";
  // Text accumulated per content block index of the message being streamed.
  #streamed = new Map<number, string>();
  // Ids of streamed text blocks not yet delivered as a full assistant message, in order.
  #unfinished: string[] = [];
  // Tool names by tool_use id, so a result can be read in its tool's terms.
  #tools = new Map<string, string>();
  #relativize: Relativize;

  // cwd: the session's directory, which rows leave out of the paths they show.
  constructor(cwd?: string) {
    this.#relativize = relativeTo(cwd);
  }

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
              const summary = summarizeTool(
                block.name,
                input,
                this.#relativize,
              );
              this.#tools.set(block.id, block.name);
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
        return content.flatMap((block): PanelEvent[] => {
          if (block.type !== "tool_result") return [];
          const text = this.#relativize(resultText(block.content)).slice(
            0,
            SUMMARY_LIMIT,
          );
          const tool = this.#tools.get(block.tool_use_id);
          return [
            {
              kind: "tool_result",
              id: `${block.tool_use_id}:result`,
              toolUseId: block.tool_use_id,
              ok: !block.is_error,
              summary: (!block.is_error && ownResult(tool, text)) || text,
              at,
            },
          ];
        });
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
