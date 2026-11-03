import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import { replaceFromDisk, theme } from "../docs/DocView";
import { useServerEvent } from "../server-events";
import { citationMarks } from "./citations";

const marks = (text: string): DecorationSet =>
  Decoration.set(
    citationMarks(text).map(({ from, to, hash }) =>
      Decoration.mark({ class: "cite", hash }).range(from, to),
    ),
  );

const citeField = StateField.define<DecorationSet>({
  create: (state) => marks(state.doc.toString()),
  update: (deco, tr) => (tr.docChanged ? marks(tr.state.doc.toString()) : deco),
  provide: (field) => EditorView.decorations.from(field),
});

// A click on a citation opens what it cites. posAtDOM is exact even when
// other marks split the citation's span.
const followCitation = EditorView.domEventHandlers({
  click(event, view) {
    const el = (event.target as HTMLElement).closest(".cite");
    if (!el) return false;
    const pos = view.posAtDOM(el);
    let hash: string | undefined;
    view.state.field(citeField).between(pos, pos, (from, to, deco) => {
      if (from <= pos && pos < to) hash = deco.spec.hash;
    });
    if (hash) location.hash = hash;
    return hash !== undefined;
  },
});

type Spec = Awaited<ReturnType<typeof api.getSpec>>;

export function SpecView() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [splitting, setSplitting] = useState(false);
  // A failed load or split, until the next split status or successful load.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.getSpec().then(
        (next) => {
          setSpec(next);
          setError(null);
        },
        (err: Error) => setError(err.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  // A split started before this view mounted is known only to the server. A
  // split.status heard or a Split pressed meanwhile is newer than the state, so it wins.
  const heardSplit = useRef(false);
  useEffect(() => {
    api.agentState().then(
      (s) => {
        if (!heardSplit.current) setSplitting(s.splitting);
      },
      (err: Error) => setError(err.message),
    );
  }, []);

  const text = spec?.text ?? null;
  const hasText = text !== null;
  // The editor exists while there is a spec; reloads swap its text in place.
  useEffect(() => {
    if (!hasText || !host.current) return;
    const v = new EditorView({
      parent: host.current,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        theme,
        citeField,
        followCitation,
      ],
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [hasText]);
  useEffect(() => {
    const v = view.current;
    if (v && text !== null && v.state.doc.toString() !== text)
      replaceFromDisk(v, text);
  }, [text]);

  useServerEvent((m) => {
    if (m.type === "file-changed" && m.kind === "spec") void load();
    if (m.type !== "split.status") return;
    heardSplit.current = true;
    setSplitting(m.state === "running");
    setError(m.state === "error" ? (m.message ?? "The split failed.") : null);
  });

  const split = () => {
    heardSplit.current = true;
    setSplitting(true);
    setError(null);
    api.agentSplit().catch((err: Error) => {
      setSplitting(false);
      setError(err.message);
    });
  };

  // The spec can cite one gone element many times; name it once.
  const dropped = [...new Set((spec?.dropped ?? []).map((c) => c.raw))];
  return (
    <div className="spec">
      {spec && !hasText && (
        <p className="empty">No spec yet. Press Compile in the Claude panel.</p>
      )}
      {hasText && (
        <div className="notice">
          <span className="notice-text spec-dropped">
            {dropped.length > 0 &&
              (dropped.length === 1
                ? `Dropped 1 citation that no longer resolves: ${dropped[0]}`
                : `Dropped ${dropped.length} citations that no longer resolve: ${dropped.join(", ")}`)}
          </span>
          <button
            type="button"
            className="button button-primary"
            disabled={splitting}
            onClick={split}
          >
            {splitting ? "Splitting…" : "Split into tasks"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      {hasText && <div ref={host} className="spec-editor" />}
    </div>
  );
}
