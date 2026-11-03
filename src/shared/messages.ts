import type { PanelEvent } from "./panel.js";
import type { Proposal } from "./proposals.js";

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
  | {
      type: "split.status";
      state: "running" | "done" | "error";
      message?: string;
      costUsd?: number;
    }
  | { type: "request"; id: string; kind: "board.png"; board: string }
  | { type: "request"; id: string; kind: "selection.snapshot" }
  // Draw the proposal as ghosts (replace: swap out its current ghosts first);
  // the browser answers { elementIds: string[] } or an error string.
  | {
      type: "request";
      id: string;
      kind: "proposal.apply";
      proposal: Proposal;
      replace: boolean;
    };

export type ClientMessage =
  | { type: "response"; id: string; ok: true; payload: unknown }
  | { type: "response"; id: string; ok: false; error: string }
  | { type: "selection.changed"; board: string; ids: string[] };
