"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

/**
 * Client form that creates a new learning run via POST /runs.
 * On success it navigates to the run detail page. Surfaces backend errors
 * inline instead of throwing.
 */
export function NewRunForm() {
  const router = useRouter();
  const [platformName, setPlatformName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [maxSteps, setMaxSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!platformName.trim() || !baseUrl.trim()) {
      setError("Platform name and base URL are required.");
      return;
    }

    const allowlistArr = allowlist
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const maxStepsNum = maxSteps.trim() ? Number(maxSteps) : undefined;

    if (maxStepsNum !== undefined && !Number.isFinite(maxStepsNum)) {
      setError("Max steps must be a number.");
      return;
    }

    setSubmitting(true);
    const res = await api.createRun({
      platform_name: platformName.trim(),
      base_url: baseUrl.trim(),
      ...(allowlistArr.length ? { allowlist: allowlistArr } : {}),
      ...(maxStepsNum !== undefined ? { max_steps: maxStepsNum } : {}),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    // Reset and go to the new run.
    setPlatformName("");
    setBaseUrl("");
    setAllowlist("");
    setMaxSteps("");
    router.push(`/runs/${res.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Platform name" required>
          <input
            type="text"
            value={platformName}
            onChange={(e) => setPlatformName(e.target.value)}
            placeholder="Acme Admin"
            className={inputClass}
          />
        </Field>
        <Field label="Base URL" required>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://app.example.com"
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Allowlist"
        hint="Optional. One host/path per line or comma-separated."
      >
        <textarea
          value={allowlist}
          onChange={(e) => setAllowlist(e.target.value)}
          rows={2}
          placeholder="app.example.com&#10;app.example.com/settings"
          className={`${inputClass} resize-y font-mono text-xs`}
        />
      </Field>

      <Field label="Max steps" hint="Optional cap on exploration steps.">
        <input
          type="number"
          min={1}
          value={maxSteps}
          onChange={(e) => setMaxSteps(e.target.value)}
          placeholder="200"
          className={`${inputClass} max-w-[12rem]`}
        />
      </Field>

      {error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Starting…" : "Start run"}
        </button>
        <span className="text-xs text-muted">
          Posts to <code className="text-slate-300">/api/v1/runs</code>
        </span>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-300">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
