import { useCallback, useEffect, useRef, useState } from "react";
import { citationKey } from "../../export/citations";
import * as api from "../api";
import { Markdown } from "../markdown";
import { useServerEvent } from "../server-events";
import { CitationLink } from "./citations";

type Spec = Awaited<ReturnType<typeof api.getSpec>>;

export function SpecView() {
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
      {hasText && (
        // Read-only, so a document rather than an editor.
        <article className="spec-doc">
          <Markdown
            text={text}
            renderCitation={(c) => (
              <CitationLink citation={c} label={spec?.labels[citationKey(c)]} />
            )}
          />
        </article>
      )}
    </div>
  );
}
