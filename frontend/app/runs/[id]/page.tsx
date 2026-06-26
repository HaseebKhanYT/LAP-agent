import Link from "next/link";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";
import { Card, SectionHeader } from "@/components/Card";
import { EventLog } from "@/components/EventLog";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/States";
import { StatusChip } from "@/components/StatusChip";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [runRes, approvalsRes] = await Promise.all([
    api.getRun(id),
    api.listApprovals(id),
  ]);

  if (!runRes.ok) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Run detail"
          description={`Run ${id}`}
          action={<BackLink />}
        />
        <ErrorState
          title="Could not load run"
          message={runRes.error}
        />
        <Card>
          <SectionHeader
            title="Live events"
            subtitle="The event stream will connect if the backend becomes available."
          />
          <EventLog runId={id} />
        </Card>
      </div>
    );
  }

  const run = runRes.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={run.platform_name}
        description={run.base_url}
        action={<BackLink />}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Meta label="Status">
            <StatusChip status={run.status} />
          </Meta>
          <Meta label="Phase">
            <span className="text-sm text-slate-200">{run.phase || "—"}</span>
          </Meta>
          <Meta label="Run ID">
            <span className="font-mono text-xs text-slate-300">{run.id}</span>
          </Meta>
          <Meta label="Created">
            <span className="text-sm text-slate-300">
              {formatDate(run.created_at)}
            </span>
          </Meta>
          <Meta label="Updated">
            <span className="text-sm text-slate-300">
              {formatDate(run.updated_at)}
            </span>
          </Meta>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CoverageStat label="States" value={run.coverage.states} />
          <CoverageStat label="Elements" value={run.coverage.elements} />
          <CoverageStat label="Workflows" value={run.coverage.workflows} />
          <CoverageStat
            label="Verified"
            value={run.coverage.verified}
            accent
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionHeader
            title="Live events"
            subtitle="Streamed from the agent via server-sent events."
          />
          <EventLog runId={run.id} />
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            title="Approvals"
            subtitle="Human-in-the-loop action gates."
          />
          <ApprovalsPanel
            runId={run.id}
            initialApprovals={approvalsRes.ok ? approvalsRes.data : []}
            initialError={approvalsRes.ok ? undefined : approvalsRes.error}
          />
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/runs"
      className="text-sm font-medium text-accent hover:underline"
    >
      ← All runs
    </Link>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function CoverageStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel-2 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          accent ? "text-ok" : "text-slate-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
