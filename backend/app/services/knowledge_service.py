"""Serves the learned knowledge with Redis read-through caching.

Reads go through the Redis cache (short TTL) to keep hot knowledge queries cheap;
on a cache miss they fall back to the Knowledge Store. Every payload carries the
PRD's contract fields (provenance / confidence / last_verified) via the schemas.
"""

from __future__ import annotations

from app.cache.redis import RedisManager
from app.core.config import Settings
from app.repositories.base import KnowledgeStore
from app.schemas.knowledge import Capability, Platform, Recipe, UIMap


class KnowledgeService:
    def __init__(self, *, store: KnowledgeStore, redis: RedisManager, settings: Settings) -> None:
        self._store = store
        self._redis = redis
        self._ttl = min(settings.cache_ttl_seconds, 60)  # keep served knowledge fresh

    async def list_platforms(self) -> list[Platform]:
        key = "kb:platforms"
        cached = await self._redis.cache_get(key)
        if cached is not None:
            return [Platform.model_validate(p) for p in cached]
        platforms = await self._store.list_platforms()
        await self._redis.cache_set(
            key, [p.model_dump(mode="json") for p in platforms], ttl=self._ttl
        )
        return platforms

    async def get_platform(self, name: str) -> Platform | None:
        return await self._store.get_platform(name)

    async def list_capabilities(self, platform: str, query: str | None = None) -> list[Capability]:
        # Cache only the unfiltered listing; filtered search hits the store directly.
        if query:
            return await self._store.list_capabilities(platform, query)
        key = f"kb:{platform}:capabilities"
        cached = await self._redis.cache_get(key)
        if cached is not None:
            return [Capability.model_validate(c) for c in cached]
        caps = await self._store.list_capabilities(platform)
        await self._redis.cache_set(key, [c.model_dump(mode="json") for c in caps], ttl=self._ttl)
        return caps

    async def get_recipe(self, platform: str, capability: str) -> Recipe | None:
        return await self._store.get_recipe(platform, capability)

    async def get_ui_map(self, platform: str, region: str | None = None) -> UIMap | None:
        return await self._store.get_ui_map(platform, region)
