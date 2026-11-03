import { createHash, randomBytes } from "node:crypto";
import {
  access,
  appendFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
  truncate,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import {
  BoardFile,
  type BoardFileAsset,
  type BoardGraph,
  buildCitationIndex,
  excalidrawToBoardGraph,
} from "../export/index.js";
import { ProposalLogEntry } from "../shared/proposals.js";
import { SLUG_RE } from "../shared/slug.js";
import {
  orderTasks,
  type Task,
  type TaskFile,
  taskFileName,
  taskFromMarkdown,
  taskToMarkdown,
} from "../shared/tasks.js";
import type { IncomingScene, SessionsFile } from "../shared/types.js";

export class InvalidNameError extends Error {}

const isJson = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// The last line of a file that does not end with a newline, and its byte offset; null when
// the file is missing, empty, or newline-terminated. Reads one byte unless a tail is there.
async function unfinishedTail(
  path: string,
): Promise<{ line: string; start: number } | null> {
  const handle = await open(path, "r").catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return null;
    throw err;
  });
  if (!handle) return null;
  try {
    const { size } = await handle.stat();
    if (size === 0) return null;
    const last = Buffer.alloc(1);
    await handle.read(last, 0, 1, size - 1);
    if (last[0] === 0x0a) return null;
  } finally {
    await handle.close();
  }
  const data = await readFile(path);
  const start = data.lastIndexOf(0x0a) + 1;
  return { line: data.subarray(start).toString("utf8"), start };
}
export class NotFoundError extends Error {}
export class ExistsError extends Error {}
export class InvalidSceneError extends Error {}

const SUBDIRS = ["boards", "docs", "assets", "tasks", "export", "worktrees"];
const GITIGNORE_LINES = [".blueprint/export/", ".blueprint/worktrees/"];
// Every image type Excalidraw accepts on paste or drop; one it accepts that
// is missing here fails every save of the board until reload.
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  // JFIF is JPEG data, so it is stored and served as one.
  "image/jfif": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/x-icon": "ico",
};
// Linear character classes only: a repeated-group pattern overflows V8's
// stack on multi-MB payloads. Canonical form is enforced after decoding.
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const ASSET_FILE = new RegExp(
  `^[0-9a-f]{64}\\.(${Object.values(EXTENSIONS).join("|")})$`,
);

const SessionsSchema: z.ZodType<SessionsFile> = z.object({
  plan: z.object({ sessionId: z.string(), updatedAt: z.string() }).nullable(),
  runs: z.array(
    z.object({
      id: z.string(),
      taskSlug: z.string(),
      sessionId: z.string(),
      worktree: z.string(),
      branch: z.string(),
      status: z.enum([
        "working",
        "needs_you",
        "idle",
        "done",
        "failed",
        "interrupted",
      ]),
      prUrl: z.string().nullable(),
      costUsd: z.number(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
    }),
  ),
});

export function assertSlug(name: string): void {
  if (!SLUG_RE.test(name))
    throw new InvalidNameError(`invalid name: ${JSON.stringify(name)}`);
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function orNotFound<T>(work: Promise<T>, what: string): Promise<T> {
  try {
    return await work;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      throw new NotFoundError(`${what} not found`);
    throw err;
  }
}

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

function serialize(board: BoardFile): string {
  return `${JSON.stringify(board, null, 2)}\n`;
}

export class FileStore {
  readonly dir: string;
  private readonly root: string;
  // Absolute path -> sha256 of the data the store last wrote there.
  private readonly ownWrites = new Map<string, string>();

  constructor(root: string) {
    this.root = resolve(root);
    this.dir = join(this.root, ".blueprint");
  }

  async init(): Promise<void> {
    for (const d of SUBDIRS)
      await mkdir(join(this.dir, d), { recursive: true });
    const path = join(this.root, ".gitignore");
    const text = await readFile(path, "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return "";
        throw err;
      },
    );
    const present = new Set(text.split(/\r?\n/).map((l) => l.trim()));
    const missing = GITIGNORE_LINES.filter((l) => !present.has(l));
    if (missing.length === 0) return;
    const gap = text === "" || text.endsWith("\n") ? "" : "\n";
    await this.write(path, `${text}${gap}${missing.join("\n")}\n`);
  }

  listBoards(): Promise<{ name: string; updatedAt: string }[]> {
    return this.list("boards", ".excalidraw.json");
  }

  async createBoard(name: string): Promise<BoardFile> {
    const path = this.boardPath(name);
    if (await exists(path)) throw new ExistsError(`board ${name} exists`);
    const board: BoardFile = {
      type: "excalidraw",
      version: 2,
      source: "blueprint",
      elements: [],
      appState: {},
      files: {},
    };
    await this.write(path, serialize(board));
    return board;
  }

  async readBoard(name: string): Promise<BoardFile> {
    const text = await orNotFound(
      readFile(this.boardPath(name), "utf8"),
      `board ${name}`,
    );
    return BoardFile.parse(JSON.parse(text));
  }

  async writeBoard(name: string, scene: IncomingScene): Promise<BoardFile> {
    const path = this.boardPath(name);
    if (!(await exists(path)))
      throw new NotFoundError(`board ${name} not found`);

    // Validate everything before touching disk so a bad scene writes nothing.
    const assets = new Map<string, Buffer>();
    const files: Record<string, BoardFileAsset> = {};
    for (const [key, file] of Object.entries(scene?.files ?? {})) {
      if (typeof file !== "object" || file === null)
        throw new InvalidSceneError(`file ${key} is not an object`);
      const { id, mimeType, created } = file;
      if (file.dataURL === undefined) {
        // A missing or non-string asset fails the BoardFile parse below.
        files[key] = { id, mimeType, created, asset: file.asset as string };
        continue;
      }
      const match = DATA_URL.exec(String(file.dataURL));
      const ext = match && EXTENSIONS[match[1]];
      if (!match || !ext || match[1] !== mimeType)
        throw new InvalidSceneError(`file ${key} has an unsupported dataURL`);
      // Buffer.from silently drops malformed trailing data, so a payload is
      // valid only if it re-encodes to itself (this also rejects zero bytes).
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.toString("base64") !== match[2])
        throw new InvalidSceneError(`file ${key} has malformed base64`);
      const sha = sha256(bytes);
      assets.set(`${sha}.${ext}`, bytes);
      files[key] = { id, mimeType, created, asset: `assets/${sha}.${ext}` };
    }
    const parsed = BoardFile.safeParse({
      type: "excalidraw",
      version: 2,
      source: "blueprint",
      elements: scene?.elements,
      appState: scene?.appState,
      files,
    });
    if (!parsed.success)
      throw new InvalidSceneError(`invalid scene: ${parsed.error.message}`);

    for (const [file, bytes] of assets) {
      const assetPath = join(this.dir, "assets", file);
      // Content-addressed: an existing file already holds these bytes.
      if (!(await exists(assetPath))) await this.write(assetPath, bytes);
    }
    await this.write(path, serialize(parsed.data));
    return parsed.data;
  }

  listDocs(): Promise<{ name: string; updatedAt: string }[]> {
    return this.list("docs", ".md");
  }

  async createDoc(name: string): Promise<void> {
    const path = this.docPath(name);
    if (await exists(path)) throw new ExistsError(`doc ${name} exists`);
    await this.write(path, "");
  }

  readDoc(name: string): Promise<string> {
    return orNotFound(readFile(this.docPath(name), "utf8"), `doc ${name}`);
  }

  async writeDoc(name: string, text: string): Promise<void> {
    const path = this.docPath(name);
    if (!(await exists(path))) throw new NotFoundError(`doc ${name} not found`);
    await this.write(path, text);
  }

  async readAsset(file: string): Promise<Buffer> {
    if (!ASSET_FILE.test(file))
      throw new NotFoundError(`asset ${file} not found`);
    return orNotFound(
      readFile(join(this.dir, "assets", file)),
      `asset ${file}`,
    );
  }

  async writeExport(relPath: string, data: Buffer | string): Promise<void> {
    const exportDir = join(this.dir, "export");
    const path = resolve(exportDir, relPath);
    if (!path.startsWith(exportDir + sep))
      throw new InvalidNameError(`invalid export path: ${relPath}`);
    await mkdir(dirname(path), { recursive: true });
    await this.write(path, data);
  }

  readSpec(): Promise<string | null> {
    return readFile(join(this.dir, "spec.md"), "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return null;
        throw err;
      },
    );
  }

  async listTasks(): Promise<TaskFile[]> {
    const dir = join(this.dir, "tasks");
    const names = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
    return Promise.all(
      names.map(async (file) => {
        let task: Task;
        try {
          task = taskFromMarkdown(await readFile(join(dir, file), "utf8"));
        } catch (err) {
          throw new Error(`task file ${file}: ${(err as Error).message}`);
        }
        if (!/^\d{2}-/.test(file) || file.slice(3) !== `${task.slug}.md`)
          throw new Error(`task file ${file} has slug ${task.slug}`);
        return { file, task };
      }),
    );
  }

  // Writes the new set before deleting the old one, so a failure part way
  // leaves stale extras rather than missing tasks. Other files are left alone.
  async replaceTasks(tasks: Task[]): Promise<TaskFile[]> {
    const ordered = orderTasks(tasks);
    for (const task of ordered) assertSlug(task.slug);
    const dir = join(this.dir, "tasks");
    const old = (await readdir(dir)).filter((f) => f.endsWith(".md"));
    const files = ordered.map((task, i) => ({
      file: taskFileName(i, task.slug),
      task,
    }));
    for (const { file, task } of files)
      await this.write(join(dir, file), taskToMarkdown(task));
    const kept = new Set(files.map((f) => f.file));
    for (const file of old) if (!kept.has(file)) await unlink(join(dir, file));
    return files;
  }

  // Every citable id: board elements as the export graph sees them, doc headings by file.
  async citationIndex(): Promise<Set<string>> {
    const boards: Record<string, BoardGraph> = {};
    for (const { name } of await this.listBoards())
      boards[name] = excalidrawToBoardGraph(await this.readBoard(name), name);
    const docs: Record<string, string> = {};
    for (const { name } of await this.listDocs())
      docs[`${name}.md`] = await this.readDoc(name);
    return buildCitationIndex({ boards, docs });
  }

  async readSessions(): Promise<SessionsFile> {
    const text = await readFile(this.sessionsPath(), "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return null;
        throw err;
      },
    );
    if (text === null) return { plan: null, runs: [] };
    return SessionsSchema.parse(JSON.parse(text));
  }

  async writeSessions(s: SessionsFile): Promise<void> {
    await this.write(this.sessionsPath(), `${JSON.stringify(s, null, 2)}\n`);
  }

  // One JSON line per append; a single small append needs no temp-file rename.
  // A crash mid-append can leave a last line with no newline: a torn one (not JSON, which
  // readProposals skips) is cut off, a whole one missing only its newline gets it first.
  async appendProposal(entry: ProposalLogEntry): Promise<void> {
    const path = this.proposalsPath();
    const tail = await unfinishedTail(path);
    let prefix = "";
    if (tail && isJson(tail.line)) prefix = "\n";
    else if (tail) await truncate(path, tail.start);
    await appendFile(path, `${prefix}${JSON.stringify(entry)}\n`);
  }

  async readProposals(): Promise<ProposalLogEntry[]> {
    const text = await readFile(this.proposalsPath(), "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") return "";
        throw err;
      },
    );
    const lines = text.split("\n");
    // Not newline-terminated and not JSON: a crash mid-append, never applied, so skip it.
    const last = lines.at(-1) ?? "";
    if (last.trim() !== "" && !isJson(last)) {
      console.warn("proposals.jsonl: ignoring a torn last line");
      lines.pop();
    }
    const entries: ProposalLogEntry[] = [];
    for (const [i, line] of lines.entries()) {
      if (line.trim() === "") continue;
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch (err) {
        throw new Error(
          `proposals.jsonl line ${i + 1}: ${(err as Error).message}`,
        );
      }
      const parsed = ProposalLogEntry.safeParse(json);
      if (!parsed.success)
        throw new Error(
          `proposals.jsonl line ${i + 1}: ${parsed.error.message}`,
        );
      entries.push(parsed.data);
    }
    return entries;
  }

  // True when the file on disk still holds the store's own last write: an echo, not an edit.
  async isOwnWrite(absPath: string): Promise<boolean> {
    const hash = this.ownWrites.get(absPath);
    if (hash === undefined) return false;
    const data = await readFile(absPath).catch(() => null);
    return data !== null && sha256(data) === hash;
  }

  private proposalsPath(): string {
    return join(this.dir, "proposals.jsonl");
  }

  private sessionsPath(): string {
    return join(this.dir, "sessions.json");
  }

  private boardPath(name: string): string {
    assertSlug(name);
    return join(this.dir, "boards", `${name}.excalidraw.json`);
  }

  private docPath(name: string): string {
    assertSlug(name);
    return join(this.dir, "docs", `${name}.md`);
  }

  private async list(
    subdir: string,
    suffix: string,
  ): Promise<{ name: string; updatedAt: string }[]> {
    const dir = join(this.dir, subdir);
    const names = (await readdir(dir))
      .filter((f) => f.endsWith(suffix))
      .map((f) => f.slice(0, -suffix.length))
      .sort();
    return Promise.all(
      names.map(async (name) => ({
        name,
        updatedAt: (await stat(join(dir, name + suffix))).mtime.toISOString(),
      })),
    );
  }

  // Atomic: write a sibling temp file, then rename it over the target.
  private async write(path: string, data: Buffer | string): Promise<void> {
    const tmp = `${path}.tmp-${randomBytes(6).toString("hex")}`;
    try {
      await writeFile(tmp, data);
      this.ownWrites.set(path, sha256(data));
      await rename(tmp, path);
    } catch (err) {
      await unlink(tmp).catch(() => {});
      throw err;
    }
  }
}
