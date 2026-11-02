import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
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

export function createApp(store: FileStore): Hono {
  const app = new Hono();
  app.route("/api", routes(store));
  app.onError((err, c) => {
    const status = statusFor(err);
    // Anything unmapped (e.g. a corrupt board file) is a server bug: log it.
    if (status === 500) console.error(err);
    return c.json({ error: err.message }, status);
  });
  return app;
}
