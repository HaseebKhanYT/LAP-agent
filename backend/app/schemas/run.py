from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class RunStatus(StrEnum):
    pending = "pending"
    running = "running"
    paused = "paused"
    completed = "completed"
    failed = "failed"


class Coverage(BaseModel):
    states: int = 0
    elements: int = 0
    workflows: int = 0
    verified: int = 0


class RunCreate(BaseModel):
    platform_name: str = Field(..., examples=["acme-crm"])
    base_url: str = Field(..., examples=["https://app.example.com"])
    allowlist: list[str] = Field(default_factory=list)
    max_steps: int | None = None


class Run(BaseModel):
    id: str
    platform_name: str
    base_url: str
    status: RunStatus = RunStatus.pending
    phase: str = "queued"
    coverage: Coverage = Field(default_factory=Coverage)
    created_at: datetime
    updated_at: datetime


class RunEvent(BaseModel):
    run_id: str
    ts: datetime
    type: str  # e.g. "node", "phase", "approval", "error", "done"
    node: str
    message: str
    data: dict[str, Any] | None = None
