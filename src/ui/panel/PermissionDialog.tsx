import type { PendingPermission, PermissionDecision } from "../../shared/panel";

const CHOICES: [string, PermissionDecision["behavior"]][] = [
  ["Allow once", "allow"],
  ["Allow always", "always"],
  ["Deny", "deny"],
];

export function PermissionDialog({
  ask,
  onDecide,
}: {
  ask: PendingPermission;
  onDecide(behavior: PermissionDecision["behavior"]): void;
}) {
  return (
    <div role="alertdialog" aria-labelledby={ask.id} className="notice">
      <span id={ask.id} className="notice-text">
        Allow <strong>{ask.tool}</strong>: {ask.summary}
      </span>
      {CHOICES.map(([label, behavior]) => (
        <button
          key={behavior}
          type="button"
          className="button"
          onClick={() => onDecide(behavior)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
