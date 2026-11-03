import type { JSX } from "react";
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
  items: { id: string; title: string | null; counts: Counts }[];
  onDecide(id: string, decision: Decision): void;
  onRefine(id: string): void;
}): JSX.Element | null {
  if (!props.items.length) return null;
  return (
    <div className="proposals-bar">
      {props.items.map(({ id, title, counts }) => (
        <div className="proposals-row" key={id}>
          <span className="proposals-text">
            {[`Claude proposed ${title ?? "changes"}`, summary(counts)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            type="button"
            className="button button-primary"
            onClick={() => props.onDecide(id, "accepted")}
          >
            Accept
          </button>
          <button
            type="button"
            className="button"
            onClick={() => props.onDecide(id, "rejected")}
          >
            Reject
          </button>
          <button
            type="button"
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
