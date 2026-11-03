import {
  ProposalBusyError,
  ProposalStore,
} from "../../../src/server/agent/proposals.js";
import { NotFoundError } from "../../../src/server/files.js";
import type {
  Op,
  Proposal,
  ProposalLogEntry,
} from "../../../src/shared/proposals.js";

// Queued byte strings randomBytes hands out before falling back to real ones.
const queued = vi.hoisted(() => [] as Buffer[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return {
    ...real,
    randomBytes: (size: number) => queued.shift() ?? real.randomBytes(size),
  };
});

const at = "2026-11-02T00:00:00.000Z";
const ops: Op[] = [{ op: "add_note", text: "hello" }];
const newOps: Op[] = [{ op: "delete", id: "el_1" }];
const proposal = (id: string, title: string | null = null): Proposal => ({
  id,
  board: "flow",
  title,
  ops,
  at,
});

// The store's clock; each test starts it at the time the fixtures were minted.
let clock: number;
beforeEach(() => {
  clock = Date.parse(at);
});
const newStore = (files: ReturnType<typeof fakeFiles>) =>
  new ProposalStore(files, () => clock);

function fakeFiles(log: ProposalLogEntry[] = []) {
  return {
    log,
    appendProposal: async (entry: ProposalLogEntry) => {
      log.push(entry);
    },
    readProposals: async () => [...log],
  };
}

test("load replays the log into pending, oldest first, with revisions replacing ops", async () => {
  const store = newStore(
    fakeFiles([
      { event: "proposed", at, proposal: proposal("p_1") },
      { event: "proposed", at, proposal: proposal("p_2") },
      { event: "revised", at, proposal: { ...proposal("p_1"), ops: newOps } },
      { event: "accepted", at, id: "p_2" },
    ]),
  );
  await store.load();
  expect(store.pending().map((p) => p.id)).toEqual(["p_1"]);
  expect(store.get("p_1")?.ops).toEqual(newOps);
  expect(store.get("p_2")).toBeUndefined();
});

test("proposed, revised, and decided write log entries and maintain pending", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  await store.load();
  const minted = proposal("p_1", "Login flow");
  // Logged after the browser round trip: the record carries the logging time.
  clock += 7_000;
  const p = { ...minted, at: "2026-11-02T00:00:07.000Z" };

  await store.proposed(minted);
  expect(store.pending()).toEqual([p]);
  expect(files.log.at(-1)).toEqual({
    event: "proposed",
    at: p.at,
    proposal: p,
  });

  await store.revised({ ...p, ops: newOps });
  expect(files.log.at(-1)).toMatchObject({ event: "revised" });
  expect(store.get("p_1")?.ops).toEqual(newOps);

  expect(await store.decided("p_1", "accepted")).toEqual({
    ...p,
    ops: newOps,
  });
  expect(files.log.at(-1)).toMatchObject({ event: "accepted", id: "p_1" });
  expect(store.pending()).toEqual([]);
  expect(store.takeNotes()).toEqual([
    '[Proposal p_1 "Login flow" was accepted.]',
  ]);
  expect(store.takeNotes()).toEqual([]);
});

test("decided notes omit a null title", async () => {
  const store = newStore(fakeFiles());
  await store.proposed(proposal("p_2"));
  await store.decided("p_2", "rejected");
  expect(store.takeNotes()).toEqual(["[Proposal p_2 was rejected.]"]);
});

test("requeued notes come back before newer ones, in the order they were requeued", async () => {
  const store = newStore(fakeFiles());
  for (const id of ["p_1", "p_2", "p_3"]) await store.proposed(proposal(id));
  await store.decided("p_1", "accepted");
  const first = store.takeNotes();
  await store.decided("p_2", "accepted");
  const second = store.takeNotes();
  await store.decided("p_3", "rejected");
  store.requeueNotes(first);
  store.requeueNotes(second);
  expect(store.takeNotes()).toEqual([
    "[Proposal p_1 was accepted.]",
    "[Proposal p_2 was accepted.]",
    "[Proposal p_3 was rejected.]",
  ]);
  expect(store.takeNotes()).toEqual([]);
});

test("revised and decided reject ids that are not pending", async () => {
  const files = fakeFiles([
    { event: "proposed", at, proposal: proposal("p_1") },
    { event: "rejected", at, id: "p_1" },
  ]);
  const store = newStore(files);
  await store.load();
  const p = proposal("p_9");
  await expect(store.revised(p)).rejects.toBeInstanceOf(NotFoundError);
  await expect(store.revised(p)).rejects.toThrow("proposal p_9 is not pending");
  await expect(store.decided("p_9", "rejected")).rejects.toBeInstanceOf(
    NotFoundError,
  );
  await expect(store.decided("p_1", "accepted")).rejects.toBeInstanceOf(
    NotFoundError,
  );
  expect(files.log).toHaveLength(2);
});

test("newId never repeats an id seen in the log", async () => {
  const store = newStore(
    fakeFiles([
      { event: "proposed", at, proposal: proposal("p_00000001") },
      { event: "accepted", at, id: "p_00000001" },
    ]),
  );
  await store.load();
  await store.proposed(proposal("p_00000002"));
  queued.push(
    Buffer.from("00000001", "hex"),
    Buffer.from("00000002", "hex"),
    Buffer.from("0a0b0c0d", "hex"),
  );
  expect(store.newId()).toBe("p_0a0b0c0d");
  expect(queued).toEqual([]);
  expect(store.newId()).toMatch(/^p_[0-9a-f]{8}$/);
});

test("concurrent decisions on one proposal log it once", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  await store.proposed(proposal("p_1"));
  const results = await Promise.allSettled([
    store.decided("p_1", "accepted"),
    store.decided("p_1", "accepted"),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(files.log.map((e) => e.event)).toEqual(["proposed", "accepted"]);
  expect(store.takeNotes()).toHaveLength(1);
});

test("a proposal cannot be decided or revised again while a revise is in flight", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  await store.proposed(proposal("p_1"));

  await store.beginRevise("p_1");
  await expect(store.decided("p_1", "accepted")).rejects.toThrow(
    new ProposalBusyError("proposal p_1 is being revised"),
  );
  await expect(store.beginRevise("p_1")).rejects.toThrow(
    new ProposalBusyError("proposal p_1 is being revised"),
  );
  expect(files.log.map((e) => e.event)).toEqual(["proposed"]);

  store.endRevise("p_1");
  await store.decided("p_1", "accepted");
  expect(files.log.map((e) => e.event)).toEqual(["proposed", "accepted"]);
});

test("beginRevise requires a pending proposal and queues behind a decision in flight", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  await expect(store.beginRevise("p_9")).rejects.toThrow(
    new NotFoundError("proposal p_9 is not pending"),
  );

  await store.proposed(proposal("p_1"));
  // Started together, the decision runs first and the revise finds nothing pending.
  const [decided, begun] = await Promise.allSettled([
    store.decided("p_1", "accepted"),
    store.beginRevise("p_1"),
  ]);
  expect(decided.status).toBe("fulfilled");
  expect(begun).toMatchObject({
    status: "rejected",
    reason: new NotFoundError("proposal p_1 is not pending"),
  });
});

test("revise can retitle", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  await store.proposed(proposal("p_1", "Cache"));
  await store.revised({ ...proposal("p_1", "Redis cache"), ops: newOps });
  expect(store.get("p_1")?.title).toBe("Redis cache");
  expect(files.log.at(-1)).toMatchObject({
    event: "revised",
    proposal: { title: "Redis cache" },
  });
  const replayed = newStore(fakeFiles(files.log));
  await replayed.load();
  expect(replayed.get("p_1")?.title).toBe("Redis cache");
});

test("reconcile rejects a pending proposal whose ghosts stay gone, and skips one being revised", async () => {
  const files = fakeFiles();
  const store = newStore(files);
  const onMain = (id: string) => ({ ...proposal(id), board: "main" });
  for (const id of ["p_1", "p_2", "p_3"]) await store.proposed(onMain(id));
  await store.proposed(proposal("p_4"));
  await store.beginRevise("p_3");
  const saved = [
    // A deleted ghost and an accepted element (no ghost tag) do not keep p_1 alive.
    { isDeleted: true, customData: { proposalId: "p_1", ghost: "add" } },
    { customData: { origin: "ai", proposalId: "p_1" } },
    { customData: { proposalId: "p_2", ghost: "update" } },
    {},
  ];

  // The first save that misses p_1's ghosts only marks it.
  clock += 10_000;
  expect(await store.reconcile("main", saved)).toEqual([]);
  clock += 3_000;
  expect(await store.reconcile("main", saved)).toEqual([onMain("p_1")]);

  expect(store.pending().map((p) => p.id)).toEqual(["p_2", "p_3", "p_4"]);
  expect(files.log.at(-1)).toMatchObject({ event: "rejected", id: "p_1" });
  expect(store.takeNotes()).toEqual(["[Proposal p_1 was rejected.]"]);
});

test("reconcile leaves a proposal younger than the propose grace period unmarked", async () => {
  const store = newStore(fakeFiles());
  await store.proposed(proposal("p_1"));

  clock += 1_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  // 10 s after logging is its first strike, not its second.
  clock += 9_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  expect(store.pending().map((p) => p.id)).toEqual(["p_1"]);

  clock += 3_000;
  expect(await store.reconcile("flow", [])).toEqual([proposal("p_1")]);
  expect(store.pending()).toEqual([]);
});

test("reconcile rejects only once the ghosts have been gone for the removal grace period", async () => {
  const store = newStore(fakeFiles());
  await store.proposed(proposal("p_1"));
  const ghost = [{ customData: { proposalId: "p_1", ghost: "add" } }];
  clock += 10_000;

  // Marked, kept 1 s later, then an undo brings the ghosts back and clears the mark.
  expect(await store.reconcile("flow", [])).toEqual([]);
  clock += 1_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  clock += 1_000;
  expect(await store.reconcile("flow", ghost)).toEqual([]);
  // Missing again 3 s after the first mark: a fresh mark, not a rejection.
  clock += 1_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  clock += 2_999;
  expect(await store.reconcile("flow", [])).toEqual([]);
  clock += 1;
  expect(await store.reconcile("flow", [])).toEqual([proposal("p_1")]);
});

test("a revision clears the removal mark", async () => {
  const store = newStore(fakeFiles());
  await store.proposed(proposal("p_1"));
  clock += 10_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  await store.revised({ ...proposal("p_1"), ops: newOps });
  // Past both grace periods: the revision's own first strike, not the old mark's second.
  clock += 5_000;
  expect(await store.reconcile("flow", [])).toEqual([]);
  expect(store.pending().map((p) => p.id)).toEqual(["p_1"]);
});
