import { Hono, type MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Agent } from "./agent/index.js";
import { agentRoutes } from "./agentRoutes.js";
import {
  ExistsError,
  type FileStore,
  InvalidNameError,
  InvalidSceneError,
  NotFoundError,
} from "./files.js";
import { routes } from "./routes.js";

function statusFor(err: Error): ContentfulStatusCode {
  if (err instanceof InvalidNameError || err instanceof InvalidSceneError)
    return 400;
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ExistsError) return 409;
  return 500;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The API writes into the user's repository, so only this app may call it.
// A loopback Host defeats DNS rebinding; a same-origin Origin stops other
// pages from writing (a text/plain POST needs no preflight) or opening the
// socket. Requests without Origin are not from a cross-origin page. The Host
// port is not pinned: it is the dev proxy's port under `pnpm dev`, and a
// loopback Host cannot be set by a remote page anyway.
const sameOrigin: MiddlewareHandler = async (c, next) => {
  // app.request() in tests sends no Host; a real server always gets one.
  const host = URL.parse(
    `http://${c.req.header("host") ?? new URL(c.req.url).host}`,
  );
  const origin = c.req.header("origin");
  const writes =
    !["GET", "HEAD"].includes(c.req.method) ||
    c.req.header("upgrade")?.toLowerCase() === "websocket";
  if (
    !host ||
    !LOOPBACK.has(host.hostname) ||
    (writes && origin !== undefined && origin !== host.origin)
  )
    return c.json({ error: "forbidden" }, 403);
  await next();
};

export function createApp(store: FileStore, agent?: Agent): Hono {
  const app = new Hono();
  // Also guards the WebSocket upgrade, which @hono/node-ws routes through app.
  app.use(sameOrigin);
  if (agent) app.route("/api/agent", agentRoutes(agent));
  app.route("/api", routes(store));
  app.all("/api/*", (c) => c.json({ error: "not found" }, 404));
  app.onError((err, c) => {
    const status = statusFor(err);
    // Anything unmapped (e.g. a corrupt board file) is a server bug: log it.
    if (status === 500) console.error(err);
    return c.json({ error: err.message }, status);
  });
  return app;
}
