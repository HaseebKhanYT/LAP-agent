"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { EmptyState, ErrorState } from "@/components/States";
import { formatDate } from "@/lib/format";
import type { Approval, ApprovalDecision } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

/**
 * Lists a run's human-in-the-loop approvals and lets the operator
 * approve / deny / skip each pending gate. Polls periodically so new gates
 * appear without a manual refresh. Degrades to an error notice if offline.
 */
export function ApprovalsPanel({
  runId,
  initialApprovals,
  initialError,
}: {
  runId: string;
  initialApprovals: Approval[];
  initialError?: string;
}) {
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [error, setError] = useState<string | undefined>(initialError);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await api.listApprovals(runId);
    if (res.ok) {
      setApprovals(res.data);
      setError(undefined);
    } else {
      setError(res.error);
    }
  }, [runId]);

  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function decide(approvalId: string, decision: ApprovalDecision) {
    setPendingId(approvalId);
    const res = await api.decideApproval(approvalId, decision);
    setPendingId(null);
    if (res.ok) {
      setApprovals((prev) =>
        prev.map((a) => (a.id === approvalId ? res.data : a)),
      );
    } else {
      setError(res.error);
    }
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}

      {approvals.length === 0 && !error ? (
        <EmptyState
          title="No approvals"
          hint="Action gates requiring operator sign-off will appear here while the run is active."
        />
      ) : null}

      {pending.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-warn">
            Pending ({pending.length})
          </p>
          {pending.map((a) => (
            <ApprovalRow
              key={a.id}
              approval={a}
              busy={pendingId === a.id}
              onDecide={decide}
            />
          ))}
        </div>
      ) : null}

      {resolved.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Resolved ({resolved.length})
          </p>
          {resolved.map((a) => (
            <ApprovalRow key={a.id} approval={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ApprovalRow({
  approval,
  busy,
  onDecide,
}: {
  approval: Approval;
  busy?: boolean;
  onDecide?: (id: string, decision: ApprovalDecision) => void;
}) {
  const isPending = approval.status === "pending";
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-100">
              {approval.action}
            </span>
            <RiskBadge risk={approval.risk_class} />
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            target: <span className="text-slate-300">{approval.target}</span> ·
            state: <span className="text-slate-300">{approval.state_id}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDate(approval.created_at)}
          </p>
        </div>
        <StatusChip status={approval.status} />
      </div>

      {isPending && onDecide ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <DecisionButton
            label="Approve"
            tone="ok"
            disabled={busy}
            onClick={() => onDecide(approval.id, "approve")}
          />
          <DecisionButton
            label="Deny"
            tone="danger"
            disabled={busy}
            onClick={() => onDecide(approval.id, "deny")}
          />
          <DecisionButton
            label="Skip"
            tone="muted"
            disabled={busy}
            onClick={() => onDecide(approval.id, "skip")}
          />
          {busy ? (
            <span className="self-center text-xs text-muted">submitting…</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const tone =
    /high|destructive|danger/i.test(risk)
      ? "border-danger/40 bg-danger/10 text-danger"
      : /med/i.test(risk)
        ? "border-warn/40 bg-warn/10 text-warn"
        : "border-border bg-panel text-muted";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}
    >
      {risk || "unknown"}
    </span>
  );
}

function DecisionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: "ok" | "danger" | "muted";
  disabled?: boolean;
  onClick: () => void;
}) {
  const styles: Record<typeof tone, string> = {
    ok: "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20",
    danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    muted: "border-border bg-panel text-slate-300 hover:bg-panel-2",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[tone]}`}
    >
      {label}
    </button>
  );
}
