import type { ServerMessage } from "../shared/messages.js";

type Socket = { send(data: string): void };

export class WsHub {
  private readonly sockets = new Set<Socket>();

  add(socket: Socket): void {
    this.sockets.add(socket);
  }

  remove(socket: Socket): void {
    this.sockets.delete(socket);
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const socket of this.sockets) socket.send(data);
  }

  get size(): number {
    return this.sockets.size;
  }
}
