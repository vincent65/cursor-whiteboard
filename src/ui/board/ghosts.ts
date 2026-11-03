import type { Decision, Op, Proposal } from "../../shared/proposals";
import { isRef, refIndex } from "../../shared/refs";

// Pure ghost logic: proposals land on the board as tagged, restyled elements
// and only an accept makes them real. No Excalidraw import, so plain objects
// stand in for scene elements in tests.

export type GhostKind = "add" | "update" | "delete";
export type Before = Partial<{
  strokeStyle: string;
  opacity: number;
  strokeColor: string;
  backgroundColor: string;
  label: string;
  customData: Record<string, unknown> | undefined;
}>;
export type Ghost = {
  origin: "ai";
  proposalId: string;
  ghost: GhostKind;
  before?: Before;
};
// The slice of an Excalidraw element this module touches.
export type El = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  opacity: number;
  strokeStyle: string;
  strokeColor: string;
  backgroundColor: string;
  groupIds: readonly string[];
  containerId?: string | null;
  text?: string;
  originalText?: string;
  boundElements?: readonly { id: string; type: string }[] | null;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  points?: readonly (readonly [number, number])[];
  startBinding?: Binding | null;
  endBinding?: Binding | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  customData?: Record<string, unknown>;
};
export type Binding = { elementId: string; focus: number; gap: number };
export type Bounds = { x: number; y: number; w: number; h: number };
// Scene coordinates: x = -scrollX, y = -scrollY, w = width / zoom, h = height / zoom.
export type Viewport = Bounds;
export type Counts = { added: number; updated: number; deleted: number };

const GAP_X = 80;
const GAP_Y = 40;
const GHOST_OPACITY = 40;
const DELETE_COLOR = "#e03131";
const ARROW_COLOR = "#1e1e1e";
// Excalidraw's default label size and Excalifont, as its own arrow labels use.
const LABEL_FONT = { fontSize: 20, fontFamily: 5 };
const LABEL_LINE = 25; // one line at Excalifont's 1.25 line height
const KINDS: readonly string[] = ["add", "update", "delete"];

export function ghostOf(e: El): Ghost | null {
  const c = e.customData;
  return c?.origin === "ai" &&
    typeof c.proposalId === "string" &&
    KINDS.includes(c.ghost as string)
    ? (c as Ghost)
    : null;
}

export function bounds(elements: readonly El[]): Bounds | null {
  const live = elements.filter((e) => !e.isDeleted);
  if (live.length === 0) return null;
  const x = Math.min(...live.map((e) => e.x));
  const y = Math.min(...live.map((e) => e.y));
  const right = Math.max(...live.map((e) => e.x + e.width));
  const bottom = Math.max(...live.map((e) => e.y + e.height));
  return { x, y, w: right - x, h: bottom - y };
}

export function anchor(
  elements: readonly El[],
  nearIds: readonly string[],
  selectedIds: readonly string[],
): Bounds | null {
  const of = (ids: readonly string[]) =>
    bounds(elements.filter((e) => ids.includes(e.id)));
  return of(nearIds) ?? of(selectedIds) ?? bounds(elements);
}

// Right of the anchor, shifted right past any live element the group would
// overlap, GAP_X clear of the last one; centered in the viewport without an anchor.
export function placeBeside(
  anchor: Bounds | null,
  viewport: Viewport,
  size: { w: number; h: number },
  offsetY: number,
  elements: readonly El[] = [],
): { x: number; y: number } {
  if (anchor) {
    const y = anchor.y + offsetY;
    let x = anchor.x + anchor.w + GAP_X;
    for (;;) {
      const hit = elements.filter(
        (e) =>
          !e.isDeleted &&
          e.x < x + size.w &&
          x < e.x + e.width &&
          e.y < y + size.h &&
          y < e.y + e.height,
      );
      if (hit.length === 0) return { x, y };
      x = Math.max(...hit.map((e) => e.x + e.width)) + GAP_X;
    }
  }
  return {
    x: viewport.x + (viewport.w - size.w) / 2,
    y: viewport.y + (viewport.h - size.h) / 2 + offsetY,
  };
}

const center = (b: Bounds) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// Where the line from b's center toward `to` leaves b's bounding box.
function borderPoint(b: Bounds, to: { x: number; y: number }) {
  const c = center(b);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  // ponytail: the box stands in for ellipses and diamonds too, so their arrows stop a little short.
  const t =
    dx === 0 && dy === 0
      ? 0
      : Math.min(b.w / 2 / Math.abs(dx), b.h / 2 / Math.abs(dy));
  return { x: c.x + t * dx, y: c.y + t * dy };
}

// The two existing elements add_node op i sits between: exactly two add_arrow
// ops touch it, one into it and one out of it, from two distinct existing ends.
export function betweenTargets(
  ops: readonly Op[],
  i: number,
): [string, string] | null {
  const names = (end: string) => refIndex(end) === i;
  const touching = ops.flatMap((op) =>
    op.op === "add_arrow" && (names(op.from) || names(op.to)) ? [op] : [],
  );
  if (touching.length !== 2) return null;
  const into = touching.find((op) => names(op.to));
  const out = touching.find((op) => names(op.from));
  if (!into || !out || into === out) return null;
  const [from, to] = [into.from, out.to];
  return isRef(from) || isRef(to) || from === to ? null : [from, to];
}

// A shape drags only the arrows it lists, and Excalidraw's restore does not
// list them, so each live bound arrow is added to its live ends. Elements
// that need nothing are returned as they are.
export function listBoundArrows(elements: readonly El[]): El[] {
  const arrowsOf = new Map<string, Set<string>>();
  for (const e of elements) {
    if (e.type !== "arrow" || e.isDeleted) continue;
    for (const b of [e.startBinding, e.endBinding]) {
      if (!b) continue;
      const ids = arrowsOf.get(b.elementId) ?? new Set();
      arrowsOf.set(b.elementId, ids.add(e.id));
    }
  }
  return elements.map((e) => {
    if (e.isDeleted) return e;
    const missing = [...(arrowsOf.get(e.id) ?? [])].filter(
      (id) => !e.boundElements?.some((b) => b.id === id),
    );
    if (missing.length === 0) return e;
    const listed = missing.map((id) => ({ id, type: "arrow" }));
    return { ...e, boundElements: [...(e.boundElements ?? []), ...listed] };
  });
}

export function pendingProposals(
  elements: readonly El[],
): { id: string; counts: Counts }[] {
  const byId = new Map<string, Counts>();
  const key = { add: "added", update: "updated", delete: "deleted" } as const;
  for (const e of elements) {
    const g = ghostOf(e);
    if (!g || e.isDeleted) continue;
    let counts = byId.get(g.proposalId);
    if (!counts) {
      counts = { added: 0, updated: 0, deleted: 0 };
      byId.set(g.proposalId, counts);
    }
    // A delete ghost's bound label is tagged too; count only the container.
    if (!e.containerId) counts[key[g.ghost]]++;
  }
  return [...byId].map(([id, counts]) => ({ id, counts }));
}

export function labelOf(elements: readonly El[], id: string): El | undefined {
  return elements.find(
    (e) =>
      !e.isDeleted &&
      (e.containerId === id || (e.id === id && e.type === "text")),
  );
}

export function applyProposal(
  elements: readonly El[],
  proposal: Proposal,
  rendered: ReadonlyMap<number, El[]>,
  ctx: { selectedIds: readonly string[]; viewport: Viewport },
): { elements: El[]; ids: string[] } {
  const live = (id: string) =>
    elements.find((e) => e.id === id && !e.isDeleted);
  // An existing element an op touches must not be in another pending proposal.
  const claim = (id: string) => {
    const target = live(id);
    if (!target) throw new Error(`unknown element id ${id}`);
    const other = ghostOf(target)?.proposalId;
    if (other && other !== proposal.id)
      throw new Error(`element ${id} is in pending proposal ${other}`);
  };
  proposal.ops.forEach((op, i) => {
    if (op.op === "add_arrow") {
      for (const end of [op.from, op.to]) {
        if (isRef(end)) {
          const j = refIndex(end);
          if (j === null || j >= i || proposal.ops[j].op !== "add_node")
            throw new Error(`op ${i}: ${end} must name an earlier add_node`);
          continue;
        }
        claim(end);
        if (proposal.ops.some((o) => o.op === "delete" && o.id === end))
          throw new Error(
            `op ${i}: arrow end ${end} is deleted by this proposal`,
          );
      }
    } else if (op.op === "update" || op.op === "delete") {
      claim(op.id);
      if (
        op.op === "update" &&
        op.label !== undefined &&
        !labelOf(elements, op.id)
      )
        throw new Error(`element ${op.id} has no label`);
    } else if (!rendered.has(i)) {
      throw new Error(`op ${i} was not rendered`);
    } else if (!bounds(rendered.get(i) ?? [])) {
      throw new Error(`op ${i} rendered nothing`);
    }
  });

  const out = [...elements];
  const ids: string[] = [];
  const at = (id: string) => out.findIndex((e) => e.id === id && !e.isDeleted);
  const tag = (ghost: GhostKind, before?: Before): Ghost => ({
    origin: "ai",
    proposalId: proposal.id,
    ghost,
    ...(before && { before }),
  });
  // A second op on the same element keeps the first op's originals.
  const snapshot = (e: El, before: Before): Before => {
    const prev = ghostOf(e);
    return prev?.proposalId === proposal.id
      ? { ...before, ...prev.before }
      : before;
  };
  let offsetY = 0;
  let stackTop: { x: number; y: number } | undefined;
  // The placed shape of each add_node op, by op index, for $ references.
  const nodes = new Map<number, El>();

  proposal.ops.forEach((op, i) => {
    if (op.op === "add_arrow") return;
    if (
      op.op === "add_diagram" ||
      op.op === "add_note" ||
      op.op === "add_node"
    ) {
      const group = rendered.get(i) ?? [];
      const b = bounds(group) as Bounds;
      const ends =
        op.op === "add_node" ? betweenTargets(proposal.ops, i) : null;
      let to: { x: number; y: number };
      if (ends) {
        // The shape (not its label) is centered on the midpoint of its two
        // neighbours' centers, out of the stack.
        const [p, q] = ends.map((id) =>
          center(bounds([live(id) as El]) as Bounds),
        );
        const shape = bounds(group.filter((e) => !e.containerId)) as Bounds;
        to = {
          x: (p.x + q.x - shape.w) / 2 - (shape.x - b.x),
          y: (p.y + q.y - shape.h) / 2 - (shape.y - b.y),
        };
      } else {
        const a = anchor(elements, op.near ?? [], ctx.selectedIds);
        // With nothing to anchor on, later groups stack under the centered first one.
        to =
          !a && stackTop
            ? { x: stackTop.x, y: stackTop.y + offsetY }
            : placeBeside(a, ctx.viewport, b, offsetY, out);
        if (!a) stackTop ??= to;
        offsetY += b.h + GAP_Y;
      }
      for (const e of group) {
        const placed: El = {
          ...e,
          x: e.x + to.x - b.x,
          y: e.y + to.y - b.y,
          opacity: GHOST_OPACITY,
          strokeStyle: "dashed",
          // Excalidraw lists groups innermost first, so the proposal is outermost.
          groupIds: [...e.groupIds, proposal.id],
          customData: tag("add", { strokeStyle: e.strokeStyle }),
        };
        out.push(placed);
        ids.push(e.id);
        if (op.op === "add_node" && !e.containerId) nodes.set(i, placed);
      }
      return;
    }

    const idx = at(op.id);
    const cur = out[idx];
    if (!ids.includes(cur.id)) ids.push(cur.id);
    if (op.op === "delete") {
      const before = snapshot(cur, {
        strokeStyle: cur.strokeStyle,
        opacity: cur.opacity,
        strokeColor: cur.strokeColor,
        customData: cur.customData,
      });
      out[idx] = {
        ...cur,
        opacity: GHOST_OPACITY,
        strokeStyle: "dashed",
        strokeColor: DELETE_COLOR,
        customData: tag("delete", before),
      };
      const label = labelOf(out, cur.id);
      if (label && label !== cur) {
        const labelBefore = snapshot(label, {
          opacity: label.opacity,
          customData: label.customData,
        });
        out[out.indexOf(label)] = {
          ...label,
          opacity: GHOST_OPACITY,
          customData: tag("delete", labelBefore),
        };
      }
      return;
    }

    // An element this proposal already deletes takes no further updates.
    const prev = ghostOf(cur);
    if (prev?.proposalId === proposal.id && prev.ghost === "delete") return;
    const before: Before = {
      strokeStyle: cur.strokeStyle,
      customData: cur.customData,
    };
    const next: El = { ...cur, strokeStyle: "dashed" };
    if (op.strokeColor !== undefined) {
      before.strokeColor = cur.strokeColor;
      next.strokeColor = op.strokeColor;
    }
    if (op.backgroundColor !== undefined) {
      before.backgroundColor = cur.backgroundColor;
      next.backgroundColor = op.backgroundColor;
    }
    if (op.label !== undefined) {
      const label = labelOf(out, cur.id) as El;
      // originalText is the unwrapped source; text carries the wrap breaks.
      before.label = label.originalText ?? label.text;
      if (label === cur)
        Object.assign(next, { text: op.label, originalText: op.label });
      else {
        const li = out.indexOf(label);
        out[li] = { ...label, text: op.label, originalText: op.label };
      }
    }
    next.customData = tag("update", snapshot(cur, before));
    out[idx] = next;
  });

  // Arrows go last, so both ends are where this proposal leaves them.
  const ghostStyle = {
    opacity: GHOST_OPACITY,
    strokeStyle: "dashed",
    backgroundColor: "transparent",
    groupIds: [proposal.id],
    customData: tag("add", { strokeStyle: "solid" }),
  };
  const end = (ref: string) =>
    isRef(ref) ? (nodes.get(refIndex(ref) as number) as El) : (live(ref) as El);
  for (const op of proposal.ops) {
    if (op.op !== "add_arrow") continue;
    const from = end(op.from);
    const to = end(op.to);
    const fb = bounds([from]) as Bounds;
    const tb = bounds([to]) as Bounds;
    const start = borderPoint(fb, center(tb));
    const stop = borderPoint(tb, center(fb));
    const dx = stop.x - start.x;
    const dy = stop.y - start.y;
    const arrow: El = {
      ...ghostStyle,
      id: crypto.randomUUID(),
      type: "arrow",
      x: start.x,
      y: start.y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      strokeColor: ARROW_COLOR,
      points: [
        [0, 0],
        [dx, dy],
      ],
      startBinding: { elementId: from.id, focus: 0, gap: 1 },
      endBinding: { elementId: to.id, focus: 0, gap: 1 },
      startArrowhead: null,
      endArrowhead: "arrow",
    };
    out.push(arrow);
    ids.push(arrow.id);
    if (op.label === undefined) continue;
    // Restoring drops a zero-sized element and grows a centered text from x
    // both ways but from y downward, so it starts one line tall around the midpoint.
    // ponytail: a label that wraps to two lines sits half a line low until the arrow moves.
    const label: El = {
      ...ghostStyle,
      ...LABEL_FONT,
      id: crypto.randomUUID(),
      type: "text",
      x: start.x + dx / 2,
      y: start.y + dy / 2 - LABEL_LINE / 2,
      width: 0,
      height: LABEL_LINE,
      strokeColor: ARROW_COLOR,
      containerId: arrow.id,
      text: op.label,
      originalText: op.label,
      textAlign: "center",
      verticalAlign: "middle",
    };
    out.push(label);
    ids.push(label.id);
  }
  return { elements: out, ids };
}

export function decideProposal(
  elements: readonly El[],
  id: string,
  decision: Decision,
): El[] {
  const out = [...elements];
  const patch = (target: El, change: Partial<El>) => {
    out[out.indexOf(target)] = { ...target, ...change };
  };
  // Index loop over `out`, so a label patched earlier is seen as it is now.
  for (const [i, e] of out.entries()) {
    const g = ghostOf(e);
    if (!g || g.proposalId !== id || e.isDeleted) continue;
    const real = { origin: "ai", proposalId: id };
    const label = g.ghost === "add" ? undefined : labelOf(out, e.id);

    if (decision === "accepted") {
      if (g.ghost === "add")
        out[i] = {
          ...e,
          opacity: 100,
          strokeStyle: g.before?.strokeStyle ?? "solid",
          customData: real,
        };
      else if (g.ghost === "update")
        out[i] = {
          ...e,
          strokeStyle: g.before?.strokeStyle ?? "solid",
          customData: real,
        };
      else {
        out[i] = { ...e, isDeleted: true };
        if (label && label !== e) patch(label, { isDeleted: true });
        // As Excalidraw's own delete does; restore keeps bindings to deleted elements.
        for (const a of out) {
          if (a.type !== "arrow" || a.isDeleted) continue;
          const start = a.startBinding?.elementId === e.id;
          const end = a.endBinding?.elementId === e.id;
          if (start || end)
            patch(a, {
              ...(start && { startBinding: null }),
              ...(end && { endBinding: null }),
            });
        }
      }
    } else if (g.ghost === "add") {
      out[i] = { ...e, isDeleted: true };
    } else {
      const { label: text, customData, ...style } = g.before ?? {};
      const { customData: _, ...rest } = e;
      const restored: El = { ...rest, ...style };
      if (customData !== undefined) restored.customData = customData;
      if (text !== undefined && label) {
        if (label === e) Object.assign(restored, { text, originalText: text });
        else patch(label, { text, originalText: text });
      }
      out[i] = restored;
    }
  }
  return out;
}
