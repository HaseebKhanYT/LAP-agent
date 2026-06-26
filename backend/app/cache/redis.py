"""Redis access: JSON cache + a pub/sub event bus.

This is the *only* module that talks to the Redis wire protocol. It degrades
gracefully: if Redis is unavailable the cache becomes a no-op-ish in-process
dict and pub/sub falls back to in-process asyncio queues, so the API and the
live run stream still work for local development without Redis running.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


class RedisManager:
    def __init__(self, url: str, default_ttl: int = 3600) -> None:
        self._url = url
        self._default_ttl = default_ttl
        self.client: Any | None = None  # redis.asyncio.Redis | None
        self._memory_cache: dict[str, Any] = {}
        self._memory_subs: dict[str, list[asyncio.Queue[str]]] = defaultdict(list)

    # ── lifecycle ────────────────────────────────────────────────────────────
    async def connect(self) -> None:
        try:
            from redis.asyncio import from_url

            client = from_url(self._url, decode_responses=True)
            await client.ping()
            self.client = client
            logger.info("Connected to Redis at %s", self._url)
        except Exception as exc:  # noqa: BLE001 — graceful degradation is intentional
            self.client = None
            logger.warning("Redis unavailable (%s); using in-process fallback", exc)

    async def disconnect(self) -> None:
        if self.client is not None:
            await self.client.aclose()
            self.client = None

    @property
    def available(self) -> bool:
        return self.client is not None

    # ── cache ────────────────────────────────────────────────────────────────
    async def cache_get(self, key: str) -> Any | None:
        if self.client is not None:
            raw = await self.client.get(key)
            return json.loads(raw) if raw else None
        return self._memory_cache.get(key)

    async def cache_set(self, key: str, value: Any, ttl: int | None = None) -> None:
        if self.client is not None:
            await self.client.set(key, json.dumps(value, default=str), ex=ttl or self._default_ttl)
        else:
            self._memory_cache[key] = value

    # ── pub/sub event bus ────────────────────────────────────────────────────
    async def publish(self, channel: str, message: dict[str, Any]) -> None:
        data = json.dumps(message, default=str)
        if self.client is not None:
            await self.client.publish(channel, data)
        else:
            for queue in list(self._memory_subs.get(channel, [])):
                queue.put_nowait(data)

    async def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        """Yield messages published to `channel` until the consumer stops iterating."""
        if self.client is not None:
            pubsub = self.client.pubsub()
            await pubsub.subscribe(channel)
            try:
                async for msg in pubsub.listen():
                    if msg.get("type") == "message":
                        yield json.loads(msg["data"])
            finally:
                await pubsub.unsubscribe(channel)
                await pubsub.aclose()
        else:
            queue: asyncio.Queue[str] = asyncio.Queue()
            self._memory_subs[channel].append(queue)
            try:
                while True:
                    yield json.loads(await queue.get())
            finally:
                self._memory_subs[channel].remove(queue)
