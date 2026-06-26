import { cn } from "@/lib/format";
import type { ApprovalStatus, RunStatus } from "@/lib/types";

type AnyStatus = RunStatus | ApprovalStatus | string;

const STYLES: Record<string, string> = {
  // run statuses
  pending: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  running: "bg-accent-dim/30 text-accent border-accent/40",
  paused: "bg-warn/15 text-warn border-warn/40",
  completed: "bg-ok/15 text-ok border-ok/40",
  failed: "bg-danger/15 text-danger border-danger/40",
  // approval statuses
  approved: "bg-ok/15 text-ok border-ok/40",
  denied: "bg-danger/15 text-danger border-danger/40",
  skipped: "bg-slate-700/40 text-slate-300 border-slate-600/50",
};

/** A small pill that color-codes a run or approval status. */
export function StatusChip({ status }: { status: AnyStatus }) {
  const style = STYLES[status] ?? "bg-slate-700/40 text-slate-300 border-slate-600/50";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        style,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}
