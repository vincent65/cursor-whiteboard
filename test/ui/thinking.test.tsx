// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import {
  elapsed,
  runningTool,
  Thinking,
  VERBS,
} from "../../src/ui/panel/Thinking";
import type { TranscriptItem } from "../../src/ui/panel/transcript";

const at = "2026-11-03T00:00:00.000Z";

test("elapsed reads seconds, then minutes and seconds, then hours and minutes", () => {
  expect(elapsed(-50)).toBe("0s");
  expect(elapsed(9_400)).toBe("9s");
  expect(elapsed(270_000)).toBe("4m 30s");
  expect(elapsed(3_900_000)).toBe("1h 5m");
});

test("runningTool names the latest call of this turn that has no result", () => {
  const use = (id: string, summary: string): TranscriptItem => ({
    kind: "tool_use",
    id,
    tool: "t",
    summary,
    at,
  });
  const result = (toolUseId: string): TranscriptItem => ({
    kind: "tool_result",
    id: `${toolUseId}:result`,
    toolUseId,
    ok: true,
    summary: "done",
    at,
  });
  expect(runningTool([])).toBeNull();
  expect(runningTool([use("a", "reading the board")])).toBe(
    "reading the board",
  );
  expect(runningTool([use("a", "reading the board"), result("a")])).toBeNull();
  // A call left open by an earlier turn is not this turn's.
  expect(
    runningTool([
      use("a", "reading the board"),
      { kind: "user", id: "u2", text: "next", at },
    ]),
  ).toBeNull();
});

test("Thinking shows the running tool, or a drafting verb that changes, and the time", () => {
  vi.useFakeTimers();
  try {
    const since = Date.now();
    const { rerender } = render(
      <Thinking since={since} activity="proposing 3 changes" />,
    );
    expect(screen.getByText("Proposing 3 changes…")).toBeInTheDocument();
    expect(screen.getByText("0s")).toBeInTheDocument();
    rerender(<Thinking since={since} activity={null} />);
    expect(screen.getByText(`${VERBS[0]}…`)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText(`${VERBS[1]}…`)).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
