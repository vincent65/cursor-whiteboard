import { randomBytes } from "node:crypto";
import type {
  Decision,
  Proposal,
  ProposalLogEntry,
} from "../../shared/proposals.js";
import { type FileStore, NotFoundError } from "../files.js";

const now = () => new Date().toISOString();

// A decision or second revise arrived while a revise's browser round trip is in flight.
export class ProposalBusyError extends Error {}

// Pending proposals, replayed from .blueprint/proposals.jsonl so a restart
// forgets nothing. Records handed out are shared; callers must not mutate them.
export class ProposalStore {
  private readonly pendingById = new Map<string, Proposal>();
  private readonly seen = new Set<string>();
  private notes: string[] = [];
  // Notes handed back by sends that never ran. Taken before every note still in
  // `notes`, so they are older and go first.
  private requeued: string[] = [];
  private readonly revising = new Set<string>();
  // Mutations run one at a time so a pending check still holds when its
  // line is appended; two racing accepts of one proposal log it once.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly files: Pick<FileStore, "appendProposal" | "readProposals">,
  ) {}

  async load(): Promise<void> {
    for (const entry of await this.files.readProposals()) this.apply(entry);
  }

  pending(): Proposal[] {
    return [...this.pendingById.values()];
  }

  get(id: string): Proposal | undefined {
    return this.pendingById.get(id);
  }

  newId(): string {
    let id: string;
    do id = `p_${randomBytes(4).toString("hex")}`;
    while (this.seen.has(id));
    this.seen.add(id);
    return id;
  }

  proposed(p: Proposal): Promise<void> {
    return this.serial(() =>
      this.log({ event: "proposed", at: now(), proposal: p }),
    );
  }

  revised(p: Proposal): Promise<void> {
    return this.serial(async () => {
      this.pendingOrThrow(p.id);
      await this.log({ event: "revised", at: now(), proposal: p });
    });
  }

  // Brackets a revise from its id checks to its log line; the caller must endRevise, also
  // on failure. Queued like the writes, so a decision already in flight settles first.
  beginRevise(id: string): Promise<void> {
    return this.serial(async () => {
      this.pendingOrThrow(id);
      this.throwIfRevising(id);
      this.revising.add(id);
    });
  }

  endRevise(id: string): void {
    this.revising.delete(id);
  }

  decided(id: string, decision: Decision): Promise<Proposal> {
    return this.serial(() => this.decide(id, decision));
  }

  // Rejects each pending proposal of board whose ghosts are all gone from the saved
  // elements; one being revised is left for the next save. Returns the rejected ones.
  reconcile(
    board: string,
    elements: readonly {
      isDeleted?: boolean;
      customData?: Record<string, unknown>;
    }[],
  ): Promise<Proposal[]> {
    return this.serial(async () => {
      const ghosted = new Set(
        elements
          .filter((e) => !e.isDeleted && e.customData?.ghost !== undefined)
          .map((e) => e.customData?.proposalId),
      );
      const rejected: Proposal[] = [];
      for (const p of this.pending())
        if (p.board === board && !ghosted.has(p.id) && !this.revising.has(p.id))
          rejected.push(await this.decide(p.id, "rejected"));
      return rejected;
    });
  }

  takeNotes(): string[] {
    const notes = [...this.requeued, ...this.notes];
    this.requeued = [];
    this.notes = [];
    return notes;
  }

  requeueNotes(notes: string[]): void {
    this.requeued.push(...notes);
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  private async decide(id: string, decision: Decision): Promise<Proposal> {
    const p = this.pendingOrThrow(id);
    this.throwIfRevising(id);
    await this.log({ event: decision, at: now(), id });
    const title = p.title === null ? "" : ` ${JSON.stringify(p.title)}`;
    this.notes.push(`[Proposal ${id}${title} was ${decision}.]`);
    return p;
  }

  private throwIfRevising(id: string): void {
    if (this.revising.has(id))
      throw new ProposalBusyError(`proposal ${id} is being revised`);
  }

  private pendingOrThrow(id: string): Proposal {
    const p = this.pendingById.get(id);
    if (!p) throw new NotFoundError(`proposal ${id} is not pending`);
    return p;
  }

  // Memory changes only after the line is on disk, so a failed append
  // leaves memory matching the log.
  private async log(entry: ProposalLogEntry): Promise<void> {
    await this.files.appendProposal(entry);
    this.apply(entry);
  }

  private apply(entry: ProposalLogEntry): void {
    if ("proposal" in entry) {
      this.seen.add(entry.proposal.id);
      this.pendingById.set(entry.proposal.id, entry.proposal);
    } else {
      this.seen.add(entry.id);
      this.pendingById.delete(entry.id);
    }
  }
}
