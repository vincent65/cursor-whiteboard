import type { PendingPermission, PermissionDecision } from "../../shared/panel";

export function PermissionDialog({
  ask,
  onDecide,
}: {
  ask: PendingPermission;
  onDecide(behavior: PermissionDecision["behavior"]): void;
}) {
  return (
    <div role="alertdialog" aria-labelledby={ask.id} className="ask">
      <span id={ask.id} className="ask-text">
        Allow <strong>{ask.tool}</strong>: {ask.summary}
      </span>
      {(
        [
          ["Allow once", "allow"],
          [ask.canAlways ? "Allow always" : "Allow for this session", "always"],
          ["Deny", "deny"],
        ] as const
      ).map(([label, behavior]) => (
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
