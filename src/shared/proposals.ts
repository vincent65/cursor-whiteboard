import { z } from "zod";
import { isRef, refIndex } from "./refs.js";

// The operations Claude's propose and revise tools accept.
export const Op = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_diagram"),
    mermaid: z.string().min(1),
    near: z.array(z.string()).optional(),
  }),
  z.object({
    op: z.literal("add_note"),
    text: z.string().min(1),
    near: z.array(z.string()).optional(),
  }),
  z.object({
    op: z.literal("update"),
    id: z.string(),
    label: z.string().optional(),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  }),
  z.object({ op: z.literal("delete"), id: z.string() }),
  z.object({
    op: z.literal("add_node"),
    label: z.string().min(1),
    kind: z.enum(["box", "ellipse", "diamond"]).default("box"),
    near: z.array(z.string()).optional(),
  }),
  // from and to are element ids, or $<i> naming the earlier add_node op i.
  z.object({
    op: z.literal("add_arrow"),
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  }),
]);
export type Op = z.infer<typeof Op>;

export const Propose = z.object({
  title: z.string().optional(),
  ops: z.array(Op).min(1),
});
export const Revise = z.object({
  proposalId: z.string(),
  title: z.string().optional(),
  ops: z.array(Op).min(1),
});

export type Proposal = {
  id: string;
  board: string;
  title: string | null;
  ops: Op[];
  at: string;
};
export type Decision = "accepted" | "rejected";
export type ProposalLogEntry =
  | { event: "proposed" | "revised"; at: string; proposal: Proposal }
  | { event: Decision; at: string; id: string };

const Proposal = z.object({
  id: z.string(),
  board: z.string(),
  title: z.string().nullable(),
  ops: z.array(Op).min(1),
  at: z.string(),
});

// One parsed line of .blueprint/proposals.jsonl.
export const ProposalLogEntry: z.ZodType<ProposalLogEntry> =
  z.discriminatedUnion("event", [
    z.object({
      event: z.literal(["proposed", "revised"]),
      at: z.string(),
      proposal: Proposal,
    }),
    z.object({
      event: z.literal(["accepted", "rejected"]),
      at: z.string(),
      id: z.string(),
    }),
  ]);

// The existing element ids the ops point at, first-seen order, no duplicates.
export function referencedIds(ops: Op[]): string[] {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.op === "update" || op.op === "delete") ids.add(op.id);
    else if (op.op === "add_arrow")
      for (const end of [op.from, op.to]) {
        if (!isRef(end)) ids.add(end);
      }
    else for (const id of op.near ?? []) ids.add(id);
  }
  return [...ids];
}

// Every add_arrow joins two different ends, and each $<i> among them names
// an earlier add_node op of the same list.
export function checkRefs(ops: Op[]): void {
  ops.forEach((op, i) => {
    if (op.op !== "add_arrow") return;
    if (op.from === op.to)
      throw new Error(`op ${i}: an arrow needs two different ends`);
    for (const end of [op.from, op.to]) {
      if (!isRef(end)) continue;
      const j = refIndex(end);
      if (j === null || j >= i || ops[j].op !== "add_node")
        throw new Error(`op ${i}: ${end} must name an earlier add_node`);
    }
  });
}
