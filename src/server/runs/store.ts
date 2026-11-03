import { randomBytes } from "node:crypto";
import type { RunRecord, SessionsFile } from "../../shared/types.js";
import { type FileStore, NotFoundError } from "../files.js";

// .blueprint/sessions.json, held in memory and rewritten whole on every change. Records
// handed out are copies, so callers cannot change what the next write saves.
export class RunStore {
  private data: SessionsFile = { plan: null, runs: [] };
  private readonly issued = new Set<string>();
  // Writes run one at a time, each from the state the previous one left, so overlapping
  // writers cannot lose an update.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly files: Pick<FileStore, "readSessions" | "writeSessions">,
  ) {}

  // A corrupt file throws and leaves the store empty; the first write then replaces it.
  async load(): Promise<SessionsFile> {
    this.data = await this.files.readSessions();
    return structuredClone(this.data);
  }

  runs(): RunRecord[] {
    return this.data.runs.map((r) => ({ ...r }));
  }

  run(id: string): RunRecord | undefined {
    const r = this.data.runs.find((r) => r.id === id);
    return r && { ...r };
  }

  setPlanSession(sessionId: string): Promise<void> {
    return this.write((s) => ({
      ...s,
      plan: { sessionId, updatedAt: new Date().toISOString() },
    }));
  }

  // Replaces the run with the same id in place, or appends it as the newest.
  upsertRun(record: RunRecord): Promise<void> {
    return this.write((s) => {
      const known = s.runs.some((r) => r.id === record.id);
      return {
        ...s,
        runs: known
          ? s.runs.map((r) => (r.id === record.id ? { ...record } : r))
          : [...s.runs, { ...record }],
      };
    });
  }

  async patchRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord> {
    let patched: RunRecord | undefined;
    await this.write((s) => {
      const old = s.runs.find((r) => r.id === id);
      if (!old) throw new NotFoundError(`run ${id} not found`);
      const updated = { ...old, ...patch, id };
      patched = updated;
      return { ...s, runs: s.runs.map((r) => (r === old ? updated : r)) };
    });
    return { ...(patched as RunRecord) };
  }

  newRunId(): string {
    let id: string;
    do id = `run_${randomBytes(3).toString("hex")}`;
    while (this.issued.has(id) || this.data.runs.some((r) => r.id === id));
    this.issued.add(id);
    return id;
  }

  // Resolves once every write queued so far has landed or failed.
  settled(): Promise<unknown> {
    return this.queue;
  }

  // Memory moves to the next state only once it is on disk.
  private write(next: (s: SessionsFile) => SessionsFile): Promise<void> {
    const p = this.queue.then(async () => {
      const s = next(this.data);
      await this.files.writeSessions(s);
      this.data = s;
    });
    this.queue = p.catch(() => {});
    return p;
  }
}
