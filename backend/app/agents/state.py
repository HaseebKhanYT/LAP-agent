"""Shared LangGraph state for a learning run.

This is the "blackboard" the agents coordinate through (PRD §6). It is checkpointed
by Redis, so a run can pause (e.g. on a human-in-the-loop interrupt) and resume.
"""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, TypedDict


class AgentState(TypedDict, total=False):
    # ── run identity / inputs ────────────────────────────────────────────────
    run_id: str
    platform_name: str
    base_url: str
    allowlist: list[str]
    max_steps: int

    # ── progress ─────────────────────────────────────────────────────────────
    phase: str
    step_count: int
    done: bool

    # ── discovery state ──────────────────────────────────────────────────────
    frontier: list[str]            # state signatures queued for exploration
    coverage: dict[str, int]       # {states, elements, workflows, verified}
    candidates: list[dict[str, Any]]   # proposed (unverified) workflows
    verified: list[dict[str, Any]]     # workflows that passed clean-replay
    last_verify_ok: bool

    # ── append-only run log (reducer merges concurrent writes) ───────────────
    log: Annotated[list[str], add]
