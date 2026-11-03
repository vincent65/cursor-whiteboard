import * as claudeSdk from "@anthropic-ai/claude-agent-sdk";
import { excalidrawToBoardGraph } from "../../export/index.js";
import type { AgentStatus } from "../../shared/messages.js";
import type {
  PanelEvent,
  PendingPermission,
  PermissionDecision,
} from "../../shared/panel.js";
import type { Decision, Proposal } from "../../shared/proposals.js";
import type { SessionsFile } from "../../shared/types.js";
import { type FileStore, NotFoundError } from "../files.js";
import type { WsHub } from "../ws.js";
import { PermissionBroker } from "./broker.js";
import { denyBoardWrites } from "./hooks.js";
import {
  COMPILE_INSTRUCTION,
  composeUserMessage,
  SYSTEM_PROMPT_APPEND,
  selectionHeader,
} from "./prompt.js";
import { ProposalStore } from "./proposals.js";
import { PlanSession } from "./session.js";
import { createBoardTools } from "./tools.js";

export type Agent = {
  // Prefixes decision notes, a refine request for proposalId (NotFoundError unless it is
  // pending), and the selection header from the stored board; returns the user event id.
  send(
    text: string,
    selection?: { board: string; ids: string[] },
    proposalId?: string,
  ): Promise<string>;
  // Sends COMPILE_INSTRUCTION as a send; while that one is queued or running (until the
  // next result), returns its id without sending again.
  compile(): Promise<string>;
  // Reconciled against each saved board by PUT /boards/:name.
  proposals: ProposalStore;
  pendingProposals(): Proposal[];
  // NotFoundError unless pending; ProposalBusyError while it is being revised.
  decideProposal(id: string, decision: Decision): Promise<Proposal>;
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
  // The proposal store's clock; tests inject one.
  clock?: () => number;
}): Promise<Agent> {
  const { store, hub, cwd } = deps;
  const sdk = deps.sdk ?? claudeSdk;
  // A corrupt index or log must not take the server down: start fresh and say so until the
  // first send. Appends to a torn log still land; the next start reports it again.
  let loadErrors: string[] = [];
  const saved = await store.readSessions().catch((err): SessionsFile => {
    loadErrors.push(
      `sessions.json could not be read: ${(err as Error).message}. Fix or delete .blueprint/sessions.json.`,
    );
    return { plan: null, runs: [] };
  });
  const proposals = new ProposalStore(store, deps.clock);
  await proposals.load().catch((err) => {
    loadErrors.push(
      `proposals.jsonl could not be read: ${(err as Error).message}. Fix or delete .blueprint/proposals.jsonl.`,
    );
  });
  let message: string | undefined;

  // The session's own status, overridden while a permission ask waits on the user.
  const status = (): { status: AgentStatus; message?: string } =>
    broker.pending().length > 0
      ? { status: "needs_you" }
      : loadErrors.length > 0
        ? { status: "error", message: loadErrors.join(" ") }
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

  // Decision notes taken for each send, by its user event id, until its turn ends; a send
  // the session drops (Stop, run ended) hands them back for the next one. Each turn ends
  // with one result, in send order, so a result retires the oldest entry.
  // ponytail: a turn cut off with no result keeps its entry until the next result, so
  // entries retire a turn late from then on; harmless, as only dropped ids hand notes back.
  const riding = new Map<string, string[]>();
  // The compile queued or running, until the next result or the run ending without one.
  let compiling: Promise<string> | undefined;

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
        mcpServers: { blueprint: createBoardTools({ store, hub, proposals }) },
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit|MultiEdit|NotebookEdit",
              hooks: [denyBoardWrites(cwd)],
            },
          ],
        },
        // Blueprint's own board tools only read or draw ghosts the user must accept, so they
        // never need a dialog. Keyed on the server's source, not the tool name, which a
        // configured server could imitate.
        canUseTool: (
          tool,
          input,
          { signal, suggestions, toolUseID, mcpServer },
        ) =>
          mcpServer?.source === "sdk" && mcpServer.name === "blueprint"
            ? Promise.resolve({ behavior: "allow" })
            : broker.ask({ toolUseID, tool, input, suggestions, signal }),
      },
      onEvent: (event) => {
        if (event.kind === "result") {
          // ponytail: any result clears it, so a compile held behind another turn can be
          // sent twice; harmless, the second just rewrites spec.md.
          compiling = undefined;
          const oldest = riding.keys().next();
          if (!oldest.done) riding.delete(oldest.value);
        }
        hub.broadcast({ type: "agent.event", event });
      },
      onNotSent: (sendId) => {
        const notes = riding.get(sendId);
        riding.delete(sendId);
        if (notes) proposals.requeueNotes(notes);
      },
      onStatus: (s, msg) => {
        if (s === "error" || s === "stopped") compiling = undefined;
        message = msg;
        broadcastStatus();
      },
      onSessionId: (sessionId) => {
        // ponytail: unserialized read-modify-write, safe while the plan session is the only
        // writer; serialize through a promise chain once run sessions write the file too.
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

  async function send(
    text: string,
    selection?: { board: string; ids: string[] },
    proposalId?: string,
    shown = text,
  ): Promise<string> {
    const head = await header(selection);
    // From here on nothing awaits, so a decision cannot slip between the check and the
    // send; checked before the notes are taken, so a refused send loses none.
    const refining =
      proposalId === undefined ? undefined : proposals.get(proposalId);
    if (proposalId !== undefined && !refining)
      throw new NotFoundError(`proposal ${proposalId} is not pending`);
    const notes = proposals.takeNotes();
    // The ops ride along, so a session that lost its context can still revise.
    const refine = refining
      ? [
          `[The user wants proposal ${refining.id} refined. Call revise with proposalId ${refining.id} and the complete new op list. Its current ops are: ${JSON.stringify(refining.ops)}]`,
        ]
      : [];
    loadErrors = [];
    let id: string;
    try {
      id = session.send(
        composeUserMessage(text, head, [...notes, ...refine]),
        shown,
      );
    } catch (err) {
      proposals.requeueNotes(notes);
      throw err;
    }
    riding.set(id, notes);
    return id;
  }

  return {
    send: (text, selection, proposalId) => send(text, selection, proposalId),
    compile() {
      // Kept as a promise so a compile racing this one's send gets the same id.
      compiling ??= send(
        COMPILE_INSTRUCTION,
        undefined,
        undefined,
        "Compile the plan into spec.md",
      ).catch((err) => {
        compiling = undefined;
        throw err;
      });
      return compiling;
    },
    proposals,
    pendingProposals: () => proposals.pending(),
    decideProposal: (id, decision) => proposals.decided(id, decision),
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
