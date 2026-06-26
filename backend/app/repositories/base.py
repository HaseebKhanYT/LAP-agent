"""Knowledge Store interface.

This is the persistence seam from the PRD: the published, *grounded* model of a
platform (states, elements, transitions, verified workflows/recipes + provenance).
Services and agents depend only on this interface, so the backing store can be
swapped (in-memory now; a graph/relational DB later) without touching callers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.knowledge import Capability, Platform, Recipe, UIMap


class KnowledgeStore(ABC):
    # ── read side (served via the knowledge API) ──────────────────────────────
    @abstractmethod
    async def list_platforms(self) -> list[Platform]: ...

    @abstractmethod
    async def get_platform(self, name: str) -> Platform | None: ...

    @abstractmethod
    async def list_capabilities(
        self, platform: str, query: str | None = None
    ) -> list[Capability]: ...

    @abstractmethod
    async def get_recipe(self, platform: str, capability: str) -> Recipe | None: ...

    @abstractmethod
    async def get_ui_map(self, platform: str, region: str | None = None) -> UIMap | None: ...

    # ── write side (used by the publisher agent once knowledge is verified) ────
    @abstractmethod
    async def upsert_platform(self, platform: Platform) -> None: ...

    @abstractmethod
    async def add_capability(self, platform: str, capability: Capability) -> None: ...

    @abstractmethod
    async def add_recipe(self, recipe: Recipe) -> None: ...

    @abstractmethod
    async def set_ui_map(self, ui_map: UIMap) -> None: ...
