import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type {
  getSessionMessages,
  listSessions,
  McpServerConfig,
  PermissionResult,
  Query,
  query,
  SDKMessage,
  SDKUserMessage,
  SessionMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { excalidrawToBoardGraph } from "../../export/index.js";
import { FileStore } from "../files.js";
import { DEFAULT_COST_USD, loadScenario, type Step } from "./scenario.js";

export type FakeSdk = {
  query: typeof query;
  getSessionMessages: typeof getSessionMessages;
  listSessions: typeof listSessions;
};

type ToolResult = { content: unknown; is_error: boolean };
const ok = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  is_error: false,
});
const failed = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  is_error: true,
});

// The CLI reaches an SDK server's tools over MCP; the fake calls them directly, through the
// server's tool registry, which is private.
type Registered = {
  inputSchema?: z.ZodType;
  handler(
    args: unknown,
    extra: unknown,
  ): Promise<{ content: unknown; isError?: boolean }>;
};
function toolsOf(server: McpServerConfig | undefined) {
  if (!server || !("instance" in server)) return {};
  return (
    server.instance as unknown as {
      _registeredTools: Record<string, Registered>;
    }
  )._registeredTools;
}

const FIRST_NODE = /\{\{board:([^:}]+):first\}\}/g;

// Fills each {{board:<name>:first}} with the id of that board's first labelled shape
// under cwd, so a scenario can cite a board the user drew; one it cannot resolve stays.
async function fillBoards(cwd: string, text: string): Promise<string> {
  const store = new FileStore(cwd);
  const ids = new Map<string, string | undefined>();
  for (const [, name] of text.matchAll(FIRST_NODE)) {
    if (ids.has(name)) continue;
    const board = await store.readBoard(name).catch(() => undefined);
    const nodes = board ? excalidrawToBoardGraph(board, name).nodes : [];
    ids.set(name, nodes.find((n) => n.label.trim())?.id);
  }
  return text.replace(FIRST_NODE, (all, name) => ids.get(name) ?? all);
}

const textOf = (content: SDKUserMessage["message"]["content"]) =>
  typeof content === "string"
    ? content
    : content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");

// The Agent SDK's query, getSessionMessages, and listSessions, replaying the scenario at
// scenarioPath (read once, here) instead of running Claude. Sessions live in this process.
export function createFakeSdk(scenarioPath: string): FakeSdk {
  const scenario = loadScenario(scenarioPath);
  // Each session's conversation, as getSessionMessages returns it.
  const sessions = new Map<string, SessionMessage[]>();

  function fakeQuery({
    prompt,
    options = {},
  }: Parameters<typeof query>[0]): Query {
    // The turn in flight, aborted by interrupt or close.
    let turn: AbortController | undefined;
    let closed = false;

    async function* messages(): AsyncGenerator<SDKMessage, void> {
      const { resume } = options;
      if (resume !== undefined && !sessions.has(resume))
        throw new Error(`No conversation found with session ID: ${resume}`);
      const sessionId = resume ?? randomUUID();
      const saved = sessions.get(sessionId) ?? [];
      sessions.set(sessionId, saved);
      const cwd = options.cwd ?? process.cwd();
      const kind = options.outputFormat
        ? "split"
        : options.mcpServers?.blueprint
          ? "plan"
          : "run";
      // The query's running total, as each result reports it.
      let cost = 0;

      // Stamps a message with the session, saving the conversation's own.
      const out = (msg: Record<string, unknown>): SDKMessage => {
        const stamped = { ...msg, uuid: randomUUID(), session_id: sessionId };
        if (msg.type === "user" || msg.type === "assistant")
          saved.push({
            ...stamped,
            parent_tool_use_id: null,
            parent_agent_id: null,
            timestamp: new Date().toISOString(),
          } as unknown as SessionMessage);
        return stamped as unknown as SDKMessage;
      };
      const userMsg = (content: unknown) => ({
        type: "user",
        parent_tool_use_id: null,
        message: { role: "user", content },
      });
      const assistant = (content: unknown[]) =>
        out({
          type: "assistant",
          parent_tool_use_id: null,
          message: { id: `msg_${randomUUID()}`, role: "assistant", content },
        });
      const result = (subtype: string, extra: Record<string, unknown>) =>
        out({
          type: "result",
          subtype,
          is_error: subtype !== "success",
          num_turns: 1,
          duration_ms: 0,
          total_cost_usd: cost,
          ...extra,
        });
      const stream = (event: unknown) =>
        out({ type: "stream_event", parent_tool_use_id: null, event });

      // One text block, streamed first when partial messages are on, as the SDK does.
      function* say(text: string): Generator<SDKMessage> {
        const partial = options.includePartialMessages === true;
        if (partial) {
          yield stream({
            type: "message_start",
            message: { id: `msg_${randomUUID()}` },
          });
          yield stream({
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
          });
          yield stream({
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text },
          });
        }
        yield assistant([{ type: "text", text }]);
        if (partial) {
          yield stream({ type: "content_block_stop", index: 0 });
          yield stream({ type: "message_stop" });
        }
      }

      async function callTool(
        name: string,
        input: Record<string, unknown>,
      ): Promise<ToolResult> {
        const registered = toolsOf(options.mcpServers?.blueprint)[name];
        if (!registered) return failed(`no blueprint tool named ${name}`);
        // The MCP server parses the input before its handler sees it.
        const args = registered.inputSchema
          ? registered.inputSchema.safeParse(input)
          : { success: true as const, data: input };
        if (!args.success)
          return failed(
            `invalid input for ${name}: ${z.prettifyError(args.error)}`,
          );
        try {
          const r = await registered.handler(args.data, {});
          return { content: r.content, is_error: r.isError === true };
        } catch (err) {
          return failed((err as Error).message);
        }
      }

      async function write(path: string, content: string): Promise<ToolResult> {
        const rel = relative(cwd, path);
        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
          return failed(`${path} is outside the session directory ${cwd}`);
        try {
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, content);
          return ok(`File created successfully at: ${path}`);
        } catch (err) {
          return failed((err as Error).message);
        }
      }

      async function ask(
        tool: string,
        input: Record<string, unknown>,
        toolUseID: string,
        ac: AbortController,
      ): Promise<ToolResult> {
        const { signal } = ac;
        if (signal.aborted) return failed("interrupted");
        if (!options.canUseTool)
          return failed(`no canUseTool to ask about ${tool}`);
        const aborted = new Promise<PermissionResult | null>((done) =>
          signal.addEventListener(
            "abort",
            () => done({ behavior: "deny", message: "interrupted" }),
            { once: true },
          ),
        );
        const decision = await Promise.race([
          options.canUseTool(tool, input, {
            signal,
            toolUseID,
            requestId: randomUUID(),
            suggestions: [],
          }),
          aborted,
        ]).catch(
          (err): PermissionResult => ({
            behavior: "deny",
            message: (err as Error).message,
          }),
        );
        if (decision?.behavior === "allow") return ok(`${tool} was allowed`);
        if (decision?.interrupt) ac.abort();
        return failed(decision?.message ?? `${tool} was not allowed`);
      }

      // A tool_use, what it does, and its result.
      async function* use(
        step: Exclude<Step, { do: "say" }>,
        ac: AbortController,
      ): AsyncGenerator<SDKMessage> {
        const id = `toolu_${randomUUID()}`;
        const path = step.do === "write" ? resolve(cwd, step.path) : "";
        const content =
          step.do === "write" ? await fillBoards(cwd, step.content) : "";
        const [name, input] =
          step.do === "tool"
            ? [`mcp__blueprint__${step.name}`, step.input]
            : step.do === "write"
              ? ["Write", { file_path: path, content }]
              : [step.tool, step.input];
        yield assistant([{ type: "tool_use", id, name, input }]);
        const r =
          step.do === "tool"
            ? await callTool(step.name, step.input)
            : step.do === "write"
              ? await write(path, content)
              : await ask(step.tool, step.input, id, ac);
        yield out(
          userMsg([
            {
              type: "tool_result",
              tool_use_id: id,
              content: r.content,
              is_error: r.is_error,
            },
          ]),
        );
      }

      yield out({ type: "system", subtype: "init", cwd });
      const inputs =
        typeof prompt === "string"
          ? [userMsg(prompt) as SDKUserMessage]
          : prompt;
      for await (const input of inputs) {
        if (closed) return;
        const text = textOf(input.message.content);
        out(userMsg(text));
        if (kind === "split") {
          cost += DEFAULT_COST_USD;
          yield result("success", {
            result: "",
            structured_output: scenario.split,
          });
          continue;
        }
        const rule = scenario[kind].find((r) => new RegExp(r.match).test(text));
        if (!rule) {
          yield result("error_during_execution", {
            errors: [
              `no ${kind} rule matches this message in the fake SDK scenario`,
            ],
          });
          continue;
        }
        const ac = new AbortController();
        turn = ac;
        let said = "";
        for (const step of rule.steps) {
          if (ac.signal.aborted) break;
          if (step.do === "say") {
            said = step.text;
            yield* say(step.text);
          } else yield* use(step, ac);
        }
        turn = undefined;
        if (ac.signal.aborted) {
          // The CLI saves a Stop as this user message.
          out(userMsg("[Request interrupted by user]"));
          yield result("error_during_execution", { errors: [] });
        } else {
          cost += rule.costUsd;
          yield result("success", { result: said });
        }
      }
    }

    return Object.assign(messages(), {
      interrupt: async () => {
        turn?.abort();
        return undefined;
      },
      close: () => {
        closed = true;
        turn?.abort();
      },
    }) as unknown as Query;
  }

  return {
    query: fakeQuery,
    getSessionMessages: async (id) => [...(sessions.get(id) ?? [])],
    listSessions: async () => [],
  };
}
