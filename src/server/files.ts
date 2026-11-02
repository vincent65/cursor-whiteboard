import { createHash, randomBytes } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { BoardFile, type BoardFileAsset } from "../export/index.js";
import type { IncomingScene } from "../shared/types.js";

export class InvalidNameError extends Error {}
export class NotFoundError extends Error {}
export class ExistsError extends Error {}
export class InvalidSceneError extends Error {}

const SUBDIRS = ["boards", "docs", "assets", "tasks", "export", "worktrees"];
const GITIGNORE_LINES = [".blueprint/export/", ".blueprint/worktrees/"];
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)$/;
const ASSET_FILE = new RegExp(
  `^[0-9a-f]{64}\\.(${Object.values(EXTENSIONS).join("|")})$`,
);

export function assertSlug(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
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

function serialize(board: BoardFile): string {
  return `${JSON.stringify(board, null, 2)}\n`;
}

export class FileStore {
  readonly dir: string;
  private readonly root: string;
  private readonly recentWrites = new Map<string, number>();

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
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length === 0)
        throw new InvalidSceneError(`file ${key} has an empty dataURL`);
      const sha = createHash("sha256").update(bytes).digest("hex");
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

  wasWrittenRecently(absPath: string, withinMs: number): boolean {
    const at = this.recentWrites.get(absPath);
    return at !== undefined && Date.now() - at <= withinMs;
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
      this.recentWrites.set(path, Date.now());
      await rename(tmp, path);
    } catch (err) {
      await unlink(tmp).catch(() => {});
      throw err;
    }
  }
}
