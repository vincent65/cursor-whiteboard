import { Markdown } from "../markdown";
import type { TranscriptItem } from "./transcript";

function Item({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "user":
      return <div className="msg-user">{item.text}</div>;
    case "assistant_text":
      return (
        <div className="msg-assistant">
          <Markdown text={item.text} />
        </div>
      );
    case "tool_use":
      return <div className="msg-tool">{item.summary}</div>;
    case "tool_result":
      return (
        <div className="msg-tool">
          {!item.ok && (
            <span role="img" aria-label="failed">
              ✗{" "}
            </span>
          )}
          {item.summary}
        </div>
      );
    case "result": {
      // The SDK's cost is the session's running total, not this turn's.
      const cost =
        item.costUsd === null ? "" : ` · $${item.costUsd.toFixed(4)} total`;
      return (
        <div className="msg-result">
          {item.subtype === "interrupted" ? "Stopped" : "Turn done"}
          {cost}
        </div>
      );
    }
    case "error":
      return <div className="msg-result">✗ {item.message}</div>;
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
