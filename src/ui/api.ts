import type { BoardFile } from "../export/schema";
import type {
  AgentStatus,
  ClientMessage,
  PanelEvent,
  ServerMessage,
} from "../shared/messages";
import type { PendingPermission, PermissionDecision } from "../shared/panel";
import type { Decision, Proposal } from "../shared/proposals";
import type { IncomingScene } from "../shared/types";

export type Entry = { name: string; updatedAt: string };

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `${init?.method ?? "GET"} ${path}: ${res.status}`,
    );
  }
  return res;
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listBoards = async (): Promise<Entry[]> =>
  (await request("/boards")).json();

export const createBoard = async (name: string): Promise<BoardFile> =>
  (await request("/boards", { method: "POST", ...json({ name }) })).json();

export const getBoard = async (name: string): Promise<BoardFile> =>
  (await request(`/boards/${name}`)).json();

export const saveBoard = async (
  name: string,
  scene: IncomingScene,
): Promise<BoardFile> =>
  (await request(`/boards/${name}`, { method: "PUT", ...json(scene) })).json();

export async function uploadBoardPng(name: string, blob: Blob): Promise<void> {
  await request(`/boards/${name}/png`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
}

export const listDocs = async (): Promise<Entry[]> =>
  (await request("/docs")).json();

export async function createDoc(name: string): Promise<void> {
  await request("/docs", { method: "POST", ...json({ name }) });
}

export const getDoc = async (name: string): Promise<string> =>
  (await request(`/docs/${name}`)).text();

export async function saveDoc(name: string, text: string): Promise<void> {
  await request(`/docs/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
    body: text,
  });
}

// Board files store assets as "assets/<sha256>.<ext>", served under /api.
export const assetUrl = (asset: string): string => `/api/${asset}`;

export type AgentState = {
  status: AgentStatus;
  message?: string;
  sessionId?: string;
  transcript: PanelEvent[];
  pending: PendingPermission[];
};

// The server composes the selection header from the stored board, so only
// the board and ids travel. A proposalId asks Claude to refine that pending
// proposal. Returns the user event id.
export const agentSend = async (
  text: string,
  selection?: { board: string; ids: string[] },
  proposalId?: string,
): Promise<string> => {
  const body = {
    text,
    ...(selection
      ? { selection: { board: selection.board, ids: selection.ids } }
      : {}),
    ...(proposalId !== undefined ? { proposalId } : {}),
  };
  const res = await request("/agent/send", { method: "POST", ...json(body) });
  return ((await res.json()) as { id: string }).id;
};

export async function agentInterrupt(): Promise<void> {
  await request("/agent/interrupt", { method: "POST" });
}

export async function agentPermission(
  id: string,
  decision: PermissionDecision,
): Promise<void> {
  await request("/agent/permission", {
    method: "POST",
    ...json({ id, ...decision }),
  });
}

export const listProposals = async (): Promise<Proposal[]> =>
  (await request("/agent/proposals")).json();

export async function decideProposal(
  id: string,
  decision: Decision,
): Promise<void> {
  await request(`/agent/proposals/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    ...json({ decision }),
  });
}

export const agentState = async (): Promise<AgentState> =>
  (await request("/agent/state")).json();

// Frames sent while the socket is not open wait for the next one to open.
// By then the server that asked for queued responses is gone. The newest
// selection goes out on every open, since a restarted server has forgotten it;
// an empty board name means the board closed, so there is nothing to resend.
export function connectWs(onMessage: (m: ServerMessage) => void): {
  send(m: ClientMessage): void;
  close(): void;
} {
  let socket: WebSocket | null = null;
  let queue: ClientMessage[] = [];
  let selection: ClientMessage | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = 500;
  let closed = false;

  const open = () => {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/ws`);
    socket = ws;
    ws.onopen = () => {
      delay = 500;
      for (const m of queue)
        if (m.type !== "response" && m.type !== "selection.changed")
          ws.send(JSON.stringify(m));
      queue = [];
      if (selection) ws.send(JSON.stringify(selection));
    };
    ws.onmessage = (ev) => onMessage(JSON.parse(String(ev.data)));
    ws.onclose = () => {
      if (closed) return;
      timer = setTimeout(open, delay);
      delay = Math.min(delay * 2, 10_000);
    };
  };
  open();

  return {
    send(m) {
      if (m.type === "selection.changed") selection = m.board ? m : null;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
      else queue.push(m);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      // Closing a socket that is still connecting makes the browser warn
      // (StrictMode does it on every dev mount), so wait for it to open.
      const s = socket;
      if (s?.readyState === WebSocket.CONNECTING) s.onopen = () => s.close();
      else s?.close();
    },
  };
}
