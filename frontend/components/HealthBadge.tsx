import { api } from "@/lib/api";
import { cn } from "@/lib/format";

/**
 * Server component that polls /health and renders a compact health badge.
 * Renders an "unreachable" state instead of throwing when the backend is down.
 */
export async function HealthBadge() {
  const res = await api.health();

  if (!res.ok) {
    return (
      <Badge tone="danger" label="Backend offline" detail={res.error} />
    );
  }

  const { redis, llm_configured } = res.data;
  const tone = redis && llm_configured ? "ok" : "warn";
  const label =
    redis && llm_configured ? "Backend healthy" : "Backend degraded";

  return (
    <Badge
      tone={tone}
      label={label}
      detail={`redis: ${redis ? "up" : "down"} · llm: ${
        llm_configured ? "configured" : "missing key"
      }`}
    />
  );
}

function Badge({
  tone,
  label,
  detail,
}: {
  tone: "ok" | "warn" | "danger";
  label: string;
  detail?: string;
}) {
  const toneStyles: Record<typeof tone, string> = {
    ok: "border-ok/40 bg-ok/10 text-ok",
    warn: "border-warn/40 bg-warn/10 text-warn",
    danger: "border-danger/40 bg-danger/10 text-danger",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
        toneStyles[tone],
      )}
      title={detail}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      <span className="font-medium">{label}</span>
      {detail ? (
        <span className="hidden text-current/70 sm:inline">· {detail}</span>
      ) : null}
    </div>
  );
}
