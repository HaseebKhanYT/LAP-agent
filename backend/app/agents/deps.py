"""Dependency bundle injected into agent nodes.

Nodes are built by factory functions that close over a `NodeDeps`, keeping the
node bodies pure functions of `(state)` while still having access to the LLM,
the knowledge store, settings, and the event emitter.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.llm.nebius import NebiusLLM
from app.repositories.base import KnowledgeStore

# emit(*, type, node, message, data=None) -> None
EmitFn = Callable[..., Awaitable[None]]


@dataclass
class NodeDeps:
    llm: NebiusLLM
    store: KnowledgeStore
    settings: Settings
    emit: EmitFn

    async def emit_event(
        self,
        *,
        type: str,
        node: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        await self.emit(type=type, node=node, message=message, data=data)
