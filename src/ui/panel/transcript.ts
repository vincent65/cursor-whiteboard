import type { PanelEvent } from "../../shared/panel";

// Partial assistant_text events replace the item with the same id.
export type TranscriptItem = PanelEvent;

// An event whose id is already listed replaces that item in place, so a
// stream grows one paragraph and an event heard twice (restored, then live)
// shows once. A partial arriving after its final text is stale and dropped.
// Asks wait in the panel's dialog instead, and take their tool row's id.
export function reduceTranscript(
  items: TranscriptItem[],
  event: PanelEvent,
): TranscriptItem[] {
  if (event.kind === "permission") return items;
  const i = items.findIndex((item) => item.id === event.id);
  if (i === -1) return [...items, event];
  const old = items[i];
  if (
    event.kind === "assistant_text" &&
    event.partial &&
    old.kind === "assistant_text" &&
    !old.partial
  )
    return items;
  return items.map((item, j) => (j === i ? event : item));
}
