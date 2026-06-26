from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_redis, get_settings_dep
from app.cache.redis import RedisManager
from app.core.config import Settings
from app.schemas.health import Health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Health)
async def health(
    redis: RedisManager = Depends(get_redis),
    settings: Settings = Depends(get_settings_dep),
) -> Health:
    return Health(status="ok", redis=redis.available, llm_configured=settings.llm_configured)
