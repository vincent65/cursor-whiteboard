import type { CSSProperties, JSX } from "react";
import type { Decision } from "../../shared/proposals";
import type { Counts } from "./ghosts";

const summary = (c: Counts): string =>
  [
    [c.added, "added"],
    [c.updated, "changed"],
    [c.deleted, "removed"],
  ]
    .filter(([n]) => n)
    .map(([n, word]) => `${n} ${word}`)
    .join(", ");

export function ProposalsBar(props: {
  // A busy row has a decision in flight; its buttons wait for it to settle.
  items: { id: string; title: string | null; counts: Counts; busy: boolean }[];
  onDecide(id: string, decision: Decision): void;
  onRefine(id: string): void;
  // Pixels Excalidraw's properties panel covers on the board's left; the bar centers
  // in the rest.
  inset?: number;
}): JSX.Element | null {
  if (!props.items.length) return null;
  return (
    <div
      className="proposals-bar"
      style={{ "--bar-inset": `${props.inset ?? 0}px` } as CSSProperties}
    >
      {props.items.map(({ id, title, counts, busy }) => (
        <div className="proposals-row" key={id}>
          <span className="proposals-text">
            {[`Claude proposed ${title ?? "changes"}`, summary(counts)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            type="button"
            disabled={busy}
            className="button button-primary"
            onClick={() => props.onDecide(id, "accepted")}
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            className="button"
            onClick={() => props.onDecide(id, "rejected")}
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            className="button"
            onClick={() => props.onRefine(id)}
          >
            Refine
          </button>
        </div>
      ))}
    </div>
  );
}
