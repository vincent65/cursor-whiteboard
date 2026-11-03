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

beforeEach(() => {
  vi.resetAllMocks();
  handlers.clear();
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
      "Dropped 1 citations that no longer resolve: [[board:main#gone]]",
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
