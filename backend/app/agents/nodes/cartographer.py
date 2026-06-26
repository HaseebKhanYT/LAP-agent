"""Cartographer — merges raw observations into the deduplicated UI graph (PRD §6)."""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_cartographer(deps: NodeDeps):
    async def cartographer(state: AgentState) -> dict:
        await deps.emit_event(
            type="node",
            node="cartographer",
            message="Merging observations into the deduplicated UI graph",
        )
        # Real impl: dedup states by signature, resolve transitions, detect cycles.
        return {}

    return cartographer
