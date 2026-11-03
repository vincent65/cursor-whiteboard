import { useEffect, useId, useRef, useState } from "react";
import type { GateResult, MissingDependency } from "../../shared/runs";
import type { RunPermissionMode } from "../../shared/types";
import { Inline } from "../markdown";

const REASONS: Record<MissingDependency["reason"], string> = {
  "no run": "no run",
  "not done": "run not done",
  "not merged": "branch not merged into HEAD",
};

const MODES: [RunPermissionMode, string, string][] = [
  [
    "acceptEdits",
    "Accept edits",
    "Edits files without asking; asks before other tools.",
  ],
  ["default", "Ask first", "Asks before every edit and command."],
  [
    "bypassPermissions",
    "Bypass permissions",
    "Never asks. Use only on a repository you trust.",
  ],
];

// Launching a task: what its gate is missing, the run's permission mode, and
// an override for a failed gate. A failed launch stays open with its reason.
export function LaunchDialog({
  title,
  gate,
  onLaunch,
  onClose,
}: {
  title: string;
  gate: GateResult;
  onLaunch(mode: RunPermissionMode, override: boolean): Promise<void>;
  onClose(): void;
}) {
  const [mode, setMode] = useState<RunPermissionMode>("acceptEdits");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const id = useId();

  useEffect(() => select.current?.focus(), []);

  const launch = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLaunch(mode, override);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      className="launch-dialog"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <h3 id={`${id}-title`} className="launch-title">
        Launch <Inline text={title} />
      </h3>
      <p className="muted">
        Starts a session on branch <code>{gate.branch}</code> in its own
        worktree.
      </p>
      {!gate.ok && (
        <>
          <p>These dependencies are not ready:</p>
          <ul className="task-list">
            {gate.missing.map((m) => (
              <li key={m.slug}>
                {m.slug}: {REASONS[m.reason]}
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="launch-field">
        Permission mode
        <select
          ref={select}
          className="run-input"
          value={mode}
          onChange={(e) => setMode(e.target.value as RunPermissionMode)}
        >
          {MODES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{MODES.find(([value]) => value === mode)?.[2]}</p>
      {!gate.ok && (
        <label className="launch-check">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          Launch anyway
        </label>
      )}
      {error && (
        <p role="alert" className="plan-error">
          {error}
        </p>
      )}
      <div className="run-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={busy || (!gate.ok && !override)}
          onClick={launch}
        >
          Launch
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
