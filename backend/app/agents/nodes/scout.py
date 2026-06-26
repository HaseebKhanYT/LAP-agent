"""Scout — crawls a state, snapshots it, enumerates interactive elements.

Demonstrates the Nebius LLM integration point: a real scout would feed the page's
accessibility tree to the model for semantic understanding. Requesting the chat
model with no API key raises here — the intended boundary where credentials are
needed before a run can do inference.
"""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_scout(deps: NodeDeps):
    async def scout(state: AgentState) -> dict:
        await deps.emit_event(
            type="node",
            node="scout",
            message="Capturing accessibility tree and enumerating interactive elements",
        )

        # Integration point: page understanding via Nebius Token Factory.
        # Real impl would pass the captured a11y tree / DOM snapshot.
        model = deps.llm.chat_model()
        await model.ainvoke("You are a UI scout. Reply with the single word: ready.")

        coverage = dict(state.get("coverage") or {})
        coverage["states"] = coverage.get("states", 0) + 1
        coverage["elements"] = coverage.get("elements", 0) + 5
        new_state_id = f"state-{coverage['states']}"
        frontier = [f for f in state.get("frontier", []) if f != "__entry__"] + [new_state_id]

        await deps.emit_event(
            type="node",
            node="scout",
            message=f"Discovered {new_state_id} (+5 elements)",
            data={"coverage": coverage},
        )
        return {"coverage": coverage, "frontier": frontier}

    return scout
