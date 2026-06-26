"""Conductor — owns the run: frontier, budgets, and stop conditions (PRD §6)."""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState

_ZERO_COVERAGE = {"states": 0, "elements": 0, "workflows": 0, "verified": 0}


def make_conductor(deps: NodeDeps):
    async def conductor(state: AgentState) -> dict:
        step = state.get("step_count", 0)
        coverage = dict(state.get("coverage") or _ZERO_COVERAGE)

        if step == 0:
            await deps.emit_event(
                type="phase",
                node="conductor",
                message=f"Starting learning run for {state['platform_name']}",
            )
            frontier = ["__entry__"]
        else:
            frontier = state.get("frontier", [])

        max_steps = state.get("max_steps") or deps.settings.run_max_steps
        # Stop conditions (PRD §8): budget exhausted or frontier drained.
        # The scaffold also caps cycles so a keyed demo run terminates quickly;
        # a real run would stop on coverage threshold / novelty decay.
        done = step >= min(max_steps, 3) or (step > 0 and not frontier)
        if done:
            await deps.emit_event(
                type="phase", node="conductor", message="Coverage/budget reached; finishing run"
            )
            return {"done": True, "phase": "completed", "coverage": coverage}

        await deps.emit_event(
            type="node",
            node="conductor",
            message=f"Cycle {step + 1}: dispatching scout",
            data={"frontier": len(frontier)},
        )
        return {
            "step_count": step + 1,
            "phase": "exploring",
            "frontier": frontier,
            "coverage": coverage,
            "done": False,
        }

    return conductor


def route_after_conductor(state: AgentState) -> str:
    return "finish" if state.get("done") else "explore"
