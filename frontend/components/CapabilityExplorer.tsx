"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState } from "@/components/States";
import { cn, formatConfidence, formatDate } from "@/lib/format";
import type { Capability, Recipe } from "@/lib/types";

/**
 * Searchable capability catalog for a platform. Selecting a capability fetches
 * and displays its recipe (steps, parameters, provenance, confidence).
 * All fetches degrade gracefully to inline notices.
 */
export function CapabilityExplorer({
  platform,
  initialCapabilities,
  initialError,
}: {
  platform: string;
  initialCapabilities: Capability[];
  initialError?: string;
}) {
  const [query, setQuery] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>(
    initialCapabilities,
  );
  const [listError, setListError] = useState<string | undefined>(initialError);
  const [selected, setSelected] = useState<Capability | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      const res = await api.listCapabilities(platform, q || undefined);
      if (res.ok) {
        setCapabilities(res.data);
        setListError(undefined);
      } else {
        setListError(res.error);
      }
    },
    [platform],
  );

  // Debounced server-side search; the backend supports a `query` param.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void runSearch(query.trim());
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search capabilities…"
          className="mb-3 w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />

        {listError ? (
          <ErrorState message={listError} />
        ) : capabilities.length === 0 ? (
          <EmptyState
            title="No capabilities"
            hint={
              query
                ? "No capabilities match your search."
                : "This platform has no learned capabilities yet."
            }
          />
        ) : (
          <ul className="scroll-thin max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {capabilities.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    selected?.id === c.id
                      ? "border-accent/50 bg-accent-dim/20"
                      : "border-border bg-panel-2 hover:border-accent/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-100">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatConfidence(c.confidence)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                    {c.goal}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3">
        {selected ? (
          <RecipeView platform={platform} capability={selected} />
        ) : (
          <EmptyState
            title="Select a capability"
            hint="Choose a capability on the left to view its verified recipe."
            icon="→"
          />
        )}
      </div>
    </div>
  );
}

function RecipeView({
  platform,
  capability,
}: {
  platform: string;
  capability: Capability;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecipe(null);
    setError(undefined);

    api.getRecipe(platform, capability.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setRecipe(res.data);
      else setError(res.error);
    });

    return () => {
      cancelled = true;
    };
  }, [platform, capability.id]);

  return (
    <div className="rounded-lg border border-border bg-panel-2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100">{capability.name}</h3>
          <p className="mt-0.5 text-xs text-muted">{capability.goal}</p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-panel px-2 py-1 text-xs text-slate-300">
          confidence {formatConfidence(capability.confidence)}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading recipe…</p>
      ) : error ? (
        <ErrorState title="Could not load recipe" message={error} />
      ) : recipe ? (
        <div className="space-y-5">
          {recipe.parameters.length > 0 ? (
            <Section title="Parameters">
              <ul className="flex flex-wrap gap-2">
                {recipe.parameters.map((p) => (
                  <li
                    key={p.name}
                    className="rounded border border-border bg-panel px-2 py-1 text-xs"
                  >
                    <span className="text-slate-200">{p.name}</span>
                    <span className="text-muted"> : {p.type}</span>
                    {p.required ? (
                      <span className="ml-1 text-danger">*</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title={`Steps (${recipe.steps.length})`}>
            {recipe.steps.length === 0 ? (
              <p className="text-xs text-muted">No steps recorded.</p>
            ) : (
              <ol className="space-y-2">
                {recipe.steps.map((s) => (
                  <li
                    key={s.index}
                    className="flex gap-3 rounded border border-border bg-panel p-2.5 text-xs"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-dim/40 text-[10px] font-semibold text-accent">
                      {s.index}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200">
                        <span className="text-warn">{s.action}</span>{" "}
                        <span className="text-muted">on</span>{" "}
                        <span className="font-mono text-slate-300">
                          {s.element}
                        </span>
                      </p>
                      <p className="mt-0.5 text-muted">
                        state: <span className="text-slate-400">{s.state}</span>{" "}
                        · expect:{" "}
                        <span className="text-slate-400">{s.expected}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {recipe.provenance.length > 0 ? (
            <Section title="Provenance">
              <ul className="space-y-1 text-xs text-muted">
                {recipe.provenance.map((p, i) => (
                  <li key={i} className="break-words font-mono">
                    • {p}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <p className="text-xs text-muted">
            Last verified: {formatDate(recipe.last_verified)}
          </p>
        </div>
      ) : (
        <EmptyState title="No recipe" hint="No recipe is available for this capability." />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
