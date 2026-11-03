import type { BoardFile } from "../export/schema";
import type { ClientMessage, ServerMessage } from "../shared/messages";
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

// Frames sent while the socket is not open wait for the next one to open.
// By then the server that asked for queued responses is gone, and only the
// newest selection still matters.
export function connectWs(onMessage: (m: ServerMessage) => void): {
  send(m: ClientMessage): void;
  close(): void;
} {
  let socket: WebSocket | null = null;
  let queue: ClientMessage[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = 500;
  let closed = false;

  const open = () => {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}/ws`);
    socket = ws;
    ws.onopen = () => {
      delay = 500;
      const selection = queue
        .filter((m) => m.type === "selection.changed")
        .at(-1);
      for (const m of queue)
        if (
          m.type === "selection.changed"
            ? m === selection
            : m.type !== "response"
        )
          ws.send(JSON.stringify(m));
      queue = [];
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
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
      else queue.push(m);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
