import type { Proposal } from "../../src/shared/proposals";
import {
  applyProposal,
  betweenTargets,
  bounds,
  decideProposal,
  type El,
  ghostOf,
  labelOf,
  pendingProposals,
  placeBeside,
} from "../../src/ui/board/ghosts";

const el = (over: Partial<El> & { id: string }): El => ({
  type: "rectangle",
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  opacity: 100,
  strokeStyle: "solid",
  strokeColor: "#1e1e1e",
  backgroundColor: "#eee",
  groupIds: [],
  ...over,
});

const p: Proposal = {
  id: "p_1",
  board: "b",
  title: null,
  ops: [],
  at: "2026-11-02T00:00:00.000Z",
};
const viewport = { x: 0, y: 0, w: 1000, h: 800 };
const ctx = { selectedIds: [], viewport };
const byId = (els: readonly El[], id: string) => {
  const found = els.find((e) => e.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const added = (els: readonly El[]) =>
  els.filter((e) => ghostOf(e)?.ghost === "add");

test("add ops land beside the anchor with the ghost style, group, and tag", () => {
  const a = el({ id: "a" });
  const rendered = new Map([
    [
      0,
      [
        el({ id: "r1", x: 10, y: 10, width: 60, height: 30 }),
        el({ id: "r2", x: 10, y: 60, width: 40, height: 30, groupIds: ["g"] }),
      ],
    ],
  ]);
  const { elements, ids } = applyProposal(
    [a],
    { ...p, ops: [{ op: "add_diagram", mermaid: "x", near: ["a"] }] },
    rendered,
    ctx,
  );
  const ghosts = added(elements);
  expect(bounds(ghosts)).toEqual({ x: 180, y: 0, w: 60, h: 80 });
  for (const g of ghosts) {
    expect(g.opacity).toBe(40);
    expect(g.strokeStyle).toBe("dashed");
    expect(g.groupIds.at(-1)).toBe("p_1");
    expect(g.customData).toEqual({
      origin: "ai",
      proposalId: "p_1",
      ghost: "add",
      before: { strokeStyle: "solid" },
    });
  }
  expect(byId(elements, "r2").groupIds).toEqual(["g", "p_1"]);
  expect(ids).toEqual(["r1", "r2"]);
  expect(elements[0]).toBe(a);
  expect(rendered.get(0)?.[0].x).toBe(10);
});

test("two additions stack downward with a 40px gap, and an empty board centers in the viewport", () => {
  const ops: Proposal["ops"] = [
    { op: "add_note", text: "one" },
    { op: "add_note", text: "two" },
  ];
  const rendered = new Map([
    [0, [el({ id: "n1", x: 500, y: 500, width: 200, height: 100 })]],
    [1, [el({ id: "n2", x: -50, y: -50, width: 80, height: 40 })]],
  ]);
  const beside = applyProposal(
    [el({ id: "a" })],
    { ...p, ops },
    rendered,
    ctx,
  ).elements;
  expect(byId(beside, "n1")).toMatchObject({ x: 180, y: 0 });
  expect(byId(beside, "n2")).toMatchObject({ x: 180, y: 140 });

  const empty = applyProposal(
    [el({ id: "gone", isDeleted: true })],
    { ...p, ops },
    rendered,
    { selectedIds: [], viewport: { x: -100, y: 0, w: 1000, h: 800 } },
  ).elements;
  expect(byId(empty, "n1")).toMatchObject({ x: 300, y: 350 });
  expect(byId(empty, "n2")).toMatchObject({ x: 300, y: 490 });
});

test("placeBeside and the anchor fall back from near ids to the selection to everything", () => {
  expect(
    placeBeside({ x: 0, y: 10, w: 100, h: 50 }, viewport, { w: 1, h: 1 }, 30),
  ).toEqual({ x: 180, y: 40 });
  const els = [
    el({ id: "a" }),
    el({ id: "b", x: 500, y: 300 }),
    el({ id: "c", x: 1000, y: 600 }),
  ];
  const at = (near: string[], selectedIds: string[]) =>
    byId(
      applyProposal(
        els,
        { ...p, ops: [{ op: "add_note", text: "n", near }] },
        new Map([[0, [el({ id: "n" })]]]),
        { selectedIds, viewport },
      ).elements,
      "n",
    );
  expect(at(["b", "missing"], ["a"])).toMatchObject({ x: 680, y: 300 });
  expect(at(["missing"], ["a"])).toMatchObject({ x: 180, y: 0 });
  expect(at([], [])).toMatchObject({ x: 1180, y: 0 });
});

test("update snapshots before values, dashes the stroke, and rewrites the bound label", () => {
  const b = el({ id: "b" });
  const t = el({
    id: "t",
    type: "text",
    containerId: "b",
    text: "Old",
    originalText: "Old",
  });
  const { elements, ids } = applyProposal(
    [b, t],
    {
      ...p,
      ops: [{ op: "update", id: "b", label: "New", backgroundColor: "#fff" }],
    },
    new Map(),
    ctx,
  );
  const nb = byId(elements, "b");
  const nt = byId(elements, "t");
  expect(nt.text).toBe("New");
  expect(nt.originalText).toBe("New");
  expect(nb.strokeStyle).toBe("dashed");
  expect(nb.backgroundColor).toBe("#fff");
  expect(nb.strokeColor).toBe("#1e1e1e");
  expect(nb.customData?.before).toEqual({
    strokeStyle: "solid",
    backgroundColor: "#eee",
    label: "Old",
    customData: undefined,
  });
  expect(ghostOf(nb)).toMatchObject({ proposalId: "p_1", ghost: "update" });
  expect(ids).toEqual(["b"]);
  expect(b.strokeStyle).toBe("solid");
  expect(t.text).toBe("Old");
});

test("a text element is its own label", () => {
  const t = el({ id: "t", type: "text", text: "Hi", originalText: "Hi" });
  expect(labelOf([t], "t")).toBe(t);
  const { elements } = applyProposal(
    [t],
    { ...p, ops: [{ op: "update", id: "t", label: "Bye" }] },
    new Map(),
    ctx,
  );
  expect(byId(elements, "t")).toMatchObject({
    text: "Bye",
    originalText: "Bye",
  });
  const rejected = decideProposal(elements, "p_1", "rejected");
  expect(byId(rejected, "t")).toEqual(t);
});

test("delete shows red dashed at opacity 40 and keeps the element", () => {
  const d = el({ id: "d", customData: { mine: 1 } });
  const { elements } = applyProposal(
    [d],
    { ...p, ops: [{ op: "delete", id: "d" }] },
    new Map(),
    ctx,
  );
  const nd = byId(elements, "d");
  expect(nd).toMatchObject({
    opacity: 40,
    strokeStyle: "dashed",
    strokeColor: "#e03131",
  });
  expect(nd.isDeleted).toBeFalsy();
  expect(ghostOf(nd)).toEqual({
    origin: "ai",
    proposalId: "p_1",
    ghost: "delete",
    before: {
      strokeStyle: "solid",
      opacity: 100,
      strokeColor: "#1e1e1e",
      customData: { mine: 1 },
    },
  });
});

test("an unknown id throws before anything changes", () => {
  const els = [el({ id: "a" }), el({ id: "x", isDeleted: true })];
  const snapshot = structuredClone(els);
  expect(() =>
    applyProposal(
      els,
      { ...p, ops: [{ op: "delete", id: "nope" }] },
      new Map(),
      ctx,
    ),
  ).toThrow("unknown element id nope");
  expect(() =>
    applyProposal(
      els,
      {
        ...p,
        ops: [
          { op: "update", id: "a", strokeColor: "#000" },
          { op: "delete", id: "x" },
        ],
      },
      new Map(),
      ctx,
    ),
  ).toThrow("unknown element id x");
  expect(els).toEqual(snapshot);
});

test("pendingProposals counts per proposal in first-seen order and ignores deleted ghosts", () => {
  const tag = (proposalId: string, ghost: string) => ({
    origin: "ai",
    proposalId,
    ghost,
  });
  const els = [
    el({ id: "1", customData: tag("p_2", "update") }),
    el({ id: "2", customData: tag("p_1", "add") }),
    el({ id: "3", customData: tag("p_2", "add") }),
    el({ id: "4", customData: tag("p_2", "delete") }),
    el({ id: "5", customData: tag("p_2", "add"), isDeleted: true }),
    el({ id: "6", customData: tag("p_3", "add"), isDeleted: true }),
    el({ id: "7", customData: { origin: "ai", proposalId: "p_1" } }),
    el({ id: "8" }),
  ];
  expect(pendingProposals(els)).toEqual([
    { id: "p_2", counts: { added: 1, updated: 1, deleted: 1 } },
    { id: "p_1", counts: { added: 1, updated: 0, deleted: 0 } },
  ]);
});

const board = () => {
  const a = el({ id: "a" });
  const u = el({ id: "u", x: 200 });
  const ut = el({
    id: "ut",
    type: "text",
    containerId: "u",
    text: "Old",
    originalText: "Old",
  });
  const d = el({ id: "d", x: 400, customData: { mine: 1 } });
  const dt = el({
    id: "dt",
    type: "text",
    containerId: "d",
    text: "Bye",
    originalText: "Bye",
  });
  return [a, u, ut, d, dt];
};
const mixed: Proposal = {
  ...p,
  ops: [
    { op: "add_note", text: "n" },
    { op: "update", id: "u", label: "New", strokeColor: "#f00" },
    { op: "delete", id: "d" },
  ],
};
const apply = (els: El[], nid = "n") =>
  applyProposal(els, mixed, new Map([[0, [el({ id: nid })]]]), ctx).elements;

test("accept makes additions real, keeps updates, deletes deletions with their labels", () => {
  const els = board();
  const applied = apply(els);
  const out = decideProposal(applied, "p_1", "accepted");
  expect(byId(out, "n")).toMatchObject({
    opacity: 100,
    strokeStyle: "solid",
    customData: { origin: "ai", proposalId: "p_1" },
  });
  expect(byId(out, "n").customData).toEqual({
    origin: "ai",
    proposalId: "p_1",
  });
  expect(byId(out, "u")).toMatchObject({
    strokeStyle: "solid",
    strokeColor: "#f00",
  });
  expect(byId(out, "u").customData).toEqual({
    origin: "ai",
    proposalId: "p_1",
  });
  expect(byId(out, "ut").text).toBe("New");
  expect(byId(out, "d").isDeleted).toBe(true);
  expect(byId(out, "dt").isDeleted).toBe(true);
  expect(byId(out, "a")).toBe(els[0]);
  expect(pendingProposals(out)).toEqual([]);
  expect(byId(applied, "d").isDeleted).toBeFalsy();
});

test("accepting an addition keeps its rendered stroke style", () => {
  const arrow = el({ id: "ar", type: "arrow", strokeStyle: "dotted" });
  const { elements } = applyProposal(
    [],
    { ...p, ops: [{ op: "add_diagram", mermaid: "x" }] },
    new Map([[0, [arrow]]]),
    ctx,
  );
  expect(byId(elements, "ar").strokeStyle).toBe("dashed");
  expect(byId(decideProposal(elements, "p_1", "accepted"), "ar")).toMatchObject(
    { strokeStyle: "dotted", opacity: 100 },
  );
});

test("reject removes additions and restores updates and deletions exactly", () => {
  const els = board();
  const out = decideProposal(apply(els), "p_1", "rejected");
  expect(byId(out, "n").isDeleted).toBe(true);
  expect(byId(out, "u")).toEqual(els[1]);
  expect(byId(out, "u")).not.toHaveProperty("customData");
  expect(byId(out, "ut")).toEqual(els[2]);
  expect(byId(out, "d")).toEqual(els[3]);
  expect(byId(out, "dt")).toEqual(els[4]);
  expect(pendingProposals(out)).toEqual([]);
});

test("two ops on one element reject back to the original", () => {
  const u = el({ id: "u" });
  const { elements } = applyProposal(
    [u],
    {
      ...p,
      ops: [
        { op: "update", id: "u", strokeColor: "#f00" },
        { op: "delete", id: "u" },
      ],
    },
    new Map(),
    ctx,
  );
  expect(ghostOf(byId(elements, "u"))?.ghost).toBe("delete");
  expect(byId(decideProposal(elements, "p_1", "rejected"), "u")).toEqual(u);

  const deletedFirst = applyProposal(
    [u],
    {
      ...p,
      ops: [
        { op: "delete", id: "u" },
        { op: "update", id: "u", strokeColor: "#f00" },
      ],
    },
    new Map(),
    ctx,
  ).elements;
  expect(byId(deletedFirst, "u").strokeColor).toBe("#e03131");
  expect(ghostOf(byId(deletedFirst, "u"))?.ghost).toBe("delete");
});

test("replace flow: rejecting p_1 then applying p_1 again leaves one pending proposal", () => {
  const once = apply(board());
  const again = apply(decideProposal(once, "p_1", "rejected"), "n2");
  expect(pendingProposals(again)).toEqual([
    { id: "p_1", counts: { added: 1, updated: 1, deleted: 1 } },
  ]);
  const out = decideProposal(again, "p_1", "rejected");
  expect(byId(out, "u")).toEqual(board()[1]);
  expect(pendingProposals(out)).toEqual([]);
});

test("an element in another pending proposal is refused before anything changes", () => {
  const { elements } = applyProposal(
    [el({ id: "a" })],
    { ...p, ops: [{ op: "update", id: "a", strokeColor: "#f00" }] },
    new Map(),
    ctx,
  );
  const snapshot = structuredClone(elements);
  for (const op of [
    { op: "delete", id: "a" },
    { op: "update", id: "a", backgroundColor: "#000" },
  ] as const)
    expect(() =>
      applyProposal(elements, { ...p, id: "p_2", ops: [op] }, new Map(), ctx),
    ).toThrow("element a is in pending proposal p_1");
  expect(elements).toEqual(snapshot);
});

test("a wrapped label rejects back to its original text", () => {
  const b = el({ id: "b" });
  const t = el({
    id: "t",
    type: "text",
    containerId: "b",
    text: "A long\nlabel",
    originalText: "A long label",
  });
  const { elements } = applyProposal(
    [b, t],
    { ...p, ops: [{ op: "update", id: "b", label: "New" }] },
    new Map(),
    ctx,
  );
  expect(ghostOf(byId(elements, "b"))?.before?.label).toBe("A long label");
  expect(byId(decideProposal(elements, "p_1", "rejected"), "t")).toMatchObject({
    text: "A long label",
    originalText: "A long label",
  });
});

test("an add op that renders nothing throws", () => {
  expect(() =>
    applyProposal(
      [],
      { ...p, ops: [{ op: "add_note", text: "n" }] },
      new Map([[0, []]]),
      ctx,
    ),
  ).toThrow("op 0 rendered nothing");
});

test("a delete ghost fades its label too and counts the pair once", () => {
  const d = el({ id: "d" });
  const dt = el({ id: "dt", type: "text", containerId: "d", text: "Bye" });
  const { elements } = applyProposal(
    [d, dt],
    { ...p, ops: [{ op: "delete", id: "d" }] },
    new Map(),
    ctx,
  );
  expect(byId(elements, "dt").opacity).toBe(40);
  expect(ghostOf(byId(elements, "dt"))).toMatchObject({
    proposalId: "p_1",
    ghost: "delete",
    before: { opacity: 100 },
  });
  expect(pendingProposals(elements)).toEqual([
    { id: "p_1", counts: { added: 0, updated: 0, deleted: 1 } },
  ]);
  const rejected = decideProposal(elements, "p_1", "rejected");
  expect(byId(rejected, "dt")).toEqual(dt);
  const accepted = decideProposal(elements, "p_1", "accepted");
  expect(byId(accepted, "dt").isDeleted).toBe(true);
});

// Boxes a (0,0) and b (400,0), 100x50, joined by arrow ab.
const connected = () => [
  el({ id: "a" }),
  el({ id: "b", x: 400 }),
  el({
    id: "ab",
    type: "arrow",
    x: 100,
    y: 25,
    width: 300,
    height: 0,
    points: [
      [0, 0],
      [300, 0],
    ],
    startBinding: { elementId: "a", focus: 0, gap: 1 },
    endBinding: { elementId: "b", focus: 0, gap: 1 },
  }),
];
const between: Proposal = {
  ...p,
  ops: [
    { op: "delete", id: "ab" },
    { op: "add_node", label: "Cache", kind: "box", near: ["a"] },
    { op: "add_arrow", from: "a", to: "$1" },
    { op: "add_arrow", from: "$1", to: "b", label: "reads" },
  ],
};
const cacheNode = () =>
  new Map([
    [
      1,
      [
        el({ id: "n", x: 5, y: 5 }),
        el({ id: "nt", type: "text", containerId: "n", x: 30, y: 20 }),
      ],
    ],
  ]);
const arrows = (els: readonly El[]) =>
  added(els).filter((e) => e.type === "arrow");

test("a node between two existing elements is centered between them and add_arrow binds both ends", () => {
  const els = connected();
  const { elements, ids } = applyProposal(els, between, cacheNode(), ctx);
  // Centers (50,25) and (450,25) meet at (250,25); near is ignored.
  expect(byId(elements, "n")).toMatchObject({ x: 200, y: 0 });
  expect(byId(elements, "nt")).toMatchObject({ x: 225, y: 15 });
  const [into, out] = arrows(elements);
  expect(into).toMatchObject({
    x: 100,
    y: 25,
    width: 100,
    height: 0,
    points: [
      [0, 0],
      [100, 0],
    ],
    startBinding: { elementId: "a", focus: 0, gap: 1 },
    endBinding: { elementId: "n", focus: 0, gap: 1 },
    startArrowhead: null,
    endArrowhead: "arrow",
  });
  expect(out).toMatchObject({
    x: 300,
    y: 25,
    points: [
      [0, 0],
      [100, 0],
    ],
    startBinding: { elementId: "n" },
    endBinding: { elementId: "b" },
  });
  for (const g of [into, out]) {
    expect(g).toMatchObject({ opacity: 40, strokeStyle: "dashed" });
    expect(g.groupIds).toEqual(["p_1"]);
    expect(g.customData).toEqual({
      origin: "ai",
      proposalId: "p_1",
      ghost: "add",
      before: { strokeStyle: "solid" },
    });
  }
  // The label is bound text at the midpoint, tagged like its arrow.
  const label = added(elements).find((e) => e.containerId === out.id) as El;
  expect(label).toMatchObject({
    type: "text",
    text: "reads",
    originalText: "reads",
    // One 20px line tall, so restoring keeps it and centers it on the midpoint.
    x: 350,
    y: 12.5,
    width: 0,
    height: 25,
    opacity: 40,
    groupIds: ["p_1"],
    customData: into.customData,
  });
  expect(ids).toEqual(["ab", "n", "nt", into.id, out.id, label.id]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(pendingProposals(elements)).toEqual([
    { id: "p_1", counts: { added: 3, updated: 0, deleted: 1 } },
  ]);
  // Targets are untouched here; BoardView lists the arrows on them.
  expect(byId(elements, "a")).toBe(els[0]);
  expect(byId(elements, "b")).toBe(els[1]);

  const accepted = decideProposal(elements, "p_1", "accepted");
  expect(arrows(accepted)).toEqual([]);
  for (const id of [into.id, out.id])
    expect(byId(accepted, id)).toMatchObject({
      opacity: 100,
      strokeStyle: "solid",
      customData: { origin: "ai", proposalId: "p_1" },
    });
  expect(byId(accepted, "ab").isDeleted).toBe(true);
  const rejected = decideProposal(elements, "p_1", "rejected");
  expect(byId(rejected, into.id).isDeleted).toBe(true);
  expect(byId(rejected, label.id).isDeleted).toBe(true);
  expect(byId(rejected, "ab")).toEqual(connected()[2]);
});

test("an arrow between diagonal shapes starts and ends on their borders", () => {
  const { elements } = applyProposal(
    [el({ id: "a" }), el({ id: "b", x: 200, y: 200, width: 100, height: 100 })],
    { ...p, ops: [{ op: "add_arrow", from: "a", to: "b" }] },
    new Map(),
    ctx,
  );
  // Centers (50,25) and (250,250): the line leaves a through its bottom edge and enters b through its top.
  const [arrow] = arrows(elements);
  expect(arrow.x).toBeCloseTo(50 + 25 * (200 / 225));
  expect(arrow.y).toBeCloseTo(50);
  const [, [dx, dy]] = arrow.points as [number, number][];
  expect(arrow.x + dx).toBeCloseTo(250 - 50 * (200 / 225));
  expect(arrow.y + dy).toBeCloseTo(200);
});

test("a $ reference to a missing node throws before anything changes", () => {
  const els = connected();
  const snapshot = structuredClone(els);
  const run = (ops: Proposal["ops"]) => () =>
    applyProposal(els, { ...p, ops }, cacheNode(), ctx);
  expect(
    run([
      { op: "delete", id: "ab" },
      { op: "add_node", label: "Cache", kind: "box" },
      { op: "add_arrow", from: "$0", to: "b" },
    ]),
  ).toThrow("op 2: $0 must name an earlier add_node");
  expect(
    run([
      { op: "delete", id: "ab" },
      { op: "add_node", label: "Cache", kind: "box" },
      { op: "add_arrow", from: "a", to: "$4" },
    ]),
  ).toThrow("op 2: $4 must name an earlier add_node");
  expect(
    run([
      { op: "delete", id: "ab" },
      { op: "add_node", label: "Cache", kind: "box" },
      { op: "add_arrow", from: "gone", to: "$1" },
    ]),
  ).toThrow("unknown element id gone");
  expect(els).toEqual(snapshot);
});

test("a node with one connecting arrow stays beside its anchor", () => {
  const { elements } = applyProposal(
    connected(),
    {
      ...p,
      ops: [
        { op: "add_arrow", from: "a", to: "b" },
        { op: "add_node", label: "Cache", kind: "box", near: ["a"] },
        { op: "add_arrow", from: "a", to: "$1" },
      ],
    },
    cacheNode(),
    ctx,
  );
  expect(byId(elements, "n")).toMatchObject({ x: 180, y: 0 });
  expect(arrows(elements)[1].endBinding?.elementId).toBe("n");
});

test("betweenTargets wants one arrow in and one out, from two distinct existing elements", () => {
  const node: Proposal["ops"][number] = {
    op: "add_node",
    label: "n",
    kind: "box",
  };
  const arrow = (from: string, to: string) =>
    ({ op: "add_arrow", from, to }) as const;
  expect(betweenTargets(between.ops, 1)).toEqual(["a", "b"]);
  // Either order in the list.
  expect(betweenTargets([node, arrow("$0", "b"), arrow("a", "$0")], 0)).toEqual(
    ["a", "b"],
  );
  expect(betweenTargets([node, arrow("a", "$0")], 0)).toBeNull();
  expect(
    betweenTargets([node, arrow("a", "$0"), arrow("b", "$0")], 0),
  ).toBeNull();
  expect(
    betweenTargets([node, arrow("a", "$0"), arrow("$0", "a")], 0),
  ).toBeNull();
  expect(
    betweenTargets([node, node, arrow("$1", "$0"), arrow("$0", "b")], 0),
  ).toBeNull();
  expect(
    betweenTargets(
      [node, arrow("a", "$0"), arrow("$0", "b"), arrow("$0", "c")],
      0,
    ),
  ).toBeNull();
  expect(betweenTargets([node, arrow("a", "b")], 0)).toBeNull();
});
