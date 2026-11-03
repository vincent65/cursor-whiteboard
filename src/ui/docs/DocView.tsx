import { markdown } from "@codemirror/lang-markdown";
import { Transaction } from "@codemirror/state";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef, useState } from "react";
import * as api from "../api";
import { useDebounced } from "../hooks/useDebounced";
import { reconcileExternalChange } from "./reconcile";

const theme = EditorView.theme({
  "&": { height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font)",
    lineHeight: "var(--line-height)",
  },
  ".cm-content": { padding: "calc(var(--space) * 2) 0" },
  ".cm-line": { padding: "0 calc(var(--space) * 2)" },
});

// Swaps in text from disk; the remote annotation keeps it from counting as an edit.
function replace(v: EditorView, text: string) {
  v.dispatch({
    changes: { from: 0, to: v.state.doc.length, insert: text },
    annotations: Transaction.remote.of(true),
  });
}

const bannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space)",
  padding: "var(--space) calc(var(--space) * 2)",
  background: "var(--surface)",
  borderBottom: "1px solid var(--border)",
};

// ponytail: inline styles keep this task to its file list; move to
// styles.css (with hover and focus states) when the UI gets a button class.
const buttonStyle = {
  padding: "calc(var(--space) / 2) var(--space)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--bg)",
  color: "var(--text)",
  font: "inherit",
  cursor: "pointer",
};

export function DocView({
  name,
  onConflictChange,
}: {
  name: string;
  onConflictChange(open: boolean): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
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
      },
      (err: Error) => setError(err.message),
    );
    return () => {
      cancelled = true;
      v?.destroy();
      view.current = null;
    };
  }, [name, save]);

  // ponytail: one socket per open doc; share one from App if more views need it.
  useEffect(
    () =>
      api.connectWs(async (m) => {
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
          replace(v, diskText);
          dirty.current = false;
        }
        setConflict(action === "banner" ? diskText : null);
      }),
    [name],
  );

  const keepMine = () => {
    setConflict(null);
    if (view.current) void persist(view.current.state.doc.toString());
  };

  const takeTheirs = () => {
    if (conflict !== null && view.current) {
      replace(view.current, conflict);
      dirty.current = false;
    }
    setConflict(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {conflict !== null && (
        <div role="alert" style={bannerStyle}>
          <span style={{ flex: 1 }}>
            This doc changed on disk while you had unsaved edits.
          </span>
          <button type="button" style={buttonStyle} onClick={keepMine}>
            Keep mine
          </button>
          <button type="button" style={buttonStyle} onClick={takeTheirs}>
            Take theirs
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="empty">
          {error}
        </p>
      )}
      <div ref={host} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
