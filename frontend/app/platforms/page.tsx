import Link from "next/link";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState } from "@/components/States";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const res = await api.listPlatforms();
  const platforms: Platform[] = res.ok ? res.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platforms"
        description="Knowledge learned by LAP, grouped by platform."
      />

      {!res.ok ? <ErrorState message={res.error} /> : null}

      {res.ok && platforms.length === 0 ? (
        <EmptyState
          title="No platforms learned yet"
          hint="Once a learning run completes, the platform's capabilities and UI map will appear here."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => (
          <Link key={p.name} href={`/platforms/${encodeURIComponent(p.name)}`}>
            <Card className="h-full transition-colors hover:border-accent/40">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-100">{p.name}</h2>
                <FreshnessBadge freshness={p.freshness} />
              </div>
              <p className="mt-1 truncate text-xs text-muted">{p.base_url}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Capabilities" value={p.capability_count} />
                <Stat label="States" value={p.state_count} />
              </div>

              <p className="mt-4 text-xs text-muted">
                Last learned: {formatDate(p.last_learned)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100">
        {value}
      </p>
    </div>
  );
}

function FreshnessBadge({ freshness }: { freshness: string }) {
  const tone = /stale|old/i.test(freshness)
    ? "border-warn/40 bg-warn/10 text-warn"
    : /fresh|recent/i.test(freshness)
      ? "border-ok/40 bg-ok/10 text-ok"
      : "border-border bg-panel text-muted";
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}
    >
      {freshness || "unknown"}
    </span>
  );
}
