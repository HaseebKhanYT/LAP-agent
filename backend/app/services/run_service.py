"""Run lifecycle: launch the agent graph, stream events, resume HITL gates.

Run snapshots and the event buffer are kept in-process for the scaffold. For a
multi-worker deployment, move these to Redis/DB (see ARCHITECTURE.md §6); the
event bus already goes through Redis pub/sub, so streaming is worker-agnostic.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from langgraph.types import Command

from app.agents.deps import NodeDeps
from app.agents.graph import build_graph
from app.cache.redis import RedisManager
from app.core.config import Settings
from app.core.logging import get_logger
from app.llm.nebius import LLMNotConfiguredError, NebiusLLM
from app.repositories.base import KnowledgeStore
from app.schemas.approval import Approval, ApprovalDecision, ApprovalStatus
from app.schemas.run import Coverage, Run, RunCreate, RunStatus

logger = get_logger(__name__)

_TERMINAL = {RunStatus.completed, RunStatus.failed}
_DECISION_TO_STATUS = {
    "approve": ApprovalStatus.approved,
    "deny": ApprovalStatus.denied,
    "skip": ApprovalStatus.skipped,
}


def _now() -> datetime:
    return datetime.now(UTC)


class RunService:
    def __init__(
        self,
        *,
        settings: Settings,
        redis: RedisManager,
        store: KnowledgeStore,
        llm: NebiusLLM,
        checkpointer: Any,
    ) -> None:
        self._settings = settings
        self._redis = redis
        self._store = store
        self._llm = llm
        self._checkpointer = checkpointer

        self._runs: dict[str, Run] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}
        self._approvals: dict[str, Approval] = {}
        self._run_approvals: dict[str, list[str]] = {}
        self._tasks: set[asyncio.Task] = set()

    # ── public API ────────────────────────────────────────────────────────────
    async def start_run(self, req: RunCreate) -> Run:
        run = Run(
            id=str(uuid4()),
            platform_name=req.platform_name,
            base_url=req.base_url,
            status=RunStatus.pending,
            phase="queued",
            coverage=Coverage(),
            created_at=_now(),
            updated_at=_now(),
        )
        self._runs[run.id] = run
        self._events[run.id] = []

        max_steps = req.max_steps or self._settings.run_max_steps
        initial: dict[str, Any] = {
            "run_id": run.id,
            "platform_name": run.platform_name,
            "base_url": run.base_url,
            "allowlist": req.allowlist,
            "max_steps": max_steps,
            "step_count": 0,
            "coverage": {"states": 0, "elements": 0, "workflows": 0, "verified": 0},
        }
        self._spawn(self._drive(run, initial))
        return run

    def get_run(self, run_id: str) -> Run | None:
        return self._runs.get(run_id)

    def list_runs(self) -> list[Run]:
        return sorted(self._runs.values(), key=lambda r: r.created_at, reverse=True)

    def list_approvals(self, run_id: str) -> list[Approval]:
        return [
            self._approvals[a]
            for a in self._run_approvals.get(run_id, [])
            if a in self._approvals
        ]

    def get_approval(self, approval_id: str) -> Approval | None:
        return self._approvals.get(approval_id)

    async def decide_approval(
        self, approval_id: str, decision: ApprovalDecision
    ) -> Approval | None:
        approval = self._approvals.get(approval_id)
        if approval is None:
            return None
        approval.status = _DECISION_TO_STATUS[decision.decision]
        run = self._runs.get(approval.run_id)
        if run is not None and approval.status != ApprovalStatus.pending:
            resume = {"decision": decision.decision, "note": decision.note}
            self._spawn(self._drive(run, Command(resume=resume)))
        return approval

    async def stream_events(self, run_id: str) -> AsyncIterator[dict[str, Any]]:
        # Replay buffered history first so a late subscriber sees the whole run.
        for event in list(self._events.get(run_id, [])):
            yield event
        run = self._runs.get(run_id)
        if run is not None and run.status in _TERMINAL:
            return
        async for event in self._redis.subscribe(f"run:{run_id}:events"):
            yield event
            if event.get("type") in {"done", "error"}:
                return

    # ── internals ─────────────────────────────────────────────────────────────
    def _spawn(self, coro: Any) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def _make_emitter(self, run_id: str):
        async def emit(*, type: str, node: str, message: str, data: dict | None = None) -> None:
            ts = _now()
            event = {
                "run_id": run_id,
                "ts": ts.isoformat(),
                "type": type,
                "node": node,
                "message": message,
                "data": data,
            }
            run = self._runs.get(run_id)
            if run is not None:
                if data and "coverage" in data:
                    merged = {**run.coverage.model_dump(), **data["coverage"]}
                    run.coverage = Coverage(**merged)
                if type == "phase":
                    run.phase = message
                run.updated_at = ts
            buffer = self._events.setdefault(run_id, [])
            buffer.append(event)
            if len(buffer) > 500:
                del buffer[:-500]
            await self._redis.publish(f"run:{run_id}:events", event)

        return emit

    async def _drive(self, run: Run, stream_input: Any) -> None:
        emit = self._make_emitter(run.id)
        deps = NodeDeps(llm=self._llm, store=self._store, settings=self._settings, emit=emit)
        graph = build_graph(deps, self._checkpointer)
        config = {"configurable": {"thread_id": run.id}, "recursion_limit": 50}

        run.status = RunStatus.running
        run.updated_at = _now()
        try:
            async for chunk in graph.astream(stream_input, config=config, stream_mode="updates"):
                if isinstance(chunk, dict) and "__interrupt__" in chunk:
                    await self._handle_interrupt(run, chunk["__interrupt__"], emit)
                    run.status = RunStatus.paused
                    run.phase = "awaiting_approval"
                    run.updated_at = _now()
                    return
            run.status = RunStatus.completed
            run.phase = "completed"
            await emit(type="done", node="conductor", message="Run completed")
        except LLMNotConfiguredError as exc:
            run.status = RunStatus.failed
            run.phase = "failed"
            await emit(type="error", node="scout", message=str(exc))
        except Exception as exc:  # noqa: BLE001 — surface any run failure to the operator
            logger.exception("Run %s failed", run.id)
            run.status = RunStatus.failed
            run.phase = "failed"
            await emit(type="error", node="system", message=f"Run failed: {exc}")
        finally:
            run.updated_at = _now()

    async def _handle_interrupt(self, run: Run, interrupts: Any, emit: Any) -> None:
        for intr in interrupts:
            payload = getattr(intr, "value", intr)
            if not isinstance(payload, dict):
                payload = {"action": str(payload)}
            approval = Approval(
                id=str(uuid4()),
                run_id=run.id,
                action=payload.get("action", "unknown"),
                risk_class=payload.get("risk_class", "unknown"),
                target=payload.get("target", "unknown"),
                state_id=payload.get("state_id", "unknown"),
                status=ApprovalStatus.pending,
                created_at=_now(),
            )
            self._approvals[approval.id] = approval
            self._run_approvals.setdefault(run.id, []).append(approval.id)
            await emit(
                type="approval",
                node="prober",
                message=f"Approval required: {approval.action} on {approval.target}",
                data={"approval_id": approval.id, "risk_class": approval.risk_class},
            )
