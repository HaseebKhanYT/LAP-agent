import Link from "next/link";
import { CapabilityExplorer } from "@/components/CapabilityExplorer";
import { Card, SectionHeader } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { UiMapView } from "@/components/UiMapView";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function PlatformDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const platform = decodeURIComponent(name);

  const [capsRes, mapRes] = await Promise.all([
    api.listCapabilities(platform),
    api.getUiMap(platform),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={platform}
        description="Capability catalog and learned UI map."
        action={
          <Link
            href="/platforms"
            className="text-sm font-medium text-accent hover:underline"
          >
            ← All platforms
          </Link>
        }
      />

      <Card>
        <SectionHeader
          title="Capabilities"
          subtitle="Search the catalog, then select a capability to view its recipe."
        />
        <CapabilityExplorer
          platform={platform}
          initialCapabilities={capsRes.ok ? capsRes.data : []}
          initialError={capsRes.ok ? undefined : capsRes.error}
        />
      </Card>

      <Card>
        <SectionHeader
          title="UI map"
          subtitle="States grouped by region and the transitions between them."
        />
        <UiMapView
          map={mapRes.ok ? mapRes.data : null}
          error={mapRes.ok ? undefined : mapRes.error}
        />
      </Card>
    </div>
  );
}
