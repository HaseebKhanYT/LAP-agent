"""Builds the LAP multi-agent LangGraph (PRD §6).

    START → conductor ──(finish)──▶ END
                │ (explore)
                ▼
            scout → prober → cartographer → synthesizer → verifier
                                                              │
                              (publish) ◀───────────────────┤
                                  │                          │ (resynthesize)
                                  ▼                          ▼
                            documenter → publisher → conductor (loop)
                                                              ▲
                                       synthesizer ◀──────────┘

Compiled with an AsyncRedisSaver checkpointer so runs are durable and resumable
(important for the human-in-the-loop interrupt in the prober node).
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agents.deps import NodeDeps
from app.agents.nodes.cartographer import make_cartographer
from app.agents.nodes.conductor import make_conductor, route_after_conductor
from app.agents.nodes.documenter import make_documenter
from app.agents.nodes.prober import make_prober
from app.agents.nodes.publisher import make_publisher
from app.agents.nodes.scout import make_scout
from app.agents.nodes.synthesizer import make_synthesizer
from app.agents.nodes.verifier import make_verifier, route_after_verifier
from app.agents.state import AgentState


def build_graph(deps: NodeDeps, checkpointer: Any | None = None):
    builder = StateGraph(AgentState)

    builder.add_node("conductor", make_conductor(deps))
    builder.add_node("scout", make_scout(deps))
    builder.add_node("prober", make_prober(deps))
    builder.add_node("cartographer", make_cartographer(deps))
    builder.add_node("synthesizer", make_synthesizer(deps))
    builder.add_node("verifier", make_verifier(deps))
    builder.add_node("documenter", make_documenter(deps))
    builder.add_node("publisher", make_publisher(deps))

    builder.add_edge(START, "conductor")
    builder.add_conditional_edges(
        "conductor", route_after_conductor, {"explore": "scout", "finish": END}
    )
    builder.add_edge("scout", "prober")
    builder.add_edge("prober", "cartographer")
    builder.add_edge("cartographer", "synthesizer")
    builder.add_edge("synthesizer", "verifier")
    builder.add_conditional_edges(
        "verifier", route_after_verifier, {"publish": "documenter", "resynthesize": "synthesizer"}
    )
    builder.add_edge("documenter", "publisher")
    builder.add_edge("publisher", "conductor")

    return builder.compile(checkpointer=checkpointer)
