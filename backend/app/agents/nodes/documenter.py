"""Documenter — renders a verified workflow into a parameterized recipe (PRD §7)."""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_documenter(deps: NodeDeps):
    async def documenter(state: AgentState) -> dict:
        verified = state.get("verified", [])
        if verified:
            await deps.emit_event(
                type="node",
                node="documenter",
                message=f"Writing recipe + docs for {verified[-1]['id']}",
            )
        # Real impl: build executable RecipeStep[] with selectors and expected
        # outcomes. The publisher persists the result to the knowledge store.
        return {}

    return documenter
