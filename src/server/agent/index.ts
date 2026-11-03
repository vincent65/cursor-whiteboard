import * as claudeSdk from "@anthropic-ai/claude-agent-sdk";
import { excalidrawToBoardGraph } from "../../export/index.js";
import type { AgentStatus } from "../../shared/messages.js";
import type {
  PanelEvent,
  PendingPermission,
  PermissionDecision,
} from "../../shared/panel.js";
import type { SessionsFile } from "../../shared/types.js";
import type { FileStore } from "../files.js";
import type { WsHub } from "../ws.js";
import { PermissionBroker } from "./broker.js";
import { denyBoardWrites } from "./hooks.js";
import {
  composeUserMessage,
  SYSTEM_PROMPT_APPEND,
  selectionHeader,
} from "./prompt.js";
import { PlanSession } from "./session.js";
import { createBoardTools } from "./tools.js";

export type Agent = {
  // Composes the selection header from the stored board; returns the user event id.
  send(
    text: string,
    selection?: { board: string; ids: string[] },
  ): Promise<string>;
  // Cancels pending permissions, then interrupts the session.
  interrupt(): Promise<void>;
  answerPermission(id: string, d: PermissionDecision): boolean;
  state(): {
    status: AgentStatus;
    message?: string;
    sessionId?: string;
    transcript: PanelEvent[];
    pending: PendingPermission[];
  };
  close(): Promise<void>;
};

const INTERRUPTED = "interrupted";

export async function createAgent(deps: {
  store: FileStore;
  hub: WsHub;
  cwd: string;
  sdk?: Pick<typeof claudeSdk, "query" | "getSessionMessages">;
}): Promise<Agent> {
  const { store, hub, cwd } = deps;
  const sdk = deps.sdk ?? claudeSdk;
  // A corrupt index must not take the server down: start fresh and say so until the first send.
  let loadError: string | undefined;
  const saved = await store.readSessions().catch((err): SessionsFile => {
    loadError = `sessions.json could not be read: ${(err as Error).message}. Fix or delete .blueprint/sessions.json.`;
    return { plan: null, runs: [] };
  });
  let message: string | undefined;

  // The session's own status, overridden while a permission ask waits on the user.
  const status = (): { status: AgentStatus; message?: string } =>
    broker.pending().length > 0
      ? { status: "needs_you" }
      : loadError
        ? { status: "error", message: loadError }
        : { status: session.status, ...(message ? { message } : {}) };
  const broadcastStatus = () =>
    hub.broadcast({ type: "agent.status", ...status() });

  let asked = new Set<string>();
  const broker = new PermissionBroker({
    onChange(pending) {
      for (const p of pending)
        if (!asked.has(p.id))
          hub.broadcast({
            type: "agent.event",
            event: { kind: "permission", ...p },
          });
      asked = new Set(pending.map((p) => p.id));
      broadcastStatus();
    },
  });

  const session = new PlanSession(
    {
      query: sdk.query,
      getSessionMessages: sdk.getSessionMessages,
      cwd,
      options: {
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: SYSTEM_PROMPT_APPEND,
        },
        permissionMode: "default",
        mcpServers: { blueprint: createBoardTools({ store, hub }) },
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit|MultiEdit|NotebookEdit",
              hooks: [denyBoardWrites(cwd)],
            },
          ],
        },
        // Blueprint's own board tools only read, so they never need a dialog. Keyed on the
        // server's source, not the tool name, which a configured server could imitate.
        canUseTool: (
          tool,
          input,
          { signal, suggestions, toolUseID, mcpServer },
        ) =>
          mcpServer?.source === "sdk" && mcpServer.name === "blueprint"
            ? Promise.resolve({ behavior: "allow" })
            : broker.ask({ toolUseID, tool, input, suggestions, signal }),
      },
      onEvent: (event) => hub.broadcast({ type: "agent.event", event }),
      onStatus: (_status, msg) => {
        message = msg;
        broadcastStatus();
      },
      onSessionId: (sessionId) => {
        void store
          .readSessions()
          // Unreadable (the corrupt file reported at startup): overwrite it from what loaded.
          .catch(() => saved)
          .then((s) =>
            store.writeSessions({
              ...s,
              plan: { sessionId, updatedAt: new Date().toISOString() },
            }),
          )
          .catch((err) => console.error("could not save the session id", err));
      },
    },
    saved.plan?.sessionId,
  );
  await session.restore();

  async function header(selection?: { board: string; ids: string[] }) {
    if (!selection || selection.ids.length === 0) return "";
    try {
      const board = await store.readBoard(selection.board);
      const graph = excalidrawToBoardGraph(board, selection.board);
      return selectionHeader(selection.board, graph, selection.ids);
    } catch (err) {
      console.warn(
        `ignoring the selection on board ${selection.board}: ${(err as Error).message}`,
      );
      return "";
    }
  }

  return {
    async send(text, selection) {
      const composed = composeUserMessage(text, await header(selection));
      loadError = undefined;
      return session.send(composed);
    },
    async interrupt() {
      broker.cancelAll(INTERRUPTED);
      await session.interrupt();
    },
    answerPermission: (id, d) => broker.answer(id, d),
    state() {
      return {
        ...status(),
        ...(session.sessionId ? { sessionId: session.sessionId } : {}),
        transcript: session.transcript(),
        pending: broker.pending(),
      };
    },
    async close() {
      broker.cancelAll(INTERRUPTED);
      await session.close();
    },
  };
}
