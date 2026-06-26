import { EmptyState, ErrorState } from "@/components/States";
import type { UIMap, UIMapNode } from "@/lib/types";

/**
 * Lightweight UI-map visual: states grouped by region (as cards) and a list of
 * transitions rendered as "from → to" rows. Intentionally avoids a graph
 * library to keep dependencies lean.
 */
export function UiMapView({
  map,
  error,
}: {
  map: UIMap | null;
  error?: string;
}) {
  if (error) return <ErrorState message={error} />;
  if (!map || (map.states.length === 0 && map.transitions.length === 0)) {
    return (
      <EmptyState
        title="No UI map"
        hint="The UI map is built as the agent explores states and transitions."
      />
    );
  }

  const byRegion = groupByRegion(map.states);
  const labelById = new Map(map.states.map((s) => [s.id, s.label]));

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          States ({map.states.length})
        </p>
        {map.states.length === 0 ? (
          <p className="text-xs text-muted">No states recorded.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byRegion).map(([region, nodes]) => (
              <div key={region}>
                <p className="mb-2 text-xs font-medium text-accent">{region}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {nodes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-border bg-panel-2 p-3"
                    >
                      <p className="font-medium text-slate-100">{n.label}</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-muted">
                        {n.url_pattern}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        {n.id}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Transitions ({map.transitions.length})
        </p>
        {map.transitions.length === 0 ? (
          <p className="text-xs text-muted">No transitions recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {map.transitions.map((t, i) => (
              <li
                key={`${t.from}-${t.to}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-panel-2 px-3 py-2 text-xs"
              >
                <span className="rounded bg-panel px-2 py-0.5 text-slate-200">
                  {labelById.get(t.from) ?? t.from}
                </span>
                <span className="text-accent">→</span>
                <span className="rounded bg-panel px-2 py-0.5 text-slate-200">
                  {labelById.get(t.to) ?? t.to}
                </span>
                <span className="ml-auto text-muted">
                  <span className="text-warn">{t.action}</span> on{" "}
                  <span className="font-mono text-slate-400">{t.element}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function groupByRegion(states: UIMapNode[]): Record<string, UIMapNode[]> {
  return states.reduce<Record<string, UIMapNode[]>>((acc, s) => {
    const key = s.region || "ungrouped";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});
}
