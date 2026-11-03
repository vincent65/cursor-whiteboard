import { ProposalStore } from "../../../src/server/agent/proposals.js";
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
  const store = new ProposalStore(
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
  const store = new ProposalStore(files);
  await store.load();
  const p = proposal("p_1", "Login flow");

  await store.proposed(p);
  expect(store.pending()).toEqual([p]);
  expect(files.log.at(-1)).toMatchObject({ event: "proposed", proposal: p });

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
  const store = new ProposalStore(fakeFiles());
  await store.proposed(proposal("p_2"));
  await store.decided("p_2", "rejected");
  expect(store.takeNotes()).toEqual(["[Proposal p_2 was rejected.]"]);
});

test("revised and decided reject ids that are not pending", async () => {
  const files = fakeFiles([
    { event: "proposed", at, proposal: proposal("p_1") },
    { event: "rejected", at, id: "p_1" },
  ]);
  const store = new ProposalStore(files);
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
  const store = new ProposalStore(
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
  const store = new ProposalStore(files);
  await store.proposed(proposal("p_1"));
  const results = await Promise.allSettled([
    store.decided("p_1", "accepted"),
    store.decided("p_1", "accepted"),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(files.log.map((e) => e.event)).toEqual(["proposed", "accepted"]);
  expect(store.takeNotes()).toHaveLength(1);
});
