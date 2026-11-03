import { useCallback, useEffect, useState } from "react";
import { parseCitations } from "../../export/citations";
import type { TaskFile } from "../../shared/tasks";
import * as api from "../api";
import { useServerEvent } from "../server-events";
import { citationHash } from "./citations";

function Source({ source }: { source: string }) {
  const [c] = parseCitations(source);
  return c ? <a href={citationHash(c)}>{source}</a> : <span>{source}</span>;
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
  // A failed load or split, shown until the next split starts.
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => api.listTasks().then(setTasks, (err: Error) => setError(err.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  useServerEvent((m) => {
    if (m.type === "file-changed" && m.kind === "task") void load();
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
      {tasks?.length === 0 && (
        <p className="muted">No tasks yet. Split the spec first.</p>
      )}
      {tasks?.map(({ file, task }) => (
        <article key={file} className="task-card">
          <p className="task-file">{file}</p>
          <h2 className="task-title">{task.title}</h2>
          {task.dependsOn.length > 0 && (
            <p className="task-meta">Depends on: {task.dependsOn.join(", ")}</p>
          )}
          {task.acceptance.length > 0 && (
            <ul className="task-list">
              {task.acceptance.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {task.sources.length > 0 && (
            <p className="task-sources">
              {task.sources.map((s) => (
                <Source key={s} source={s} />
              ))}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
