// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ClientMessage, ServerMessage } from "../../src/shared/messages";
import { App } from "../../src/ui/App";
import * as api from "../../src/ui/api";
import {
  ServerEventsProvider,
  useSendToServer,
  useServerEvent,
} from "../../src/ui/server-events";

vi.mock("../../src/ui/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/ui/api")>()),
  listBoards: vi.fn(async () => []),
  listDocs: vi.fn(async () => []),
  agentState: vi.fn(() => new Promise(() => {})),
}));

// Excalidraw does not load under vitest, and no board is opened here.
vi.mock("../../src/ui/board/BoardView", () => ({ BoardView: () => null }));

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static last: FakeSocket;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 2;
  }
  open() {
    this.readyState = 1;
    act(() => this.onopen?.());
  }
  drop() {
    this.readyState = 3;
    act(() => this.onclose?.());
  }
  receive(m: ServerMessage) {
    act(() => this.onmessage?.({ data: JSON.stringify(m) }));
  }
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const selection: ClientMessage = {
  type: "selection.changed",
  board: "main",
  ids: ["a"],
};

let send: (m: ClientMessage) => void;

function Probe({ onMessage }: { onMessage(m: ServerMessage): void }) {
  send = useSendToServer();
  useServerEvent(onMessage);
  useEffect(() => send(selection), []);
  return null;
}

test("subscribers receive parsed messages and sends queue until open", () => {
  vi.useFakeTimers();
  const onMessage = vi.fn();
  render(
    <ServerEventsProvider>
      <Probe onMessage={onMessage} />
    </ServerEventsProvider>,
  );
  const first = FakeSocket.last;
  expect(first.sent).toEqual([]);
  first.open();
  expect(first.sent).toEqual([JSON.stringify(selection)]);

  const changed: ServerMessage = {
    type: "file-changed",
    kind: "doc",
    name: "notes",
  };
  first.receive(changed);
  expect(onMessage).toHaveBeenCalledWith(changed);

  // A send while reconnecting waits for the next socket to open.
  first.drop();
  send(selection);
  act(() => vi.advanceTimersByTime(500));
  const second = FakeSocket.last;
  expect(second).not.toBe(first);
  expect(second.sent).toEqual([]);
  second.open();
  expect(second.sent).toEqual([JSON.stringify(selection)]);
  expect(first.sent).toHaveLength(1);
});

test("a reconnect drops queued responses and keeps only the latest selection", () => {
  vi.useFakeTimers();
  render(
    <ServerEventsProvider>
      <Probe onMessage={() => {}} />
    </ServerEventsProvider>,
  );
  const first = FakeSocket.last;
  first.open();
  // Frames sent while the socket is closing queue instead of vanishing.
  first.readyState = 2;
  send({ type: "response", id: "r1", ok: true, payload: null });
  send({ ...selection, ids: ["b"] });
  expect(first.sent).toEqual([JSON.stringify(selection)]);
  first.drop();
  send({ type: "response", id: "r2", ok: false, error: "late" });
  send({ ...selection, ids: ["c"] });
  act(() => vi.advanceTimersByTime(500));
  FakeSocket.last.open();
  expect(FakeSocket.last.sent).toEqual([
    JSON.stringify({ ...selection, ids: ["c"] }),
  ]);
});

test("every reconnect sends the last selection again", () => {
  vi.useFakeTimers();
  render(
    <ServerEventsProvider>
      <Probe onMessage={() => {}} />
    </ServerEventsProvider>,
  );
  const first = FakeSocket.last;
  first.open();
  expect(first.sent).toEqual([JSON.stringify(selection)]);
  first.drop();
  act(() => vi.advanceTimersByTime(500));
  const second = FakeSocket.last;
  expect(second).not.toBe(first);
  second.open();
  expect(second.sent).toEqual([JSON.stringify(selection)]);
});

test("an empty board clears the selection a reconnect would send", () => {
  vi.useFakeTimers();
  render(
    <ServerEventsProvider>
      <Probe onMessage={() => {}} />
    </ServerEventsProvider>,
  );
  const first = FakeSocket.last;
  first.open();
  const cleared: ClientMessage = {
    type: "selection.changed",
    board: "",
    ids: [],
  };
  send(cleared);
  expect(first.sent).toEqual([
    JSON.stringify(selection),
    JSON.stringify(cleared),
  ]);
  first.drop();
  act(() => vi.advanceTimersByTime(500));
  FakeSocket.last.open();
  expect(FakeSocket.last.sent).toEqual([]);
});

test("closing before the socket opens waits for it to open, then closes", () => {
  const { unmount } = render(
    <ServerEventsProvider>
      <Probe onMessage={() => {}} />
    </ServerEventsProvider>,
  );
  const socket = FakeSocket.last;
  unmount();
  // Closing a connecting socket makes the browser log a warning.
  expect(socket.readyState).toBe(0);
  socket.open();
  expect(socket.readyState).toBe(2);
  expect(socket.sent).toEqual([]);
});

test("a throwing subscriber does not starve the others", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const after = vi.fn();
  render(
    <ServerEventsProvider>
      <Probe
        onMessage={() => {
          throw new Error("boom");
        }}
      />
      <Probe onMessage={after} />
    </ServerEventsProvider>,
  );
  const changed: ServerMessage = {
    type: "file-changed",
    kind: "doc",
    name: "notes",
  };
  FakeSocket.last.receive(changed);
  expect(after).toHaveBeenCalledWith(changed);
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("a file-changed for an unknown doc refreshes the sidebar lists", async () => {
  const listDocs = vi.mocked(api.listDocs);
  listDocs.mockResolvedValueOnce([]);
  listDocs.mockResolvedValue([{ name: "fresh", updatedAt: "" }]);
  render(<App />);
  await waitFor(() => expect(listDocs).toHaveBeenCalledTimes(1));
  FakeSocket.last.open();

  FakeSocket.last.receive({ type: "file-changed", kind: "doc", name: "fresh" });
  expect(await screen.findByRole("link", { name: "fresh" })).toBeVisible();
  expect(listDocs).toHaveBeenCalledTimes(2);

  // A name already listed is the open view's business, not the sidebar's.
  FakeSocket.last.receive({ type: "file-changed", kind: "doc", name: "fresh" });
  expect(listDocs).toHaveBeenCalledTimes(2);
});
