import { randomUUID } from "node:crypto";
import type { ClientMessage, ServerMessage } from "../shared/messages.js";

type Socket = { send(data: string): void };
// Omit distributed over the union, so each request kind keeps its own fields.
type RequestBody =
  Extract<ServerMessage, { type: "request" }> extends infer R
    ? R extends unknown
      ? Omit<R, "id" | "type">
      : never
    : never;
type Pending = {
  socket: Socket;
  resolve(payload: unknown): void;
  reject(err: Error): void;
};

export class WsHub {
  private readonly sockets = new Set<Socket>();
  private readonly listeners = new Set<
    (msg: ClientMessage, socket: Socket) => void
  >();
  private readonly pending = new Map<string, Pending>();
  private active: Socket | null = null;
  // The board named by the last selection.changed from the active tab; an
  // empty name means the tab closed its board.
  activeBoard: string | null = null;

  add(socket: Socket): void {
    this.sockets.add(socket);
  }

  remove(socket: Socket): void {
    this.sockets.delete(socket);
    if (this.active === socket) {
      this.active = null;
      this.activeBoard = null;
    }
    for (const p of this.pending.values()) {
      if (p.socket === socket)
        p.reject(new Error("the browser tab disconnected"));
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const socket of this.sockets) socket.send(data);
  }

  get size(): number {
    return this.sockets.size;
  }

  handle(socket: Socket, raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg?.type === "response") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.ok) p.resolve(msg.payload);
      else p.reject(new Error(msg.error));
    } else if (msg?.type === "selection.changed") {
      this.active = socket;
      this.activeBoard = msg.board || null;
    } else {
      return;
    }
    for (const fn of this.listeners) fn(msg, socket);
  }

  onClient(fn: (msg: ClientMessage, socket: Socket) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  request<T>(body: RequestBody, opts?: { timeoutMs?: number }): Promise<T> {
    // Sets iterate in insertion order, so the last one is the newest.
    const socket = this.active ?? [...this.sockets].at(-1);
    if (!socket) {
      return Promise.reject(new Error("no browser tab is connected"));
    }
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          settle(() => reject(new Error("the browser did not answer in time"))),
        opts?.timeoutMs ?? 10_000,
      );
      const settle = (fn: () => void) => {
        clearTimeout(timer);
        this.pending.delete(id);
        fn();
      };
      this.pending.set(id, {
        socket,
        resolve: (payload) => settle(() => resolve(payload as T)),
        reject: (err) => settle(() => reject(err)),
      });
      socket.send(JSON.stringify({ ...body, type: "request", id }));
    });
  }
}
