// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ClientMessage } from "../../src/shared/messages";
import { BoardView } from "../../src/ui/board/BoardView";
import { RefineProvider } from "../../src/ui/panel/refine";
import { SelectionProvider } from "../../src/ui/selection";

// Excalidraw does not load under vitest; this test is about what the view says on mount,
// before any scene exists, so the editor renders nothing.
vi.mock("@excalidraw/excalidraw", () => ({ Excalidraw: () => null }));
vi.mock("@excalidraw/excalidraw/index.css", () => ({}));
vi.mock("../../src/ui/api", () => ({
  getBoard: vi.fn(() => new Promise(() => {})),
  listProposals: vi.fn(async () => []),
}));
const sent: ClientMessage[] = [];
vi.mock("../../src/ui/server-events", () => ({
  useSendToServer: () => (m: ClientMessage) => sent.push(m),
  useServerEvent: () => {},
}));

test("BoardView tells the server its board at once on mount, and that none is open on unmount", () => {
  const { unmount } = render(
    <SelectionProvider>
      <RefineProvider>
        <BoardView name="sign-in" onConflictChange={() => {}} />
      </RefineProvider>
    </SelectionProvider>,
  );
  // The scene is still loading, so this is not the debounced selection report.
  expect(sent).toEqual([
    { type: "selection.changed", board: "sign-in", ids: [] },
  ]);
  unmount();
  expect(sent.at(-1)).toEqual({
    type: "selection.changed",
    board: "",
    ids: [],
  });
});
