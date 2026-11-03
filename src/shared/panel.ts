export type PanelEvent =
  | { kind: "user"; id: string; text: string; at: string }
  | {
      kind: "assistant_text";
      id: string;
      text: string;
      partial: boolean;
      at: string;
    }
  | { kind: "tool_use"; id: string; tool: string; summary: string; at: string }
  | {
      kind: "tool_result";
      id: string;
      toolUseId: string;
      ok: boolean;
      summary: string;
      at: string;
    }
  | {
      kind: "permission";
      id: string;
      tool: string;
      summary: string;
      at: string;
    }
  | {
      kind: "result";
      id: string;
      subtype: string;
      costUsd: number | null;
      durationMs: number;
      at: string;
    }
  | { kind: "error"; id: string; message: string; at: string };

export type PermissionDecision = {
  behavior: "allow" | "deny" | "always";
  message?: string;
};
export type PendingPermission = {
  id: string;
  tool: string;
  summary: string;
  at: string;
};
