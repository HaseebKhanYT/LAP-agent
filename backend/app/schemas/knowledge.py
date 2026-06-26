from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Parameter(BaseModel):
    name: str
    type: str
    required: bool = False


class Platform(BaseModel):
    name: str
    base_url: str
    last_learned: datetime | None = None
    capability_count: int = 0
    state_count: int = 0
    freshness: str = "unknown"  # fresh | stale | unknown


class Capability(BaseModel):
    id: str
    name: str
    goal: str
    status: str = "verified"  # candidate | verified | quarantined
    confidence: float = 0.0
    parameters: list[Parameter] = Field(default_factory=list)


class RecipeStep(BaseModel):
    index: int
    state: str
    action: str
    element: str
    expected: str


class Recipe(BaseModel):
    capability: str
    platform: str
    parameters: list[Parameter] = Field(default_factory=list)
    steps: list[RecipeStep] = Field(default_factory=list)
    provenance: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    last_verified: datetime | None = None


class UIMapNode(BaseModel):
    id: str
    label: str
    url_pattern: str
    region: str = "default"


class UIMapEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    action: str
    element: str


class UIMap(BaseModel):
    platform: str
    states: list[UIMapNode] = Field(default_factory=list)
    transitions: list[UIMapEdge] = Field(default_factory=list)
