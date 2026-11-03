// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { ServerMessage } from "../../src/shared/messages";
import * as api from "../../src/ui/api";
import { SpecView } from "../../src/ui/plan/SpecView";

vi.mock("../../src/ui/api", async (orig) => ({
  ApiError: (await orig<typeof import("../../src/ui/api")>()).ApiError,
  getSpec: vi.fn(),
  agentSplit: vi.fn(),
  agentState: vi.fn(),
}));

const handlers = new Set<(m: ServerMessage) => void>();
vi.mock("../../src/ui/server-events", () => ({
  useServerEvent: (h: (m: ServerMessage) => void) => {
    useEffect(() => {
      handlers.add(h);
      return () => {
        handlers.delete(h);
      };
    });
  },
}));
const emit = (m: ServerMessage) =>
  act(() => {
    for (const h of handlers) h(m);
  });

const spec = "## Goals\n\nLogin [[board:main#a1]] fast.\n";

const agentState = (splitting: boolean) => ({
  status: "idle" as const,
  transcript: [],
  pending: [],
  splitting,
});

beforeEach(() => {
  vi.resetAllMocks();
  handlers.clear();
  vi.mocked(api.agentState).mockResolvedValue(agentState(false));
});

test("SpecView shows the empty state, then the spec with marked citations on file-changed", async () => {
  vi.mocked(api.getSpec).mockResolvedValueOnce({ text: null, dropped: [] });
  const { container } = render(<SpecView />);
  expect(
    await screen.findByText("No spec yet. Press Compile in the Claude panel."),
  ).toBeInTheDocument();

  vi.mocked(api.getSpec).mockResolvedValueOnce({
    text: spec,
    dropped: [
      { kind: "board", page: "main", id: "gone", raw: "[[board:main#gone]]" },
    ],
  });
  await emit({ type: "file-changed", kind: "spec", name: "spec" });
  expect(
    await screen.findByText(
      "Dropped 1 citation that no longer resolves: [[board:main#gone]]",
    ),
  ).toBeInTheDocument();
  const cite = container.querySelector(".cite");
  expect(cite?.textContent).toBe("[[board:main#a1]]");
  expect(container.querySelector(".cm-content")).toHaveAttribute(
    "contenteditable",
    "false",
  );
});

test("Split into tasks shows Splitting… until done, and errors from the split", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  vi.mocked(api.agentSplit).mockResolvedValue();
  render(<SpecView />);
  const button = await screen.findByRole("button", {
    name: "Split into tasks",
  });

  await userEvent.click(button);
  expect(api.agentSplit).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Splitting…" })).toBeDisabled();
  await emit({ type: "split.status", state: "error", message: "bad graph" });
  expect(screen.getByRole("alert")).toHaveTextContent("bad graph");

  await userEvent.click(
    screen.getByRole("button", { name: "Split into tasks" }),
  );
  expect(screen.queryByRole("alert")).toBeNull();
  await emit({ type: "split.status", state: "done" });
  expect(
    screen.getByRole("button", { name: "Split into tasks" }),
  ).toBeEnabled();
});

test("a rejected split shows the server's message", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  vi.mocked(api.agentSplit).mockRejectedValueOnce(
    new api.ApiError("a split is already running", 409),
  );
  render(<SpecView />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Split into tasks" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "a split is already running",
  );
  expect(
    screen.getByRole("button", { name: "Split into tasks" }),
  ).toBeEnabled();
});

test("a view that mounts during a split shows it running until it ends", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  vi.mocked(api.agentState).mockResolvedValue(agentState(true));
  render(<SpecView />);
  expect(
    await screen.findByRole("button", { name: "Splitting…" }),
  ).toBeDisabled();

  await emit({ type: "split.status", state: "done" });
  expect(
    screen.getByRole("button", { name: "Split into tasks" }),
  ).toBeEnabled();
});

test("a split status heard before the state arrives wins over it", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  let answer: (s: ReturnType<typeof agentState>) => void = () => {};
  vi.mocked(api.agentState).mockReturnValue(
    new Promise((r) => {
      answer = r;
    }),
  );
  render(<SpecView />);
  await screen.findByRole("button", { name: "Split into tasks" });

  await emit({ type: "split.status", state: "done" });
  await act(async () => answer(agentState(true)));
  expect(
    screen.getByRole("button", { name: "Split into tasks" }),
  ).toBeEnabled();
});

test("the dropped line names each citation once and counts them", async () => {
  const gone = (id: string) => ({
    kind: "board" as const,
    page: "main",
    id,
    raw: `[[board:main#${id}]]`,
  });
  vi.mocked(api.getSpec).mockResolvedValue({
    text: spec,
    dropped: [gone("x"), gone("y"), gone("x")],
  });
  render(<SpecView />);
  expect(
    await screen.findByText(
      "Dropped 2 citations that no longer resolve: [[board:main#x]], [[board:main#y]]",
    ),
  ).toBeInTheDocument();
});

test("an error clears on any split status and on a successful reload", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  render(<SpecView />);
  await screen.findByRole("button", { name: "Split into tasks" });

  // A split started in another tab clears this one's error.
  await emit({ type: "split.status", state: "error", message: "bad graph" });
  expect(screen.getByRole("alert")).toHaveTextContent("bad graph");
  await emit({ type: "split.status", state: "running" });
  expect(screen.queryByRole("alert")).toBeNull();
  await emit({ type: "split.status", state: "error", message: "bad graph" });
  await emit({ type: "split.status", state: "done" });
  expect(screen.queryByRole("alert")).toBeNull();

  vi.mocked(api.getSpec).mockRejectedValueOnce(new Error("server down"));
  await emit({ type: "file-changed", kind: "spec", name: "spec" });
  expect(await screen.findByRole("alert")).toHaveTextContent("server down");
  await emit({ type: "file-changed", kind: "spec", name: "spec" });
  await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

test("a split started here wins over a state that arrives after it", async () => {
  vi.mocked(api.getSpec).mockResolvedValue({ text: spec, dropped: [] });
  vi.mocked(api.agentSplit).mockResolvedValue();
  let answer: (s: ReturnType<typeof agentState>) => void = () => {};
  vi.mocked(api.agentState).mockReturnValue(
    new Promise((r) => {
      answer = r;
    }),
  );
  render(<SpecView />);

  await userEvent.click(
    await screen.findByRole("button", { name: "Split into tasks" }),
  );
  await act(async () => answer(agentState(false)));
  expect(screen.getByRole("button", { name: "Splitting…" })).toBeDisabled();
});
