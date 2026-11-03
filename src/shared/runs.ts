import type { PendingPermission } from "./panel.js";
import type { RunPermissionMode, RunRecord } from "./types.js";

export type LaunchOptions = {
  taskSlug: string;
  permissionMode: RunPermissionMode;
};

// title: the task file's title, or the slug once the task file is gone; worktree: an
// absolute path.
export type RunView = RunRecord & {
  title: string;
  pending: PendingPermission[];
  lastText: string | null;
};

export type MissingDependency = {
  slug: string;
  reason: "no run" | "not done" | "not merged";
};
// branch: what a launch will name the run's branch.
export type GateResult = {
  ok: boolean;
  branch: string;
  missing: MissingDependency[];
};

// One of the repository's Claude sessions that Blueprint did not start.
export type OtherSession = {
  sessionId: string;
  summary: string;
  lastModified: number;
  cwd: string | null;
  gitBranch: string | null;
};
