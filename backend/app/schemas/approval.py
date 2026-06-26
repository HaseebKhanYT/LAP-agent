from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel


class ApprovalStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    skipped = "skipped"


class Approval(BaseModel):
    id: str
    run_id: str
    action: str
    risk_class: str
    target: str
    state_id: str
    status: ApprovalStatus = ApprovalStatus.pending
    created_at: datetime


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "deny", "skip"]
    note: str | None = None
