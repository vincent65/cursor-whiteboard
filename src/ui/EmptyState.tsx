import type { ReactNode } from "react";

// One empty state for every page: a title, what the page is for, and the step
// that fills it, centred in the page.
export function EmptyState({
  title,
  children,
  action,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  // Sits in a page with other content instead of filling it.
  compact?: boolean;
}) {
  return (
    <section
      className={compact ? "empty-state empty-state-compact" : "empty-state"}
      aria-label={title}
    >
      <h2 className="empty-title">{title}</h2>
      <div className="empty-body">{children}</div>
      {action && <div className="empty-action">{action}</div>}
    </section>
  );
}
