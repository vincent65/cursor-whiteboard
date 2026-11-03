// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import type { ServerMessage } from "../../src/shared/messages";
import type { PanelEvent } from "../../src/shared/panel";
import * as api from "../../src/ui/api";
import { ClaudePanel } from "../../src/ui/panel/ClaudePanel";
import { RefineProvider, useRefine } from "../../src/ui/panel/refine";
import {
  SelectionProvider,
  selectionLabels,
  useSetSelection,
} from "../../src/ui/selection";

vi.mock("../../src/ui/api", () => ({
  agentState: vi.fn(),
  agentSend: vi.fn(async () => "u2"),
  agentInterrupt: vi.fn(async () => {}),
  agentPermission: vi.fn(async () => {}),
  agentCompile: vi.fn(async () => ({ id: "u9" })),
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

const at = "2026-11-02T00:00:00.000Z";
const selection = { board: "main", ids: ["a", "b"], labels: ["Auth", "DB"] };

function Selected() {
  const set = useSetSelection();
  useEffect(() => set(selection), [set]);
  return null;
}

const renderPanel = () =>
  render(
    <SelectionProvider>
      <Selected />
      <ClaudePanel onBoard />
    </SelectionProvider>,
  );

const state = (
  over: Partial<Awaited<ReturnType<typeof api.agentState>>>,
): Awaited<ReturnType<typeof api.agentState>> => ({
  status: "idle",
  transcript: [],
  pending: [],
  splitting: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
});

test("panel renders restored transcript, sends on Enter with the current selection, shows Stop while working", async () => {
  const transcript: PanelEvent[] = [
    {
      kind: "user",
      id: "u1",
      text: "What is here?",
      at,
    },
    {
      kind: "tool_use",
      id: "t1",
      tool: "mcp__blueprint__get_board",
      summary: "reading the board",
      at,
    },
    {
      kind: "tool_result",
      id: "t1:result",
      toolUseId: "t1",
      ok: false,
      summary: "no such board",
      at,
    },
    {
      kind: "assistant_text",
      id: "m1:0",
      text: "Two boxes.\nOne arrow.",
      partial: false,
      at,
    },
    {
      kind: "result",
      id: "r1",
      subtype: "success",
      costUsd: 0.0123,
      durationMs: 900,
      at,
    },
    {
      kind: "result",
      id: "r2",
      subtype: "interrupted",
      costUsd: 0.02,
      durationMs: 300,
      at,
    },
  ];
  vi.mocked(api.agentState).mockResolvedValue(state({ transcript }));
  renderPanel();

  expect(await screen.findByText("What is here?")).toHaveClass("msg-user");
  expect(screen.getByText("reading the board")).toHaveClass("msg-tool");
  expect(
    screen.getByText("no such board").closest(".msg-tool"),
  ).toHaveTextContent("✗");
  expect(screen.getByText(/Two boxes\./)).toHaveTextContent(
    "Two boxes.\nOne arrow.",
    { normalizeWhitespace: false },
  );
  // "Turn done", so a run's transcript does not read like its Done status.
  expect(screen.getByText("Turn done · $0.0123 total")).toHaveClass(
    "msg-result",
  );
  expect(screen.getByText("Stopped · $0.0200 total")).toHaveClass("msg-result");
  expect(screen.getByRole("status")).toHaveTextContent("Idle");
  expect(screen.getByText("2 selected: Auth, DB")).toBeVisible();

  const stop = screen.getByRole("button", { name: "Stop" });
  expect(stop).toBeDisabled();

  const input = screen.getByRole("textbox", { name: "Message Claude" });
  await userEvent.type(input, "first{Shift>}{Enter}{/Shift}second");
  expect(input).toHaveValue("first\nsecond");
  expect(api.agentSend).not.toHaveBeenCalled();
  await userEvent.type(input, "{Enter}");
  expect(api.agentSend).toHaveBeenCalledWith(
    "first\nsecond",
    selection,
    undefined,
  );
  expect(input).toHaveValue("");

  emit({ type: "agent.status", status: "working" });
  emit({
    type: "agent.event",
    event: {
      kind: "assistant_text",
      id: "m2:0",
      text: "Str",
      partial: true,
      at,
    },
  });
  emit({
    type: "agent.event",
    event: {
      kind: "assistant_text",
      id: "m2:0",
      text: "Streaming",
      partial: true,
      at,
    },
  });
  expect(screen.getByText("Streaming")).toBeVisible();
  expect(screen.queryByText("Str")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Working");
  expect(stop).toBeEnabled();
  await userEvent.click(stop);
  expect(api.agentInterrupt).toHaveBeenCalledOnce();
});

test("a pending permission renders the dialog and Allow always calls agentPermission with behavior always", async () => {
  vi.mocked(api.agentState).mockResolvedValue(
    state({
      status: "needs_you",
      pending: [{ id: "p1", tool: "Bash", summary: "running `ls`", at }],
    }),
  );
  renderPanel();
  expect(await screen.findByText(/running `ls`/)).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Needs you");
  // A second ask waits behind the first.
  emit({
    type: "agent.event",
    event: {
      kind: "permission",
      id: "p2",
      tool: "Write",
      summary: "editing x",
      at,
    },
  });
  expect(screen.queryByText(/editing x/)).toBeNull();
  expect(screen.getByRole("button", { name: "Allow once" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Deny" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Allow always" }));
  expect(api.agentPermission).toHaveBeenCalledWith("p1", {
    behavior: "always",
  });
  expect(await screen.findByText(/editing x/)).toBeVisible();

  // Leaving needs_you means every ask was settled, here or in another tab.
  emit({ type: "agent.status", status: "working" });
  expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
});

test("a permission ask keeps a transcript that was at the bottom pinned there", async () => {
  vi.mocked(api.agentState).mockResolvedValue(
    state({ transcript: [{ kind: "user", id: "u1", text: "go", at }] }),
  );
  const { container } = renderPanel();
  await screen.findByText("go");
  const el = container.querySelector(".transcript") as HTMLElement;
  const scrolls: number[] = [];
  Object.defineProperty(el, "scrollHeight", { value: 500 });
  Object.defineProperty(el, "scrollTop", {
    get: () => scrolls.at(-1) ?? 0,
    set: (v: number) => scrolls.push(v),
  });

  // The dialog takes room from the transcript, so its last line would hide behind it.
  emit({
    type: "agent.event",
    event: { kind: "permission", id: "p1", tool: "Bash", summary: "x", at },
  });

  expect(scrolls.at(-1)).toBe(500);
});

test("an error status shows the message", async () => {
  vi.mocked(api.agentState).mockResolvedValue(state({ status: "starting" }));
  renderPanel();
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Starting"),
  );
  expect(
    screen.getByRole("textbox", { name: "Message Claude" }),
  ).toBeDisabled();
  // A CLI that hangs at startup can still be stopped.
  const stop = screen.getByRole("button", { name: "Stop" });
  expect(stop).toBeEnabled();
  await userEvent.click(stop);
  expect(api.agentInterrupt).toHaveBeenCalledOnce();
  emit({ type: "agent.status", status: "error", message: "the CLI exited" });
  expect(screen.getByRole("status")).toHaveTextContent("Error: the CLI exited");
  expect(screen.getByRole("textbox", { name: "Message Claude" })).toBeEnabled();
});

test("Compile calls agentCompile", async () => {
  vi.mocked(api.agentState).mockResolvedValue(state({ status: "starting" }));
  renderPanel();
  const compile = screen.getByRole("button", { name: "Compile" });
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Starting"),
  );
  expect(compile).toBeDisabled();

  emit({ type: "agent.status", status: "idle" });
  expect(compile).toBeEnabled();
  await userEvent.click(compile);
  expect(api.agentCompile).toHaveBeenCalledOnce();

  // A failure shows the server's message in the failure line.
  vi.mocked(api.agentCompile).mockRejectedValueOnce(new Error("busy"));
  await userEvent.click(compile);
  expect(await screen.findByRole("alert")).toHaveTextContent("busy");
});

function RefineButton() {
  const { setTarget } = useRefine();
  return (
    <button
      type="button"
      onClick={() => setTarget({ id: "p_1", title: "Login flow" })}
    >
      Refine
    </button>
  );
}

const renderRefine = () =>
  render(
    <RefineProvider>
      <RefineButton />
      <ClaudePanel onBoard />
    </RefineProvider>,
  );

test("a refine target shows a chip, sends the proposal id, and clears", async () => {
  vi.mocked(api.agentState).mockResolvedValue(state({}));
  renderRefine();
  const input = screen.getByRole("textbox", { name: "Message Claude" });
  await waitFor(() => expect(input).toBeEnabled());

  await userEvent.click(screen.getByRole("button", { name: "Refine" }));
  expect(screen.getByText("Refining p_1 · Login flow")).toBeVisible();
  // The Refine click puts the cursor where the instruction goes.
  expect(input).toHaveFocus();

  // A failed send keeps the target.
  vi.mocked(api.agentSend).mockRejectedValueOnce(new Error("offline"));
  await userEvent.type(input, "tighter{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(screen.getByText("Refining p_1 · Login flow")).toBeVisible();

  await userEvent.type(input, "{Enter}");
  expect(api.agentSend).toHaveBeenLastCalledWith("tighter", undefined, "p_1");
  await waitFor(() => expect(screen.queryByText(/Refining/)).toBeNull());
});

test("the chip's × clears the target without sending", async () => {
  vi.mocked(api.agentState).mockResolvedValue(state({}));
  renderRefine();
  const input = screen.getByRole("textbox", { name: "Message Claude" });
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Refine" }));

  await userEvent.click(screen.getByRole("button", { name: "Clear refine" }));
  expect(screen.queryByText(/Refining/)).toBeNull();
  expect(input).toHaveFocus();
  expect(api.agentSend).not.toHaveBeenCalled();

  await userEvent.type(input, "plain{Enter}");
  expect(api.agentSend).toHaveBeenCalledWith("plain", undefined, undefined);
});

test("selection labels come from bound text, own text, then the element type", () => {
  const elements = [
    { id: "t1", type: "text", text: "Auth\nservice", containerId: "box" },
    { id: "box", type: "rectangle" },
    { id: "note", type: "text", text: "loose note", containerId: null },
    { id: "arrow", type: "arrow" },
    {
      id: "gone",
      type: "text",
      text: "old",
      containerId: "arrow",
      isDeleted: true,
    },
  ];
  expect(selectionLabels(elements, ["box", "note", "arrow"])).toEqual([
    "Auth service",
    "loose note",
    "arrow",
  ]);
});

test("the input asks about the board only on a board route", async () => {
  vi.mocked(api.agentState).mockResolvedValue(state({}));
  const { rerender } = render(
    <SelectionProvider>
      <ClaudePanel onBoard />
    </SelectionProvider>,
  );
  expect(
    await screen.findByPlaceholderText("Ask Claude about this board"),
  ).toBeInTheDocument();

  rerender(
    <SelectionProvider>
      <ClaudePanel onBoard={false} />
    </SelectionProvider>,
  );
  expect(screen.getByPlaceholderText("Ask Claude")).toBeInTheDocument();
});
