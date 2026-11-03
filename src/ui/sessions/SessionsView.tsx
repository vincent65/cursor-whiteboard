import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelEvent } from "../../shared/panel";
import type { OtherSession, RunView } from "../../shared/runs";
import * as api from "../api";
import { TranscriptList } from "../panel/TranscriptList";
import { reduceTranscript } from "../panel/transcript";
import { useServerEvent } from "../server-events";
import { RunCard } from "./RunCard";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function ago(ms: number): string {
  const diff = ms - Date.now();
  for (const [unit, size] of UNITS)
    if (Math.abs(diff) >= size)
      return relative.format(Math.round(diff / size), unit);
  return "just now";
}

const errorText = (err: unknown) => (err as Error).message;

// One of the repository's other sessions: read-only, its transcript loaded on first open.
function OtherSessionRow({ session }: { session: OtherSession }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PanelEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the newest transcript request may land.
  const latest = useRef(0);

  const load = () => {
    const n = ++latest.current;
    setError(null);
    api.sessionTranscript(session.sessionId).then(
      (list) => n === latest.current && setItems(list),
      (err) => n === latest.current && setError(errorText(err)),
    );
  };

  // Opening again after a failure retries, without the old failure meanwhile.
  const toggle = () => {
    if (!open && items === null) load();
    setOpen(!open);
  };

  // A run starting or ending may have touched this session: an open transcript
  // reloads now, a closed one on its next open.
  useServerEvent((m) => {
    if (m.type !== "runs.changed") return;
    if (open) load();
    else setItems(null);
  });

  return (
    <li className="other-session">
      <button
        type="button"
        className="other-head"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="other-summary">{session.summary}</span>
        <span
          className="other-meta"
          title={new Date(session.lastModified).toLocaleString()}
        >
          {ago(session.lastModified)}
        </span>
        {session.gitBranch && (
          <code className="other-meta run-branch">{session.gitBranch}</code>
        )}
      </button>
      {open && (
        <div className="transcript run-transcript">
          {error ? (
            <p role="alert" className="panel-failure">
              {error}
            </p>
          ) : items === null ? (
            <p className="muted">Loading…</p>
          ) : (
            <TranscriptList items={items} />
          )}
        </div>
      )}
    </li>
  );
}

// Every run as a card, newest first, then the repository's other sessions.
export function SessionsView() {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [transcripts, setTranscripts] = useState<Map<string, PanelEvent[]>>(
    new Map(),
  );
  const [others, setOthers] = useState<OtherSession[] | null>(null);
  // A failed runs load, until the next good one.
  const [error, setError] = useState<string | null>(null);
  // A failed load of the other sessions, which loads once.
  const [othersError, setOthersError] = useState<string | null>(null);
  // A run transcript that failed to load, shown in its card until the next try.
  const [transcriptErrors, setTranscriptErrors] = useState<Map<string, string>>(
    new Map(),
  );
  const loaded = useRef(new Set<string>());
  // Only the newest list request may land, so a slow older one cannot undo it.
  const latest = useRef(0);

  const load = useCallback(() => {
    const n = ++latest.current;
    api.listRuns().then(
      (list) => {
        if (n !== latest.current) return;
        setRuns(list);
        setError(null);
      },
      (err) => n === latest.current && setError(errorText(err)),
    );
  }, []);

  useEffect(() => {
    load();
    api.listSessions().then(setOthers, (err) => setOthersError(errorText(err)));
  }, [load]);

  const patchRun = (id: string, patch: (run: RunView) => RunView) =>
    setRuns((list) => list?.map((r) => (r.id === id ? patch(r) : r)) ?? list);

  useServerEvent((m) => {
    if (m.type === "runs.changed") load();
    else if (m.type === "run.status") {
      // The server reports needs_you while any ask waits, so any other status
      // means every ask was settled, here or in another tab.
      patchRun(m.runId, (r) => ({
        ...r,
        status: m.status,
        failure: m.status === "failed" ? (m.message ?? null) : null,
        pending: m.status === "needs_you" ? r.pending : [],
      }));
    } else if (m.type === "run.event") {
      const { runId, event } = m;
      setTranscripts((all) =>
        new Map(all).set(runId, reduceTranscript(all.get(runId) ?? [], event)),
      );
      if (event.kind === "permission")
        patchRun(runId, (r) =>
          r.pending.some((p) => p.id === event.id)
            ? r
            : { ...r, pending: [...r.pending, event] },
        );
      if (event.kind === "assistant_text" && !event.partial)
        patchRun(runId, (r) => ({ ...r, lastText: event.text }));
    }
  });

  const setTranscriptError = (id: string, message: string | null) =>
    setTranscriptErrors((all) => {
      const next = new Map(all);
      if (message === null) next.delete(id);
      else next.set(id, message);
      return next;
    });

  // Live events heard before the saved transcript arrives land on top of it. Opening
  // again after a failure retries, without the old failure meanwhile.
  const expand = (id: string) => {
    if (loaded.current.has(id)) return;
    loaded.current.add(id);
    setTranscriptError(id, null);
    api.runTranscript(id).then(
      (saved) =>
        setTranscripts((all) =>
          new Map(all).set(
            id,
            (all.get(id) ?? []).reduce(reduceTranscript, saved),
          ),
        ),
      (err) => {
        loaded.current.delete(id);
        setTranscriptError(id, errorText(err));
      },
    );
  };

  const answer = async (
    id: string,
    permissionId: string,
    decision: Parameters<typeof api.runPermission>[2],
  ) => {
    await api.runPermission(id, permissionId, decision);
    patchRun(id, (r) => ({
      ...r,
      pending: r.pending.filter((p) => p.id !== permissionId),
    }));
  };

  const newestFirst = runs
    ? [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    : [];

  return (
    <div className="sessions-page">
      <p className="muted">
        Runs share your Claude subscription's rate limits.
      </p>
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      {runs?.length === 0 && (
        <p className="muted">No runs yet. Launch one from the tasks view.</p>
      )}
      <div className="run-grid">
        {newestFirst.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            transcript={transcripts.get(run.id) ?? []}
            transcriptError={transcriptErrors.get(run.id) ?? null}
            onMessage={(text) => api.runMessage(run.id, text)}
            onStop={() => api.runStop(run.id)}
            onResume={() => api.runResume(run.id)}
            onDone={() => api.runDone(run.id)}
            onPermission={(pid, decision) => answer(run.id, pid, decision)}
            onExpand={() => expand(run.id)}
          />
        ))}
      </div>
      <section className="other-sessions" aria-labelledby="other-sessions">
        <h2 id="other-sessions" className="nav-title">
          Other sessions
        </h2>
        {othersError && (
          <p role="alert" className="plan-error">
            {othersError}
          </p>
        )}
        {others?.length === 0 && (
          <p className="muted">No other Claude sessions in this repository.</p>
        )}
        {others && others.length > 0 && (
          <ul className="other-list">
            {others.map((s) => (
              <OtherSessionRow key={s.sessionId} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
