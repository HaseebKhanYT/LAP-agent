"""Publisher — persists verified knowledge to the store with provenance (PRD §6)."""

from __future__ import annotations

from datetime import UTC, datetime

from app.agents.deps import NodeDeps
from app.agents.state import AgentState
from app.schemas.knowledge import Capability, Platform, Recipe


def make_publisher(deps: NodeDeps):
    async def publisher(state: AgentState) -> dict:
        await deps.emit_event(
            type="node", node="publisher", message="Publishing verified knowledge to the store"
        )
        platform = state["platform_name"]
        now = datetime.now(UTC)
        coverage = state.get("coverage") or {}

        await deps.store.upsert_platform(
            Platform(
                name=platform,
                base_url=state.get("base_url", ""),
                last_learned=now,
                capability_count=coverage.get("verified", 0),
                state_count=coverage.get("states", 0),
                freshness="fresh",
            )
        )

        verified = state.get("verified", [])
        if verified:
            wf = verified[-1]
            await deps.store.add_capability(
                platform,
                Capability(
                    id=wf["id"],
                    name=wf["name"],
                    goal=wf.get("goal", ""),
                    status="verified",
                    confidence=0.95,
                ),
            )
            await deps.store.add_recipe(
                Recipe(
                    capability=wf["name"],
                    platform=platform,
                    provenance=[f"run:{state['run_id']}"],
                    confidence=0.95,
                    last_verified=now,
                )
            )
        return {}

    return publisher
