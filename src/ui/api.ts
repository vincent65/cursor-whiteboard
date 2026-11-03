import type { Citation } from "../export/citations";
import type { BoardFile } from "../export/schema";
import type {
  AgentStatus,
  ClientMessage,
  PanelEvent,
  ServerMessage,
} from "../shared/messages";
import type { PendingPermission, PermissionDecision } from "../shared/panel";
import type { Decision, Proposal } from "../shared/proposals";
import type {
  GateResult,
  LaunchOptions,
  OtherSession,
  RunView,
} from "../shared/runs";
import type { TaskFile } from "../shared/tasks";
import type { IncomingScene, RunRecord } from "../shared/types";

export type Entry = { name: string; updatedAt: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(
      body?.error ?? `${init?.method ?? "GET"} ${path}: ${res.status}`,
      res.status,
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

// Unknown citations are cut from the served text and listed in `dropped`;
// `labels` names each kept citation that has a label, by its citationKey.
export const getSpec = async (): Promise<{
  text: string | null;
  dropped: Citation[];
  labels: Record<string, string>;
}> => (await request("/spec")).json();

export const listTasks = async (): Promise<TaskFile[]> =>
  (await request("/tasks")).json();

// Board files store assets as "assets/<sha256>.<ext>", served under /api.
export const assetUrl = (asset: string): string => `/api/${asset}`;

export type AgentState = {
  status: AgentStatus;
  message?: string;
  sessionId?: string;
  transcript: PanelEvent[];
  pending: PendingPermission[];
  splitting: boolean;
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

// Starts a compile turn in the plan session; returns the user event id.
export const agentCompile = async (): Promise<{ id: string }> =>
  (await request("/agent/compile", { method: "POST" })).json();

// Throws the server's message when there is no spec (404) or a split is
// already running (409).
export async function agentSplit(): Promise<void> {
  await request("/agent/split", { method: "POST" });
}

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

export const listRuns = async (): Promise<RunView[]> =>
  (await request("/runs")).json();

// A failed gate without override throws the server's 409 message.
export const launchRun = async (
  body: LaunchOptions & { override?: boolean },
): Promise<RunRecord> =>
  (await request("/runs", { method: "POST", ...json(body) })).json();

const runPath = (id: string) => `/runs/${encodeURIComponent(id)}`;

// Returns the user event id.
export const runMessage = async (id: string, text: string): Promise<string> => {
  const res = await request(`${runPath(id)}/message`, {
    method: "POST",
    ...json({ text }),
  });
  return ((await res.json()) as { id: string }).id;
};

export async function runStop(id: string): Promise<void> {
  await request(`${runPath(id)}/stop`, { method: "POST" });
}

export async function runResume(id: string): Promise<void> {
  await request(`${runPath(id)}/resume`, { method: "POST" });
}

export async function runDone(id: string): Promise<void> {
  await request(`${runPath(id)}/done`, { method: "POST" });
}

export async function runPermission(
  id: string,
  permissionId: string,
  decision: PermissionDecision,
): Promise<void> {
  await request(`${runPath(id)}/permission`, {
    method: "POST",
    ...json({ id: permissionId, ...decision }),
  });
}

export const runTranscript = async (id: string): Promise<PanelEvent[]> =>
  (await request(`${runPath(id)}/transcript`)).json();

export const gate = async (slug: string): Promise<GateResult> =>
  (await request(`/runs/gate/${encodeURIComponent(slug)}`)).json();

// The repository's sessions that Blueprint did not start, newest first.
export const listSessions = async (): Promise<OtherSession[]> =>
  (await request("/sessions")).json();

export const sessionTranscript = async (id: string): Promise<PanelEvent[]> =>
  (await request(`/sessions/${encodeURIComponent(id)}/transcript`)).json();

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
