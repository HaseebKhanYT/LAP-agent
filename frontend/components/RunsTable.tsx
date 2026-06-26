import Link from "next/link";
import { StatusChip } from "@/components/StatusChip";
import { EmptyState } from "@/components/States";
import { formatDate } from "@/lib/format";
import type { Run } from "@/lib/types";

/** Table of runs with status chips, coverage summary, and links to detail pages. */
export function RunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        title="No runs yet"
        hint="Start a learning run to have an agent explore and map a platform."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-panel-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Platform</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Phase</th>
            <th className="px-4 py-2.5 font-medium">Coverage</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-panel-2/50">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-100">
                  {run.platform_name}
                </div>
                <div className="truncate text-xs text-muted">
                  {run.base_url}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusChip status={run.status} />
              </td>
              <td className="px-4 py-3 text-slate-300">{run.phase || "—"}</td>
              <td className="px-4 py-3 text-xs text-muted">
                <span className="text-slate-300">{run.coverage.states}</span>{" "}
                states ·{" "}
                <span className="text-slate-300">{run.coverage.workflows}</span>{" "}
                flows ·{" "}
                <span className="text-ok">{run.coverage.verified}</span> verified
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {formatDate(run.updated_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/runs/${run.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
