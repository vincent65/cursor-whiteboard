import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import { createAgent } from "../../src/server/agent/index.js";
import { createApp } from "../../src/server/app.js";
import { FileStore } from "../../src/server/files.js";
import { RunStore } from "../../src/server/runs/store.js";
import { WsHub } from "../../src/server/ws.js";
import { taskToMarkdown } from "../../src/shared/tasks.js";
import type { IncomingScene } from "../../src/shared/types.js";

let root: string;
let store: FileStore;
let app: Hono;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "blueprint-routes-"));
  store = new FileStore(root);
  await store.init();
  app = createApp(store);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const json = { "Content-Type": "application/json" };
const post = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: json,
});
const putScene = (name: string, scene: unknown) =>
  app.request(`/api/boards/${name}`, {
    method: "PUT",
    body: JSON.stringify(scene),
    headers: json,
  });

const box = (id: string, arrow: string) => ({
  id,
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  boundElements: [{ id: arrow, type: "arrow" }],
});
const sceneWithTwoBoxesAndArrow: IncomingScene = {
  elements: [
    box("r1", "a1"),
    box("r2", "a1"),
    {
      id: "a1",
      type: "arrow",
      x: 100,
      y: 25,
      width: 100,
      height: 0,
      startBinding: { elementId: "r1" },
      endBinding: { elementId: "r2" },
      startArrowhead: null,
      endArrowhead: "arrow",
    },
  ],
  appState: {},
  files: {},
};

test("board lifecycle: create, list, get, put, export", async () => {
  expect(
    (await app.request("/api/boards", post({ name: "main" }))).status,
  ).toBe(201);
  expect(await (await app.request("/api/boards")).json()).toEqual([
    expect.objectContaining({ name: "main" }),
  ]);
  const got = await app.request("/api/boards/main");
  expect(got.status).toBe(200);
  expect(await got.json()).toMatchObject({ type: "excalidraw", elements: [] });

  const put = await putScene("main", sceneWithTwoBoxesAndArrow);
  expect(put.status).toBe(200);
  expect((await put.json()).elements).toHaveLength(3);

  const exported = await app.request("/api/export/boards/main.md");
  expect(exported.status).toBe(200);
  expect(exported.headers.get("content-type")).toMatch(/^text\/markdown/);
  const md = await exported.text();
  expect(md).toContain("flowchart LR");
  const onDisk = join(store.dir, "export/boards/main.md");
  expect(existsSync(onDisk)).toBe(true);
  expect(await readFile(onDisk, "utf8")).toBe(md);
});

test("writes need a loopback Host and, when sent, a same-origin Origin", async () => {
  const create = (name: string, headers: Record<string, string>) =>
    app.request("/api/boards", {
      method: "POST",
      // text/plain is a CORS simple request: browsers send it without preflight.
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "text/plain", ...headers },
    });
  const crossOrigin = await create("evil", {
    Host: "localhost:4242",
    Origin: "https://attacker.example",
  });
  expect(crossOrigin.status).toBe(403);
  expect(await crossOrigin.json()).toEqual({ error: expect.any(String) });
  expect(
    (
      await create("other-port", {
        Host: "localhost:4242",
        Origin: "http://localhost:3000",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await create("same-origin", {
        Host: "localhost:4242",
        Origin: "http://localhost:4242",
      })
    ).status,
  ).toBe(201);
  expect((await create("no-origin", { Host: "127.0.0.1:4242" })).status).toBe(
    201,
  );
  expect((await create("ipv6", { Host: "[::1]:4242" })).status).toBe(201);
  // DNS rebinding: the attacker's name resolves to 127.0.0.1, but Host keeps it.
  for (const host of ["attacker.example:4242", "localhost.attacker.example"])
    expect(
      (await app.request("/api/boards", { headers: { Host: host } })).status,
    ).toBe(403);
  expect((await app.request("/api/boards")).status).toBe(200);
  expect(await readdir(join(store.dir, "boards"))).toEqual([
    "ipv6.excalidraw.json",
    "no-origin.excalidraw.json",
    "same-origin.excalidraw.json",
  ]);
});

test("invalid names are rejected with 400 and nothing is written", async () => {
  for (const name of ["Main", "a b", "..", "a/b"]) {
    expect((await app.request("/api/boards", post({ name }))).status).toBe(400);
    expect((await app.request("/api/docs", post({ name }))).status).toBe(400);
    const res = await app.request(`/api/docs/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: "x",
    });
    // The URL parser resolves a ".." segment (encoded or not) before routing,
    // so "/api/docs/.." becomes "/api/" and never reaches a handler.
    expect(res.status).toBe(name === ".." ? 404 : 400);
  }
  for (const body of [{}, { name: 42 }])
    expect((await app.request("/api/boards", post(body))).status).toBe(400);
  expect(
    (
      await app.request("/api/boards", {
        method: "POST",
        body: "{",
        headers: json,
      })
    ).status,
  ).toBe(400);
  expect(
    (await app.request("/api/boards/Main/png", { method: "POST", body: "x" }))
      .status,
  ).toBe(400);
  expect((await app.request("/api/export/boards/Main.md")).status).toBe(400);
  expect(await readdir(join(store.dir, "boards"))).toEqual([]);
  expect(await readdir(join(store.dir, "docs"))).toEqual([]);
  expect(await readdir(join(store.dir, "export"))).toEqual([]);
});

test("duplicate create returns 409", async () => {
  for (const kind of ["boards", "docs"]) {
    expect(
      (await app.request(`/api/${kind}`, post({ name: "main" }))).status,
    ).toBe(201);
    const dup = await app.request(`/api/${kind}`, post({ name: "main" }));
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: expect.any(String) });
  }
});

test("missing board or doc returns 404 with { error }", async () => {
  const requests: [string, RequestInit?][] = [
    ["/api/boards/nope"],
    [
      "/api/boards/nope",
      {
        method: "PUT",
        body: JSON.stringify(sceneWithTwoBoxesAndArrow),
        headers: json,
      },
    ],
    ["/api/boards/nope", { method: "PUT", body: "not json", headers: json }],
    ["/api/docs/nope"],
    ["/api/docs/nope", { method: "PUT", body: "x" }],
    ["/api/export/boards/nope.md"],
  ];
  for (const [path, init] of requests) {
    const res = await app.request(path, init);
    expect(res.status, path).toBe(404);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  }
  await app.request("/api/boards", post({ name: "main" }));
  expect((await app.request("/api/export/boards/main.txt")).status).toBe(404);
});

test("malformed scene returns 400", async () => {
  await app.request("/api/boards", post({ name: "main" }));
  const before = await readFile(
    join(store.dir, "boards/main.excalidraw.json"),
    "utf8",
  );
  const bad = await putScene("main", {
    ...sceneWithTwoBoxesAndArrow,
    files: {
      f1: {
        id: "f1",
        mimeType: "image/png",
        created: 1,
        dataURL: "data:image/png;base64,***",
      },
    },
  });
  expect(bad.status).toBe(400);
  expect(await bad.json()).toEqual({ error: expect.any(String) });
  expect((await putScene("main", { elements: "nope" })).status).toBe(400);
  expect(
    (
      await app.request("/api/boards/main", {
        method: "PUT",
        body: "{",
        headers: json,
      })
    ).status,
  ).toBe(400);
  expect(
    await readFile(join(store.dir, "boards/main.excalidraw.json"), "utf8"),
  ).toBe(before);
  expect(existsSync(join(store.dir, "export/boards/main.md"))).toBe(false);
});

test("png upload writes export/boards/<name>.png", async () => {
  await app.request("/api/boards", post({ name: "main" }));
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]);
  const res = await app.request("/api/boards/main/png", {
    method: "POST",
    body: bytes,
    headers: { "Content-Type": "image/png" },
  });
  expect(res.status).toBe(204);
  expect(await readFile(join(store.dir, "export/boards/main.png"))).toEqual(
    Buffer.from(bytes),
  );
});

test("docs lifecycle with text/markdown content type", async () => {
  expect((await app.request("/api/docs", post({ name: "plan" }))).status).toBe(
    201,
  );
  expect(await (await app.request("/api/docs")).json()).toEqual([
    expect.objectContaining({ name: "plan", updatedAt: expect.any(String) }),
  ]);
  const put = await app.request("/api/docs/plan", {
    method: "PUT",
    body: "# Plan\n\nShip it.\n",
  });
  expect(put.status).toBe(204);
  const got = await app.request("/api/docs/plan");
  expect(got.status).toBe(200);
  expect(got.headers.get("content-type")).toMatch(/^text\/markdown/);
  expect(await got.text()).toBe("# Plan\n\nShip it.\n");
});

test("assets are served sandboxed with the right content type and 404 otherwise", async () => {
  await app.request("/api/boards", post({ name: "main" }));
  // Every image type Excalidraw accepts: [uploaded as, stored as, served as].
  const types = [
    ["image/png", "png", "image/png"],
    ["image/jpeg", "jpg", "image/jpeg"],
    ["image/gif", "gif", "image/gif"],
    ["image/svg+xml", "svg", "image/svg+xml"],
    ["image/webp", "webp", "image/webp"],
    ["image/bmp", "bmp", "image/bmp"],
    ["image/avif", "avif", "image/avif"],
    ["image/jfif", "jpg", "image/jpeg"],
    ["image/x-icon", "ico", "image/x-icon"],
  ];
  const files: IncomingScene["files"] = {};
  for (const [mimeType] of types)
    files[mimeType] = {
      id: mimeType,
      mimeType,
      created: 1,
      dataURL: `data:${mimeType};base64,${Buffer.from(mimeType).toString("base64")}`,
    };
  expect(
    (await putScene("main", { elements: [], appState: {}, files })).status,
  ).toBe(200);

  for (const [mimeType, ext, served] of types) {
    const sha = createHash("sha256").update(mimeType).digest("hex");
    const res = await app.request(`/api/assets/${sha}.${ext}`);
    expect(res.status, mimeType).toBe(200);
    expect(res.headers.get("content-type")).toBe(served);
    // An SVG opened directly must not run script in the app's origin.
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(mimeType);
  }
  for (const path of [
    `/api/assets/${"0".repeat(64)}.png`,
    "/api/assets/nope.exe",
  ]) {
    const res = await app.request(path);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  }
});

// A flow board with pending p_1 and p_2 (no ghosts drawn) and an agent on an injected clock.
async function withProposals() {
  await store.createBoard("flow");
  const at = "2020-01-01T00:00:00.000Z";
  const proposal = (id: string) => ({
    id,
    board: "flow",
    title: null,
    ops: [{ op: "add_note" as const, text: "hello" }],
    at,
  });
  for (const id of ["p_1", "p_2"])
    await store.appendProposal({
      event: "proposed",
      at,
      proposal: proposal(id),
    });
  const clock = { now: Date.parse("2020-01-01T00:01:00.000Z") };
  // The session never starts: nothing here sends.
  const sdk = { query: vi.fn(), getSessionMessages: vi.fn() };
  const agent = await createAgent({
    store,
    hub: new WsHub(),
    cwd: root,
    runs: new RunStore(store),
    sdk,
    clock: () => clock.now,
  });
  app = createApp(store, agent);
  // Only p_2's ghost is on the saved board.
  const scene = {
    elements: [
      {
        ...box("r1", "a1"),
        boundElements: null,
        customData: { origin: "ai", proposalId: "p_2", ghost: "add" },
      },
    ],
    appState: {},
    files: {},
  };
  return { proposal, clock, scene };
}

test("PUT /api/boards/:name rejects a pending proposal whose ghosts stay gone across saves", async () => {
  const { proposal, clock, scene } = await withProposals();
  const pendingIds = async () =>
    (
      (await (await app.request("/api/agent/proposals")).json()) as {
        id: string;
      }[]
    ).map((p) => p.id);

  // The first save without p_1's ghosts marks it; one 3 s later rejects it.
  expect((await putScene("flow", scene)).status).toBe(200);
  expect(await pendingIds()).toEqual(["p_1", "p_2"]);
  clock.now += 3_000;
  expect((await putScene("flow", scene)).status).toBe(200);

  expect(await (await app.request("/api/agent/proposals")).json()).toEqual([
    proposal("p_2"),
  ]);
  const log = await readFile(join(root, ".blueprint/proposals.jsonl"), "utf8");
  expect(log.trim().split("\n").at(-1)).toMatch(
    /"event":"rejected".*"id":"p_1"/,
  );
});

test("PUT /api/boards/:name still saves when the reconcile cannot append to the log", async () => {
  const { clock, scene } = await withProposals();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(store, "appendProposal").mockRejectedValue(new Error("disk full"));

  expect((await putScene("flow", scene)).status).toBe(200);
  clock.now += 3_000;
  const saved = await putScene("flow", scene);

  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({ elements: [{ id: "r1" }] });
  expect(warn).toHaveBeenCalledWith(
    "could not reconcile proposals on board flow: disk full",
  );
  warn.mockRestore();
});

test("GET /api/spec drops unknown citations and reports them", async () => {
  await store.createBoard("main");
  await putScene("main", {
    elements: [
      { id: "e1", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
    ],
    appState: {},
    files: {},
  });
  const text = "## Goals\n\nShip [[board:main#e1]] and [[board:main#gone]].\n";
  await writeFile(join(store.dir, "spec.md"), text);

  const res = await app.request("/api/spec");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    text: "## Goals\n\nShip [[board:main#e1]] and.\n",
    dropped: [
      { kind: "board", page: "main", id: "gone", raw: "[[board:main#gone]]" },
    ],
  });
  // Served clean, never rewritten on disk.
  expect(await readFile(join(store.dir, "spec.md"), "utf8")).toBe(text);
});

test("GET /api/spec without a spec returns null text", async () => {
  const res = await app.request("/api/spec");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ text: null, dropped: [] });
});

test("GET /api/tasks lists parsed task files", async () => {
  expect(await (await app.request("/api/tasks")).json()).toEqual([]);
  const task = {
    slug: "db",
    title: "Database",
    body: "Set it up.\n",
    dependsOn: [],
    files: ["src/db.ts"],
    acceptance: ["migrations run"],
    sources: ["[[board:main#e1]]"],
  };
  await writeFile(join(store.dir, "tasks", "01-db.md"), taskToMarkdown(task));
  const res = await app.request("/api/tasks");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([{ file: "01-db.md", task }]);
});
