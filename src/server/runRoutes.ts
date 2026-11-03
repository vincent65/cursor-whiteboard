import type {
  getSessionMessages,
  listSessions,
} from "@anthropic-ai/claude-agent-sdk";
import { Hono } from "hono";
import { z } from "zod";
import { transcriptFrom } from "./agent/session.js";
import { type FileStore, NotFoundError } from "./files.js";
import { PermissionBody, parse } from "./http.js";
import { checkGate, GateError } from "./runs/gate.js";
import type { RunManager } from "./runs/manager.js";
import { listOtherSessions } from "./sessions.js";

export type RunRouteDeps = {
  manager: RunManager;
  // Whether a branch is merged into the repository's HEAD.
  isAncestor: (branch: string) => Promise<boolean>;
};

export type SessionRouteDeps = {
  listSessions: typeof listSessions;
  getSessionMessages: typeof getSessionMessages;
  root: string;
  // Blueprint's own session ids (the plan session's and every run's), read per request.
  exclude: () => Set<string>;
};

const LaunchBody = z.object({
  taskSlug: z.string(),
  permissionMode: z.enum(["acceptEdits", "default", "bypassPermissions"]),
  override: z.boolean().optional(),
});

const MessageBody = z.object({
  text: z.string().refine((t) => t.trim() !== "", "text must not be empty"),
});

// Unknown tasks and runs (404), a failed gate and a resume of a run that is not
// interrupted (409) map in the app's error handler.
export function runRoutes(store: FileStore, deps: RunRouteDeps): Hono {
  const { manager, isAncestor } = deps;
  const gate = async (slug: string) => {
    const found = (await store.listTasks()).find((t) => t.task.slug === slug);
    if (!found) throw new NotFoundError(`task ${slug} not found`);
    return checkGate({ task: found.task, runs: manager.list(), isAncestor });
  };

  return new Hono()
    .get("/", (c) => c.json(manager.list()))
    .get("/gate/:slug", async (c) => c.json(await gate(c.req.param("slug"))))
    .post("/", async (c) => {
      const body = await parse(LaunchBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      const { taskSlug, permissionMode, override } = body.data;
      if (!override) {
        const { ok, missing } = await gate(taskSlug);
        if (!ok) throw new GateError(missing);
      }
      return c.json(await manager.launch({ taskSlug, permissionMode }), 201);
    })
    .post("/:id/message", async (c) => {
      const body = await parse(MessageBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      const id = await manager.message(c.req.param("id"), body.data.text);
      return c.json({ id }, 202);
    })
    .post("/:id/stop", async (c) => {
      await manager.stop(c.req.param("id"));
      return c.body(null, 204);
    })
    .post("/:id/resume", async (c) => {
      await manager.resume(c.req.param("id"));
      return c.body(null, 204);
    })
    .post("/:id/permission", async (c) => {
      const body = await parse(PermissionBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      const { id, ...decision } = body.data;
      if (!manager.answerPermission(c.req.param("id"), id, decision))
        return c.json({ error: `permission ${id} not found` }, 404);
      return c.body(null, 204);
    })
    .get("/:id/transcript", (c) =>
      c.json(manager.transcript(c.req.param("id"))),
    );
}

// The repository's other sessions, read-only. Any id with no saved messages, including
// one that is not a session id at all, is unknown (404).
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
      return c.json(transcriptFrom(saved));
    });
}
