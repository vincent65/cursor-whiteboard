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
export type RunPermissionMode = "acceptEdits" | "default" | "bypassPermissions";
export type RunRecord = {
  id: string;
  taskSlug: string;
  sessionId: string;
  // Relative to the repository root; records saved before this read as absolute.
  worktree: string;
  branch: string;
  status: RunStatus;
  // Records saved before this field read as acceptEdits.
  permissionMode: RunPermissionMode;
  prUrl: string | null;
  // The user marked the run done by hand; records saved before this field read as false.
  markedDone: boolean;
  // Why the run failed, while its status is failed; records saved before this field read as null.
  failure: string | null;
  costUsd: number;
  startedAt: string;
  endedAt: string | null;
};
export type SessionsFile = {
  plan: { sessionId: string; updatedAt: string } | null;
  runs: RunRecord[];
};
