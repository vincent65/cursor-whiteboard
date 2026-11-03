import type { PanelEvent } from "./panel.js";

export type { PanelEvent } from "./panel.js";

export type AgentStatus =
  | "starting"
  | "idle"
  | "working"
  | "needs_you"
  | "error"
  | "stopped";

export type ServerMessage =
  | { type: "file-changed"; kind: "board" | "doc"; name: string }
  | { type: "agent.event"; event: PanelEvent }
  | { type: "agent.status"; status: AgentStatus; message?: string }
  | { type: "request"; id: string; kind: "board.png"; board: string }
  | { type: "request"; id: string; kind: "selection.snapshot" };

export type ClientMessage =
  | { type: "response"; id: string; ok: true; payload: unknown }
  | { type: "response"; id: string; ok: false; error: string }
  | { type: "selection.changed"; board: string; ids: string[] };
