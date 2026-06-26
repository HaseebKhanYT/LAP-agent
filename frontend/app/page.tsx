import Link from "next/link";
import { Suspense } from "react";
import { Card, SectionHeader } from "@/components/Card";
import { HealthBadge } from "@/components/HealthBadge";
import { PageHeader } from "@/components/PageHeader";
import { RunsTable } from "@/components/RunsTable";
import { ErrorState } from "@/components/States";
import { api } from "@/lib/api";
import type { Run } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [runsRes, platformsRes] = await Promise.all([
    api.listRuns(),
    api.listPlatforms(),
  ]);

  const runs: Run[] = runsRes.ok ? runsRes.data : [];
  const platformsCount = platformsRes.ok ? platformsRes.data.length : 0;
  const activeRuns = runs.filter(
    (r) => r.status === "running" || r.status === "paused",
  ).length;
  const recentRuns = [...runs]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const backendDown = !runsRes.ok && !platformsRes.ok;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of LAP learning activity and backend status."
        action={
          <Suspense
            fallback={
              <span className="text-xs text-muted">checking health…</span>
            }
          >
            <HealthBadge />
          </Suspense>
        }
      />

      {backendDown ? (
        <ErrorState
          message={runsRes.ok ? undefined : runsRes.error}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Platforms learned"
          value={platformsRes.ok ? String(platformsCount) : "—"}
          href="/platforms"
        />
        <StatCard
          label="Active runs"
          value={runsRes.ok ? String(activeRuns) : "—"}
          href="/runs"
        />
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Get started
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Point an agent at a platform to begin learning.
            </p>
          </div>
          <Link
            href="/runs"
            className="mt-4 inline-flex w-fit items-center justify-center rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-accent/90"
          >
            Start a run
          </Link>
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Recent runs"
          subtitle="Most recently updated learning runs."
          action={
            <Link
              href="/runs"
              className="text-xs font-medium text-accent hover:underline"
            >
              View all →
            </Link>
          }
        />
        <RunsTable runs={recentRuns} />
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-accent/40">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-100">
          {value}
        </p>
      </Card>
    </Link>
  );
}
