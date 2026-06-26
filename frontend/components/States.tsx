import type { ReactNode } from "react";

/** Friendly placeholder shown when a list/section has no data. */
export function EmptyState({
  title,
  hint,
  icon = "∅",
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-panel-2/40 px-6 py-10 text-center">
      <div className="mb-2 text-2xl text-muted">{icon}</div>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Non-fatal error banner used when a backend call fails. The whole point of the
 * app is to degrade gracefully, so this is informative rather than alarming.
 */
export function ErrorState({
  message,
  title = "Backend unavailable",
}: {
  message?: string;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3">
      <p className="text-sm font-medium text-warn">{title}</p>
      {message ? (
        <p className="mt-1 break-words text-xs text-warn/80">{message}</p>
      ) : null}
      <p className="mt-1 text-xs text-warn/70">
        The UI is running, but it could not reach the LAP backend. Check that the
        service is up at the configured API base URL.
      </p>
    </div>
  );
}
