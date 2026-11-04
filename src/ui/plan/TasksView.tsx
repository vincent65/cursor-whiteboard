import { ListChecks } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { citationKey, parseCitations } from "../../export/citations";
import type { GateResult } from "../../shared/runs";
import type { TaskFile } from "../../shared/tasks";
import type { RunPermissionMode } from "../../shared/types";
import * as api from "../api";
import { EmptyState } from "../EmptyState";
import { routeHash } from "../hooks/useHashRoute";
import { Inline } from "../markdown";
import { useServerEvent } from "../server-events";
import { CitationLink } from "./citations";
import { LaunchDialog } from "./LaunchDialog";

const SESSIONS = routeHash({ kind: "sessions" });

function Source({
  source,
  labels,
}: {
  source: string;
  labels: Record<string, string>;
}) {
  const [c] = parseCitations(source);
  return c ? (
    <CitationLink citation={c} label={labels[citationKey(c)]} />
  ) : (
    <span>{source}</span>
  );
}

// The last split's cost. A split usually finishes while the spec view is
// open, so App holds this and hands it to the tasks view.
export function useSplitCost(): number | null {
  const [cost, setCost] = useState<number | null>(null);
  useServerEvent((m) => {
    if (
      m.type === "split.status" &&
      m.state === "done" &&
      m.costUsd !== undefined
    )
      setCost(m.costUsd);
  });
  return cost;
}

export function TasksView({ cost }: { cost: number | null }) {
  const [tasks, setTasks] = useState<TaskFile[] | null>(null);
  // What each cited shape or heading is called, from the spec route; a chip without
  // one, or a failed load, shows the id.
  const [labels, setLabels] = useState<Record<string, string>>({});
  // Slugs that have a run. A task runs once: its branch already exists after.
  const [ran, setRan] = useState<Set<string>>(new Set());
  // The task whose launch dialog is open, with its gate.
  const [launching, setLaunching] = useState<{
    slug: string;
    gate: GateResult;
  } | null>(null);
  // A failed load or split, shown until the next split starts.
  const [error, setError] = useState<string | null>(null);
  // A failed gate check, shown until a check next opens the dialog.
  const [gateError, setGateError] = useState<string | null>(null);
  // The task whose Launch button takes focus back once its dialog closes.
  const refocus = useRef<string | null>(null);

  const load = useCallback(() => {
    api.getSpec().then((s) => setLabels(s.labels), console.error);
    return api
      .listTasks()
      .then(setTasks, (err: Error) => setError(err.message));
  }, []);
  const loadRuns = useCallback(
    () =>
      api.listRuns().then(
        (runs) => setRan(new Set(runs.map((r) => r.taskSlug))),
        (err: Error) => setError(err.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
    void loadRuns();
  }, [load, loadRuns]);

  const openLaunch = (slug: string) =>
    api.gate(slug).then(
      (gate) => {
        setLaunching({ slug, gate });
        setGateError(null);
      },
      (err: Error) => setGateError(err.message),
    );

  const closeLaunch = (slug: string) => {
    refocus.current = slug;
    setLaunching(null);
  };

  const launch = async (
    taskSlug: string,
    permissionMode: RunPermissionMode,
    override: boolean,
  ) => {
    await api.launchRun({ taskSlug, permissionMode, override });
    setLaunching(null);
    location.hash = SESSIONS;
  };

  useServerEvent((m) => {
    if (m.type === "file-changed" && m.kind === "task") void load();
    if (m.type === "runs.changed") {
      void loadRuns();
      // A run starting or ending can change what an open dialog's gate says.
      const slug = launching?.slug;
      if (slug)
        api
          .gate(slug)
          .then(
            (gate) =>
              setLaunching((cur) =>
                cur?.slug === slug ? { slug, gate } : cur,
              ),
            console.error,
          );
    }
    if (m.type !== "split.status") return;
    setError(m.state === "error" ? (m.message ?? "The split failed.") : null);
    if (m.state === "done") void load();
  });

  return (
    <div className="plan-page">
      {cost !== null && <p className="muted">Split cost ${cost.toFixed(4)}</p>}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      {gateError && (
        <p role="alert" className="plan-error">
          {gateError}
        </p>
      )}
      {tasks?.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          action={
            <a className="button" href={routeHash({ kind: "spec" })}>
              Open the spec
            </a>
          }
        >
          <p>
            Split the spec into tasks, each with its dependencies, files, and
            acceptance criteria. Then launch a Claude Code session for each one.
          </p>
        </EmptyState>
      )}
      {tasks?.map(({ file, task }) => (
        <article key={file} className="task-card">
          <p className="task-file">{file}</p>
          <h2 className="task-title">
            <Inline text={task.title} />
          </h2>
          {task.dependsOn.length > 0 && (
            <p className="task-meta">Depends on: {task.dependsOn.join(", ")}</p>
          )}
          {task.acceptance.length > 0 && (
            <ul className="task-list">
              {task.acceptance.map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat and never move
                <li key={i}>
                  <Inline text={a} />
                </li>
              ))}
            </ul>
          )}
          {task.sources.length > 0 && (
            <p className="task-sources">
              {task.sources.map((s, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: sources can repeat and never move
                <Source key={i} source={s} labels={labels} />
              ))}
            </p>
          )}
          {ran.has(task.slug) ? (
            <a className="button task-action" href={SESSIONS}>
              View run
            </a>
          ) : launching?.slug === task.slug ? (
            <LaunchDialog
              title={task.title}
              gate={launching.gate}
              onLaunch={(mode, override) => launch(task.slug, mode, override)}
              onClose={() => closeLaunch(task.slug)}
            />
          ) : (
            <button
              type="button"
              className="button task-action"
              ref={(el) => {
                if (el && refocus.current === task.slug) {
                  refocus.current = null;
                  el.focus();
                }
              }}
              onClick={() => openLaunch(task.slug)}
            >
              Launch
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
