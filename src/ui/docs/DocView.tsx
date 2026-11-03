import { markdown } from "@codemirror/lang-markdown";
import { Transaction } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { headingSlugs } from "../../export/citations";
import * as api from "../api";
import { useDebounced } from "../hooks/useDebounced";
import { useServerEvent } from "../server-events";
import { reconcileExternalChange } from "./reconcile";

export const theme = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font)",
    lineHeight: "var(--line-height)",
  },
  ".cm-content": { padding: "calc(var(--space) * 2) 0" },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    borderRight: "1px solid var(--border)",
    color: "var(--muted)",
  },
  ".cm-line": { padding: "0 calc(var(--space) * 2)" },
});

// Swaps in text from disk. The remote annotation keeps it from counting as an
// edit, and keeping it out of history stops undo from bringing back the text
// the disk replaced.
export function replaceFromDisk(v: EditorView, text: string) {
  v.dispatch({
    changes: { from: 0, to: v.state.doc.length, insert: text },
    selection: { anchor: Math.min(v.state.selection.main.head, text.length) },
    annotations: [
      Transaction.remote.of(true),
      Transaction.addToHistory.of(false),
    ],
  });
}

export function DocView({
  name,
  focus,
  onConflictChange,
}: {
  name: string;
  focus?: string[];
  onConflictChange(open: boolean): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The editor exists only once the doc has loaded.
  const [loaded, setLoaded] = useState(false);
  // Unsaved edits exist; a ref so typing does not re-render.
  const dirty = useRef(false);
  // Disk text of an external change that collided with unsaved edits.
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onConflictChange(conflict !== null);
    return () => onConflictChange(false);
  }, [conflict, onConflictChange]);

  const persist = (text: string) =>
    api.saveDoc(name, text).then(
      () => {
        setError(null);
        if (view.current?.state.doc.toString() === text) dirty.current = false;
      },
      (err: Error) => setError(`Save failed: ${err.message}`),
    );

  // Paused during a conflict so autosave cannot overwrite the external edit
  // before the user picks a side.
  const save = useDebounced((text: string) => {
    if (dirty.current && conflict === null) void persist(text);
  }, 500);

  useEffect(() => {
    let cancelled = false;
    let v: EditorView | undefined;
    api.getDoc(name).then(
      (text) => {
        if (cancelled || !host.current) return;
        v = new EditorView({
          parent: host.current,
          doc: text,
          extensions: [
            basicSetup,
            markdown(),
            EditorView.lineWrapping,
            theme,
            EditorView.updateListener.of((u) => {
              const remote = u.transactions.some((t) =>
                t.annotation(Transaction.remote),
              );
              if (!u.docChanged || remote) return;
              dirty.current = true;
              save(u.state.doc.toString());
            }),
          ],
        });
        view.current = v;
        setLoaded(true);
      },
      (err: Error) => setError(err.message),
    );
    return () => {
      cancelled = true;
      v?.destroy();
      view.current = null;
    };
  }, [name, save]);

  // Puts the cursor on the cited heading and scrolls it to the top. Slugs
  // match the server's citation index, so a stale one changes nothing.
  useEffect(() => {
    const v = view.current;
    const slug = focus?.[0];
    if (!loaded || !v || !slug) return;
    for (let n = 1; n <= v.state.doc.lines; n++) {
      const line = v.state.doc.line(n);
      if (headingSlugs(line.text)[0] !== slug) continue;
      v.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      });
      return;
    }
  }, [loaded, focus]);

  useServerEvent(async (m) => {
    if (m.type !== "file-changed" || m.kind !== "doc" || m.name !== name)
      return;
    const diskText = await api.getDoc(name).catch(() => null);
    const v = view.current;
    if (diskText === null || !v) return;
    const action = reconcileExternalChange({
      dirty: dirty.current,
      localText: v.state.doc.toString(),
      diskText,
    });
    if (action === "reload") {
      replaceFromDisk(v, diskText);
      dirty.current = false;
    }
    setConflict(action === "banner" ? diskText : null);
  });

  const keepMine = () => {
    setConflict(null);
    if (view.current) void persist(view.current.state.doc.toString());
  };

  const takeTheirs = () => {
    if (conflict !== null && view.current) {
      replaceFromDisk(view.current, conflict);
      dirty.current = false;
    }
    setConflict(null);
  };

  return (
    <div className="doc">
      {conflict !== null && (
        <div role="alert" className="notice">
          <span className="notice-text">
            This doc changed on disk while you had unsaved edits.
          </span>
          <button type="button" className="button" onClick={keepMine}>
            Keep mine
          </button>
          <button type="button" className="button" onClick={takeTheirs}>
            Take theirs
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="empty">
          {error}
        </p>
      )}
      <div ref={host} className="doc-editor" />
    </div>
  );
}
