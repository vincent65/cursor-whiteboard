import { Hono } from "hono";
import { z } from "zod";
import type { Agent } from "./agent/index.js";

const SendBody = z.object({
  text: z.string().refine((t) => t.trim() !== "", "text must not be empty"),
  selection: z
    .object({ board: z.string(), ids: z.array(z.string()) })
    .optional(),
  proposalId: z.string().optional(),
});

const DecisionBody = z.object({ decision: z.enum(["accepted", "rejected"]) });

const PermissionBody = z.object({
  id: z.string(),
  behavior: z.enum(["allow", "deny", "always"]),
  message: z.string().optional(),
});

const parse = async <T>(schema: z.ZodType<T>, req: Request) =>
  schema.safeParse(await req.json().catch(() => undefined));

export function agentRoutes(agent: Agent): Hono {
  return new Hono()
    .post("/send", async (c) => {
      const body = await parse(SendBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      // A proposalId that is not pending throws NotFoundError, which the app maps to 404.
      const { text, selection, proposalId } = body.data;
      return c.json({ id: await agent.send(text, selection, proposalId) }, 202);
    })
    .post("/compile", async (c) => c.json({ id: await agent.compile() }, 202))
    .post("/split", async (c) => {
      // No spec (404) and a split already running (409) map in the app's error handler.
      await agent.split();
      return c.body(null, 202);
    })
    .post("/interrupt", async (c) => {
      await agent.interrupt();
      return c.body(null, 204);
    })
    .post("/permission", async (c) => {
      const body = await parse(PermissionBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      const { id, ...decision } = body.data;
      if (!agent.answerPermission(id, decision))
        return c.json({ error: `permission ${id} not found` }, 404);
      return c.body(null, 204);
    })
    .get("/state", (c) => c.json(agent.state()))
    .get("/proposals", (c) => c.json(agent.pendingProposals()))
    .post("/proposals/:id/decision", async (c) => {
      const body = await parse(DecisionBody, c.req.raw);
      if (!body.success)
        return c.json({ error: z.prettifyError(body.error) }, 400);
      // Not pending (404) and being revised (409) map in the app's error handler.
      await agent.decideProposal(c.req.param("id"), body.data.decision);
      return c.body(null, 204);
    });
}
