import type {
  getSessionMessages,
  listSessions,
} from "@anthropic-ai/claude-agent-sdk";
import { Hono } from "hono";
import { TRANSCRIPT_LIMIT, transcriptFrom } from "./agent/session.js";
import { NotFoundError } from "./files.js";

export type OtherSession = {
  sessionId: string;
  summary: string;
  lastModified: number;
  cwd: string | null;
  gitBranch: string | null;
};

// The repository's sessions (its worktrees' too) that Blueprint did not start: `exclude`
// holds the plan session's id and every run's. Headless SDK sessions are left out, as the
// terminal's /resume picker leaves them out, which also hides Blueprint's split sessions
// and replaced plan sessions. Newest first.
export async function listOtherSessions(deps: {
  listSessions: typeof listSessions;
  root: string;
  exclude: Set<string>;
}): Promise<OtherSession[]> {
  const all = await deps.listSessions({
    dir: deps.root,
    includeWorktrees: true,
    includeProgrammatic: false,
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

export type SessionRouteDeps = {
  listSessions: typeof listSessions;
  getSessionMessages: typeof getSessionMessages;
  root: string;
  // Blueprint's own session ids (the plan session's and every run's), read per request.
  exclude: () => Set<string>;
};

// The repository's other sessions, read-only. Any id with no saved messages, including
// one that is not a session id at all, is unknown (404). A transcript holds its last
// TRANSCRIPT_LIMIT events, as the panel does.
export function sessionRoutes(deps: SessionRouteDeps): Hono {
  return new Hono()
    .get("/", async (c) =>
      c.json(await listOtherSessions({ ...deps, exclude: deps.exclude() })),
    )
    .get("/:id/transcript", async (c) => {
      const id = c.req.param("id");
      const saved = await deps.getSessionMessages(id, { dir: deps.root });
      if (saved.length === 0)
        throw new NotFoundError(`session ${id} not found`);
      return c.json(transcriptFrom(saved).slice(-TRANSCRIPT_LIMIT));
    });
}
