import type { PanelEvent } from "../../src/shared/panel";
import { reduceTranscript } from "../../src/ui/panel/transcript";

const at = "2026-11-02T00:00:00.000Z";
const text = (t: string, partial: boolean): PanelEvent => ({
  kind: "assistant_text",
  id: "m1:0",
  text: t,
  partial,
  at,
});

test("reduceTranscript appends events and replaces a partial text by id, final text wins", () => {
  const events: PanelEvent[] = [
    { kind: "user", id: "u1", text: "Describe it", at },
    text("Two", true),
    text("Two boxes", true),
    { kind: "tool_use", id: "t1", tool: "Read", summary: "reading a", at },
    text("Two boxes and an arrow.", false),
    // A partial that arrives after its final text is stale.
    text("Two boxes and", true),
  ];
  const items = events.reduce(reduceTranscript, []);
  expect(items.map((i) => i.id)).toEqual(["u1", "m1:0", "t1"]);
  expect(items[1]).toEqual(text("Two boxes and an arrow.", false));

  // The same event delivered twice (restore, then live) is kept once.
  expect(reduceTranscript(items, events[0])).toEqual(items);
});

test("a permission ask stays out of the transcript and keeps its tool row", () => {
  const events: PanelEvent[] = [
    { kind: "tool_use", id: "t1", tool: "Bash", summary: "running `ls`", at },
    { kind: "permission", id: "t1", tool: "Bash", summary: "running `ls`", at },
  ];
  const items = events.reduce(reduceTranscript, []);
  expect(items.map((i) => i.kind)).toEqual(["tool_use"]);
});
