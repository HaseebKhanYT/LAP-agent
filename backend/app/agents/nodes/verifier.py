"""Verifier — the anti-hallucination gate (PRD §9).

Independently replays each candidate workflow from a clean session. Only workflows
that replay successfully advance to documentation/publishing; failures are
quarantined and routed back to the synthesizer. This is the single edge through
which knowledge becomes publishable.
"""

from __future__ import annotations

from app.agents.deps import NodeDeps
from app.agents.state import AgentState


def make_verifier(deps: NodeDeps):
    async def verifier(state: AgentState) -> dict:
        candidates = list(state.get("candidates", []))
        if not candidates:
            return {"last_verify_ok": False}

        candidate = candidates[-1]
        await deps.emit_event(
            type="node", node="verifier", message=f"Clean-session replay of {candidate['id']}"
        )

        # Real impl: replay from a fresh session/account; assert each step's
        # expected resulting state + outcome markers. `ok` is hard-coded True in
        # the scaffold; the production gate computes it from replay assertions.
        ok = True

        if ok:
            coverage = dict(state.get("coverage") or {})
            coverage["workflows"] = coverage.get("workflows", 0) + 1
            coverage["verified"] = coverage.get("verified", 0) + 1
            await deps.emit_event(
                type="node",
                node="verifier",
                message=f"{candidate['id']} verified",
                data={"coverage": coverage},
            )
            return {
                "verified": list(state.get("verified", [])) + [candidate],
                "candidates": candidates[:-1],
                "coverage": coverage,
                "last_verify_ok": True,
            }

        await deps.emit_event(
            type="approval",
            node="verifier",
            message=f"{candidate['id']} failed replay; quarantined",
        )
        return {"candidates": candidates[:-1], "last_verify_ok": False}

    return verifier


def route_after_verifier(state: AgentState) -> str:
    return "publish" if state.get("last_verify_ok") else "resynthesize"
