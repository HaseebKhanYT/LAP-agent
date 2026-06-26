from __future__ import annotations

from pydantic import BaseModel


class Health(BaseModel):
    status: str = "ok"
    redis: bool
    llm_configured: bool
