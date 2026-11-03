import type { listSessions } from "@anthropic-ai/claude-agent-sdk";

export type OtherSession = {
  sessionId: string;
  summary: string;
  lastModified: number;
  cwd: string | null;
  gitBranch: string | null;
};

// The repository's sessions (its worktrees' too, and headless ones) that Blueprint did not
// start: `exclude` holds the plan session's id and every run's. Newest first.
export async function listOtherSessions(deps: {
  listSessions: typeof listSessions;
  root: string;
  exclude: Set<string>;
}): Promise<OtherSession[]> {
  const all = await deps.listSessions({
    dir: deps.root,
    includeWorktrees: true,
    includeProgrammatic: true,
  });
  return all
    .filter((s) => !deps.exclude.has(s.sessionId))
    .sort((a, b) => b.lastModified - a.lastModified)
    .map((s) => ({
      sessionId: s.sessionId,
      summary: s.summary,
      lastModified: s.lastModified,
      cwd: s.cwd ?? null,
      gitBranch: s.gitBranch ?? null,
    }));
}
