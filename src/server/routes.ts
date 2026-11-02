import { type Context, Hono } from "hono";
import {
  boardGraphToMarkdown,
  excalidrawToBoardGraph,
} from "../export/index.js";
import type { IncomingScene } from "../shared/types.js";
import { assertSlug, type FileStore, InvalidNameError } from "./files.js";

const MARKDOWN = { "Content-Type": "text/markdown; charset=utf-8" };
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
};

async function nameFromBody(c: Context): Promise<string> {
  const body: unknown = await c.req.json().catch(() => null);
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string")
    throw new InvalidNameError("body must be { name: string }");
  return name;
}

export function routes(store: FileStore): Hono {
  return (
    new Hono()
      .get("/boards", async (c) => c.json(await store.listBoards()))
      .post("/boards", async (c) =>
        c.json(await store.createBoard(await nameFromBody(c)), 201),
      )
      .get("/boards/:name", async (c) =>
        c.json(await store.readBoard(c.req.param("name"))),
      )
      .put("/boards/:name", async (c) => {
        const name = c.req.param("name");
        // Unparseable JSON becomes undefined so writeBoard still checks the name
        // and existence first, then rejects the scene as invalid.
        const scene = (await c.req
          .json()
          .catch(() => undefined)) as IncomingScene;
        const board = await store.writeBoard(name, scene);
        await store.writeExport(
          `boards/${name}.md`,
          boardGraphToMarkdown(excalidrawToBoardGraph(board, name)),
        );
        return c.json(board);
      })
      .post("/boards/:name/png", async (c) => {
        const name = c.req.param("name");
        assertSlug(name);
        const bytes = Buffer.from(await c.req.arrayBuffer());
        await store.writeExport(`boards/${name}.png`, bytes);
        return c.body(null, 204);
      })
      .get("/docs", async (c) => c.json(await store.listDocs()))
      .post("/docs", async (c) => {
        await store.createDoc(await nameFromBody(c));
        return c.body(null, 201);
      })
      .get("/docs/:name", async (c) =>
        c.body(await store.readDoc(c.req.param("name")), 200, MARKDOWN),
      )
      .put("/docs/:name", async (c) => {
        await store.writeDoc(c.req.param("name"), await c.req.text());
        return c.body(null, 204);
      })
      .get("/assets/:file", async (c) => {
        const file = c.req.param("file");
        // readAsset only accepts <sha256>.<known ext>, so the lookup always hits.
        const bytes = await store.readAsset(file);
        const ext = file.slice(file.lastIndexOf(".") + 1);
        return c.body(new Uint8Array(bytes), 200, {
          "Content-Type": CONTENT_TYPES[ext],
        });
      })
      // Hono cannot match a literal suffix after a param, so the suffix is part
      // of the param and stripped here; readBoard validates what remains.
      .get("/export/boards/:file{.+\\.md}", async (c) => {
        const name = c.req.param("file").slice(0, -".md".length);
        const board = await store.readBoard(name);
        return c.body(
          boardGraphToMarkdown(excalidrawToBoardGraph(board, name)),
          200,
          MARKDOWN,
        );
      })
  );
}
