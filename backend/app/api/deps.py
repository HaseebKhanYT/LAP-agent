"""FastAPI dependency providers — pull singletons off `app.state`."""

from __future__ import annotations

from fastapi import Request

from app.cache.redis import RedisManager
from app.core.config import Settings
from app.services.knowledge_service import KnowledgeService
from app.services.run_service import RunService


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_redis(request: Request) -> RedisManager:
    return request.app.state.redis


def get_run_service(request: Request) -> RunService:
    return request.app.state.run_service


def get_knowledge_service(request: Request) -> KnowledgeService:
    return request.app.state.knowledge_service
