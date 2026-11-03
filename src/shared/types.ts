export const APP_NAME = "Blueprint";

export type IncomingFile = {
  id: string;
  mimeType: string;
  created: number;
  dataURL?: string;
  asset?: string;
};
export type IncomingScene = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, IncomingFile>;
};

export type RunStatus =
  | "working"
  | "needs_you"
  | "idle"
  | "done"
  | "failed"
  | "interrupted";
export type RunRecord = {
  id: string;
  taskSlug: string;
  sessionId: string;
  worktree: string;
  branch: string;
  status: RunStatus;
  prUrl: string | null;
  costUsd: number;
  startedAt: string;
  endedAt: string | null;
};
export type SessionsFile = {
  plan: { sessionId: string; updatedAt: string } | null;
  runs: RunRecord[];
};
