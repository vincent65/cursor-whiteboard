import type { Decision, Proposal } from "../../shared/proposals";

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
  customData?: Record<string, unknown>;
};
export type Bounds = { x: number; y: number; w: number; h: number };
// Scene coordinates: x = -scrollX, y = -scrollY, w = width / zoom, h = height / zoom.
export type Viewport = Bounds;
export type Counts = { added: number; updated: number; deleted: number };

const GAP_X = 80;
const GAP_Y = 40;
const GHOST_OPACITY = 40;
const DELETE_COLOR = "#e03131";
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

export function placeBeside(
  anchor: Bounds | null,
  viewport: Viewport,
  size: { w: number; h: number },
  offsetY: number,
): { x: number; y: number } {
  if (anchor) return { x: anchor.x + anchor.w + GAP_X, y: anchor.y + offsetY };
  return {
    x: viewport.x + (viewport.w - size.w) / 2,
    y: viewport.y + (viewport.h - size.h) / 2 + offsetY,
  };
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
    counts[key[g.ghost]]++;
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
  proposal.ops.forEach((op, i) => {
    if (op.op === "update" || op.op === "delete") {
      if (!live(op.id)) throw new Error(`unknown element id ${op.id}`);
      if (
        op.op === "update" &&
        op.label !== undefined &&
        !labelOf(elements, op.id)
      )
        throw new Error(`element ${op.id} has no label`);
    } else if (!rendered.has(i)) {
      throw new Error(`op ${i} was not rendered`);
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

  proposal.ops.forEach((op, i) => {
    if (op.op === "add_diagram" || op.op === "add_note") {
      const group = rendered.get(i) ?? [];
      const b = bounds(group);
      if (!b) return;
      const a = anchor(elements, op.near ?? [], ctx.selectedIds);
      // With nothing to anchor on, later groups stack under the centered first one.
      const to =
        !a && stackTop
          ? { x: stackTop.x, y: stackTop.y + offsetY }
          : placeBeside(a, ctx.viewport, b, offsetY);
      if (!a) stackTop ??= to;
      for (const e of group) {
        out.push({
          ...e,
          x: e.x + to.x - b.x,
          y: e.y + to.y - b.y,
          opacity: GHOST_OPACITY,
          strokeStyle: "dashed",
          groupIds: [proposal.id, ...e.groupIds],
          customData: tag("add"),
        });
        ids.push(e.id);
      }
      offsetY += b.h + GAP_Y;
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
      before.label = label.text;
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
        out[i] = { ...e, opacity: 100, strokeStyle: "solid", customData: real };
      else if (g.ghost === "update")
        out[i] = {
          ...e,
          strokeStyle: g.before?.strokeStyle ?? "solid",
          customData: real,
        };
      else {
        out[i] = { ...e, isDeleted: true };
        if (label && label !== e) patch(label, { isDeleted: true });
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
