import { Check, CircleAlert, Dot, X } from "lucide-react";
import type { Citation } from "../../export/citations";
import { formatCost } from "../cost";
import { Markdown } from "../markdown";
import { CitationLink } from "../plan/citations";
import type { TranscriptItem } from "./transcript";

const RUNNING = "running ";

// A tool's summary; a command row shows its command as code.
export function ToolSummary({ summary }: { summary: string }) {
  if (!summary.startsWith(RUNNING)) return summary;
  return (
    <>
      {RUNNING}
      <code className="cmd">{summary.slice(RUNNING.length)}</code>
    </>
  );
}

// Claude's citations link to the board or doc, as in the spec.
const chip = (c: Citation) => <CitationLink citation={c} />;

function Item({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "user":
      return <div className="msg-user">{item.text}</div>;
    case "assistant_text":
      return (
        <div className="msg-assistant">
          <Markdown text={item.text} renderCitation={chip} />
        </div>
      );
    case "tool_use":
      return (
        <div className="msg-tool">
          <Dot className="msg-icon" size={14} aria-hidden="true" />
          <span className="msg-tool-text">
            <ToolSummary summary={item.summary} />
          </span>
        </div>
      );
    case "tool_result":
      return (
        <div className={item.ok ? "msg-tool" : "msg-tool msg-tool-failed"}>
          {item.ok ? (
            <Check className="msg-icon" size={14} aria-hidden="true" />
          ) : (
            <span role="img" aria-label="failed" className="msg-icon">
              <X size={14} aria-hidden="true" />
            </span>
          )}
          <span className="msg-tool-text">{item.summary}</span>
        </div>
      );
    case "result": {
      // A hairline ends the turn. The SDK's cost is the session's running total, not
      // this turn's, so it reads as spent so far.
      const text = [
        item.subtype === "interrupted" && "Stopped",
        item.costUsd !== null && `${formatCost(item.costUsd)} spent so far`,
      ]
        .filter(Boolean)
        .join(" · ");
      return <div className="msg-result">{text}</div>;
    }
    case "error":
      return (
        <div className="msg-result msg-error">
          <CircleAlert className="msg-icon" size={14} aria-hidden="true" />
          <span>{item.message}</span>
        </div>
      );
    case "permission":
      // reduceTranscript keeps asks out; they wait in the dialog.
      return null;
  }
}

// The rows of a transcript; the caller supplies the scrolling container.
export function TranscriptList({ items }: { items: TranscriptItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </>
  );
}
