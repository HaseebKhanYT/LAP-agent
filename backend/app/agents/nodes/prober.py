"""Prober — learns each element's effect via controlled interaction.

This is where the human-in-the-loop gate lives (PRD §10): when a candidate action
is classified irreversible/destructive, the node calls `interrupt(...)`, which
pauses the graph (state is checkpointed to Redis) until an operator resumes it
with `Command(resume=...)` from the approvals API.
"""

from __future__ import annotations

from langgraph.types import interrupt

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_prober(deps: NodeDeps):
    async def prober(state: AgentState) -> dict:
        await deps.emit_event(
            type="node", node="prober", message="Probing element effects via before/after diffs"
        )

        # Real impl: classify each element's action risk. For irreversible/destructive
        # actions, request human approval before executing (even in a sandbox).
        risky_action: dict | None = None  # e.g. {"action": "delete", "target": "Invoice #123"}

        if risky_action is not None:
            decision = interrupt(
                {
                    "kind": "approval_required",
                    "action": risky_action["action"],
                    "risk_class": "destructive",
                    "target": risky_action["target"],
                    "state_id": (state.get("frontier") or ["?"])[-1],
                }
            )
            # `decision` is the payload the operator resumes with.
            if isinstance(decision, dict) and decision.get("decision") == "deny":
                await deps.emit_event(
                    type="approval", node="prober", message="Operator denied action; skipping"
                )
                return {"log": ["prober: risky action denied"]}

        await deps.emit_event(type="node", node="prober", message="Element purposes recorded")
        return {}

    return prober
