"""Aggregates all v1 route modules under one router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import approvals, health, knowledge, runs

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(runs.router)
api_router.include_router(approvals.router)
api_router.include_router(knowledge.router)
