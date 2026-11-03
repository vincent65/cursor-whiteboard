// @vitest-environment jsdom
import { history, undo, undoDepth } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { replaceFromDisk } from "../../src/ui/docs/DocView";

test("replaceFromDisk keeps the cursor, adds no undo step, and does not mark the doc dirty", () => {
  let dirty = false;
  const view = new EditorView({
    doc: "hello",
    extensions: [
      history(),
      EditorView.updateListener.of((u) => {
        const remote = u.transactions.some((t) =>
          t.annotation(Transaction.remote),
        );
        if (u.docChanged && !remote) dirty = true;
      }),
    ],
  });
  view.dispatch({ selection: { anchor: 3 } });
  replaceFromDisk(view, "hello, world");
  expect(view.state.doc.toString()).toBe("hello, world");
  expect(view.state.selection.main.head).toBe(3);
  expect(undoDepth(view.state)).toBe(0);
  expect(undo(view)).toBe(false);
  expect(dirty).toBe(false);
  replaceFromDisk(view, "hi");
  expect(view.state.selection.main.head).toBe(2);
  view.destroy();
});
