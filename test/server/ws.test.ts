import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../../src/server/files.js";
import { startServer } from "../../src/server/index.js";
import { WsHub } from "../../src/server/ws.js";
import type { ServerMessage } from "../../src/shared/messages.js";

test("hub broadcasts JSON to every socket and drops removed ones", () => {
  const hub = new WsHub();
  const a = { send: vi.fn() };
  const b = { send: vi.fn() };
  hub.add(a);
  hub.add(b);
  hub.remove(b);
  expect(hub.size).toBe(1);
  hub.broadcast({ type: "file-changed", kind: "doc", name: "notes" });
  expect(a.send).toHaveBeenCalledWith(
    JSON.stringify({ type: "file-changed", kind: "doc", name: "notes" }),
  );
  expect(b.send).not.toHaveBeenCalled();
});

describe("startServer", () => {
  let root: string;
  let server: Awaited<ReturnType<typeof startServer>>;
  let base: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blueprint-server-"));
    server = await startServer({
      root,
      port: 0,
      uiDir: join(root, "ui"),
    });
    base = `http://127.0.0.1:${server.port}`;
  });

  afterEach(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  test("serves the API and returns 404 for unknown paths", async () => {
    const boards = await fetch(`${base}/api/boards`);
    expect(boards.status).toBe(200);
    const api = await fetch(`${base}/api/nope`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: "not found" });
    // The UI directory does not exist, so even the fallback is a 404.
    expect((await fetch(`${base}/some/page`)).status).toBe(404);
  });

  test("serves UI files and falls back to index.html", async () => {
    const ui = join(root, "ui");
    await mkdir(join(ui, "assets"), { recursive: true });
    await writeFile(join(ui, "index.html"), "<p>app</p>");
    await writeFile(join(ui, "assets", "app.js"), "run()");
    await writeFile(join(root, "secret.txt"), "secret");

    const js = await fetch(`${base}/assets/app.js`);
    expect(js.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(await js.text()).toBe("run()");
    for (const path of ["/", "/boards/main", "/..%2fsecret.txt"]) {
      const page = await fetch(`${base}${path}`);
      expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await page.text()).toBe("<p>app</p>");
    }
    expect((await fetch(`${base}/api/missing`)).status).toBe(404);
  });

  test("refuses websocket upgrades from other origins", async () => {
    // A raw upgrade, since the WebSocket client cannot set Origin.
    const upgrade = (origin: string) =>
      new Promise<number>((resolve, reject) => {
        const req = request(`${base}/ws`, {
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key":
              Buffer.from("0123456789abcdef").toString("base64"),
            "Sec-WebSocket-Version": "13",
            Origin: origin,
          },
        });
        req.on("upgrade", (res, socket) => {
          socket.destroy();
          resolve(res.statusCode ?? 0);
        });
        req.on("response", (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
        req.end();
      });
    expect(await upgrade("https://attacker.example")).toBe(403);
    expect(await upgrade(`http://127.0.0.1:${server.port}`)).toBe(101);
  });

  test("broadcasts external file changes to websocket clients", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    const message = new Promise<ServerMessage>((resolve) => {
      ws.onmessage = (ev) => resolve(JSON.parse(String(ev.data)));
    });
    // The watcher may still be scanning, and a write it sees as initial
    // state is not an event, so write until one is reported.
    const path = join(new FileStore(root).dir, "docs", "plan.md");
    let reported = false;
    for (let i = 0; i < 5 && !reported; i++) {
      await writeFile(path, String(i));
      reported = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1000);
        message.then(() => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    }
    expect(reported).toBe(true);
    expect(await message).toEqual({
      type: "file-changed",
      kind: "doc",
      name: "plan",
    });
    ws.close();
  });
});
