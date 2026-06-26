"""Application lifespan: wire up Redis, the LangGraph checkpointer, the knowledge
store, the LLM provider, and the services — all attached to `app.state`.

Everything degrades gracefully so the app boots with no secrets and (optionally)
no Redis: the checkpointer falls back to in-memory, and the cache/event-bus fall
back to in-process. The only hard requirement for an actual learning *run* is the
Nebius API key.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.cache.redis import RedisManager
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.llm.nebius import NebiusLLM
from app.repositories.memory import InMemoryKnowledgeStore
from app.services.knowledge_service import KnowledgeService
from app.services.run_service import RunService

logger = get_logger(__name__)


async def _build_checkpointer(redis: RedisManager):
    """Redis checkpointer when Redis is up; in-memory otherwise. Never raises."""
    if redis.available:
        try:
            try:
                from langgraph.checkpoint.redis.aio import AsyncRedisSaver
            except ImportError:  # pragma: no cover - import path drift
                from langgraph.checkpoint.redis import AsyncRedisSaver

            from redis.asyncio import Redis as AsyncRedis

            settings = get_settings()
            client = AsyncRedis.from_url(settings.redis_url)
            saver = AsyncRedisSaver(redis_client=client)
            await saver.asetup()
            logger.info("Using Redis checkpointer for durable graph state")
            return saver, client
        except Exception as exc:  # noqa: BLE001 — fall back rather than block boot
            logger.warning("Redis checkpointer unavailable (%s); using in-memory", exc)

    from langgraph.checkpoint.memory import InMemorySaver

    logger.info("Using in-memory checkpointer (runs are not durable across restarts)")
    return InMemorySaver(), None


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("Starting %s (env=%s)", settings.app_name, settings.environment)

    redis = RedisManager(settings.redis_url, settings.cache_ttl_seconds)
    await redis.connect()

    checkpointer, checkpointer_client = await _build_checkpointer(redis)

    store = InMemoryKnowledgeStore()
    llm = NebiusLLM(settings)

    app.state.settings = settings
    app.state.redis = redis
    app.state.store = store
    app.state.llm = llm
    app.state.run_service = RunService(
        settings=settings, redis=redis, store=store, llm=llm, checkpointer=checkpointer
    )
    app.state.knowledge_service = KnowledgeService(store=store, redis=redis, settings=settings)

    if not settings.llm_configured:
        logger.warning("NEBIUS_API_KEY not set — the API is up, but learning runs need it.")

    try:
        yield
    finally:
        logger.info("Shutting down")
        if checkpointer_client is not None:
            await checkpointer_client.aclose()
        await redis.disconnect()
