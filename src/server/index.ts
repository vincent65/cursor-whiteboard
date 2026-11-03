import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { createAgent } from "./agent/index.js";
import { createApp } from "./app.js";
import { FileStore } from "./files.js";
import { watchPlan } from "./watch.js";
import { WsHub } from "./ws.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

const readOrNull = (path: string) => readFile(path).catch(() => null);

export async function startServer(opts: {
  root: string;
  port: number;
  uiDir?: string;
}): Promise<{ port: number; close(): Promise<void> }> {
  const store = new FileStore(opts.root);
  await store.init();
  const hub = new WsHub();
  const agent = await createAgent({ store, hub, cwd: opts.root });
  const app = createApp(store, agent);
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({
    app,
  });

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen: (_ev, ws) => hub.add(ws),
      onMessage: (ev, ws) => hub.handle(ws, String(ev.data)),
      onClose: (_ev, ws) => hub.remove(ws),
    })),
  );
  app.get("*", async (c) => {
    if (!opts.uiDir) return c.notFound();
    const uiDir = resolve(opts.uiDir);
    let path: string;
    try {
      path = resolve(uiDir, `.${decodeURIComponent(c.req.path)}`);
    } catch {
      return c.notFound();
    }
    // Paths outside the UI directory get the fallback, never the file.
    let data = path.startsWith(uiDir + sep) ? await readOrNull(path) : null;
    if (!data) {
      path = join(uiDir, "index.html");
      data = await readOrNull(path);
    }
    if (!data) return c.notFound();
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    return c.body(data, 200, { "Content-Type": type });
  });

  // Loopback only: the API reads and writes the user's files.
  const server = await new Promise<Server>((resolve, reject) => {
    const s = serve(
      { fetch: app.fetch, port: opts.port, hostname: "127.0.0.1" },
      () => resolve(s as Server),
    );
    s.once("error", reject);
  });
  injectWebSocket(server);
  const stopWatching = watchPlan(store, ({ kind, name }) =>
    hub.broadcast({ type: "file-changed", kind, name }),
  );

  return {
    port: (server.address() as AddressInfo).port,
    async close() {
      await stopWatching();
      // A hung or failing session must not keep the clients or the port.
      try {
        await agent.close();
      } finally {
        for (const client of wss.clients) client.terminate();
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    },
  };
}
