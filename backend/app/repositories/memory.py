"""In-memory Knowledge Store implementation.

Default backing store for the scaffold. Thread-safety is not a concern (single
async event loop), and it intentionally starts EMPTY — nothing is "known" about a
platform until a learning run verifies and publishes it. That keeps the scaffold
honest about the PRD's grounding guarantee (no fabricated platforms/recipes).

Swap this for a Redis/graph/relational implementation of `KnowledgeStore`
without changing services or agents.
"""

from __future__ import annotations

from app.repositories.base import KnowledgeStore
from app.schemas.knowledge import Capability, Platform, Recipe, UIMap


class InMemoryKnowledgeStore(KnowledgeStore):
    def __init__(self) -> None:
        self._platforms: dict[str, Platform] = {}
        self._capabilities: dict[str, dict[str, Capability]] = {}  # platform -> name -> cap
        self._recipes: dict[tuple[str, str], Recipe] = {}  # (platform, capability) -> recipe
        self._ui_maps: dict[str, UIMap] = {}

    async def list_platforms(self) -> list[Platform]:
        return list(self._platforms.values())

    async def get_platform(self, name: str) -> Platform | None:
        return self._platforms.get(name)

    async def list_capabilities(self, platform: str, query: str | None = None) -> list[Capability]:
        caps = list(self._capabilities.get(platform, {}).values())
        if query:
            q = query.lower()
            caps = [c for c in caps if q in c.name.lower() or q in c.goal.lower()]
        return caps

    async def get_recipe(self, platform: str, capability: str) -> Recipe | None:
        return self._recipes.get((platform, capability))

    async def get_ui_map(self, platform: str, region: str | None = None) -> UIMap | None:
        ui_map = self._ui_maps.get(platform)
        if ui_map is None or region is None:
            return ui_map
        nodes = [n for n in ui_map.states if n.region == region]
        node_ids = {n.id for n in nodes}
        edges = [e for e in ui_map.transitions if e.from_ in node_ids and e.to in node_ids]
        return UIMap(platform=platform, states=nodes, transitions=edges)

    async def upsert_platform(self, platform: Platform) -> None:
        self._platforms[platform.name] = platform
        self._capabilities.setdefault(platform.name, {})

    async def add_capability(self, platform: str, capability: Capability) -> None:
        self._capabilities.setdefault(platform, {})[capability.name] = capability

    async def add_recipe(self, recipe: Recipe) -> None:
        self._recipes[(recipe.platform, recipe.capability)] = recipe

    async def set_ui_map(self, ui_map: UIMap) -> None:
        self._ui_maps[ui_map.platform] = ui_map
