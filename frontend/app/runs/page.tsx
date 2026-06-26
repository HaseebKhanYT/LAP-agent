import { Card, SectionHeader } from "@/components/Card";
import { NewRunForm } from "@/components/NewRunForm";
import { PageHeader } from "@/components/PageHeader";
import { RunsTable } from "@/components/RunsTable";
import { ErrorState } from "@/components/States";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runsRes = await api.listRuns();
  const runs = runsRes.ok ? runsRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runs"
        description="Start new learning runs and monitor existing ones."
      />

      <Card>
        <SectionHeader
          title="New run"
          subtitle="Point an agent at a platform to explore and map its UI."
        />
        <NewRunForm />
      </Card>

      <Card>
        <SectionHeader
          title="All runs"
          subtitle={
            runsRes.ok ? `${runs.length} total` : "Could not load runs"
          }
        />
        {!runsRes.ok ? (
          <div className="mb-4">
            <ErrorState message={runsRes.error} />
          </div>
        ) : null}
        <RunsTable runs={runs} />
      </Card>
    </div>
  );
}
