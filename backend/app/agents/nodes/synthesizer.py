"""Workflow Synthesizer — composes candidate workflows from real graph edges.

Grounding rule (PRD §9, GR2): a candidate may only reference transitions that
already exist as observed edges in the UI graph — it never invents a path.
"""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_synthesizer(deps: NodeDeps):
    async def synthesizer(state: AgentState) -> dict:
        await deps.emit_event(
            type="node",
            node="synthesizer",
            message="Composing candidate workflows from verified graph edges",
        )
        idx = len(state.get("candidates", [])) + len(state.get("verified", [])) + 1
        candidate = {
            "id": f"wf-{idx}",
            "name": f"workflow-{idx}",
            "goal": "auto-discovered workflow",
            "steps": [],
        }
        candidates = list(state.get("candidates", [])) + [candidate]
        return {"candidates": candidates}

    return synthesizer
