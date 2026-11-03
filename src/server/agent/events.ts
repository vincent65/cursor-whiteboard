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

// full: the command verbatim, for an ask, which must show exactly what it would allow;
// a row may cut it short and drop the session directory from its paths.
export function summarizeTool(
  name: string,
  input: Record<string, unknown>,
  relativize: Relativize = (text) => text,
  full = false,
): string {
  const summary = summarize(name, input, full);
  return full && name === "Bash" ? summary : relativize(summary);
}

function summarize(
  name: string,
  input: Record<string, unknown>,
  full: boolean,
): string {
  switch (name) {
    case "Read":
      return `reading ${input.file_path}`;
    case "Edit":
    case "Write":
    case "MultiEdit":
      return `editing ${input.file_path}`;
    case "Bash":
      return `running ${full ? input.command : String(input.command).slice(0, 60)}`;
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
      return `revising ${proposalName(input)}`;
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

type Part = { type?: string; text?: string; tool_name?: string };
const parts = (content: unknown): Part[] =>
  Array.isArray(content) ? content : [];

// A result's text, or what came back when it has none.
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  const texts = parts(content).flatMap((part) =>
    part.type === "text" && typeof part.text === "string" ? [part.text] : [],
  );
  if (texts.length) return texts.join("\n");
  return parts(content).some((part) => part.type === "image")
    ? "returned an image"
    : "finished with no output";
}

// A proposal by its title; its id means nothing to the user.
const proposalName = (input: Record<string, unknown>): string =>
  typeof input.title === "string" ? `"${input.title}"` : "the proposal";

// An MCP tool by its own name, without the mcp__<server>__ prefix.
const bareName = (tool: string): string => tool.replace(/^mcp__.+?__/, "");
const and = new Intl.ListFormat("en", { type: "conjunction" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type ToolUse = { name: string; input: Record<string, unknown> };

// Results that read better as a sentence than as their raw output, from the whole
// result: Blueprint's own tools, Read's numbered lines, and ToolSearch's tool list.
function readableResult(
  use: ToolUse | undefined,
  content: unknown,
  text: string,
): string | undefined {
  switch (use?.name) {
    case "Read": {
      const lines = text.match(/^ *\d+\t/gm)?.length ?? 0;
      return lines > 0 ? `read ${plural(lines, "line")}` : undefined;
    }
    case "ToolSearch": {
      const tools = parts(content).flatMap((part) =>
        part.type === "tool_reference" && typeof part.tool_name === "string"
          ? [bareName(part.tool_name)]
          : [],
      );
      return tools.length > 0
        ? `loaded the ${and.format(tools)} tool${tools.length === 1 ? "" : "s"}`
        : undefined;
    }
    case "mcp__blueprint__get_board":
      return "read the board";
    case "mcp__blueprint__get_selection":
      return "read the selection";
    case "mcp__blueprint__propose":
    case "mcp__blueprint__revise": {
      if (!/"proposalId":"[^"]+"/.test(text)) return undefined;
      const drawn =
        use.name === "mcp__blueprint__propose" ? "drawn" : "redrawn";
      return `${proposalName(use.input)} is ${drawn} as ghosts for you to accept or reject`;
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
  // Tool names and inputs by tool_use id, so a result can be read in its tool's terms.
  #tools = new Map<string, ToolUse>();
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
              this.#tools.set(block.id, { name: block.name, input });
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
          // Read whole, before the row cuts it short.
          const text = resultText(block.content);
          const use = this.#tools.get(block.tool_use_id);
          const summary =
            (!block.is_error && readableResult(use, block.content, text)) ||
            this.#relativize(text).slice(0, SUMMARY_LIMIT);
          return [
            {
              kind: "tool_result",
              id: `${block.tool_use_id}:result`,
              toolUseId: block.tool_use_id,
              ok: !block.is_error,
              summary,
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
