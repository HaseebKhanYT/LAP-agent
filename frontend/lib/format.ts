/** Formats an ISO timestamp as a readable local string; falls back to the raw value. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats an ISO timestamp as time-only (HH:MM:SS) for log lines. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour12: false });
}

/** Renders a 0..1 confidence value as a percentage string. */
export function formatConfidence(value: number): string {
  if (Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Joins class names, dropping falsy entries. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
