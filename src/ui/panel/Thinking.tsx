import { useEffect, useState } from "react";
import { Pip } from "../Pip";
import type { TranscriptItem } from "./transcript";

// Drafting-table verbs for a turn with no tool running; one every few seconds.
export const VERBS = [
  "Sketching",
  "Drafting",
  "Measuring",
  "Squaring the corners",
  "Checking the grid",
  "Sharpening the pencil",
  "Inking",
];
const VERB_MS = 4000;

// 9s, 4m 30s, 1h 5m.
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// The latest tool call that has no result yet, as its row's summary.
export function runningTool(items: TranscriptItem[]): string | null {
  const done = new Set(
    items.flatMap((i) => (i.kind === "tool_result" ? [i.toolUseId] : [])),
  );
  for (let k = items.length - 1; k >= 0; k--) {
    const item = items[k];
    if (item.kind === "result" || item.kind === "user") return null;
    if (item.kind === "tool_use" && !done.has(item.id)) return item.summary;
  }
  return null;
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The live row at the foot of a working turn: Pip hopping, what Claude is
// doing, and how long the turn has run.
export function Thinking({
  since,
  activity,
}: {
  since: number;
  activity: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ms = now - since;
  const label = activity
    ? sentence(activity)
    : VERBS[Math.floor(ms / VERB_MS) % VERBS.length];
  return (
    // The header's status already tells assistive tech that Claude is working.
    <div className="thinking" aria-hidden="true">
      <Pip size={16} hopping />
      <span className="thinking-text">{label}…</span>
      <span className="thinking-time">{elapsed(ms)}</span>
    </div>
  );
}
