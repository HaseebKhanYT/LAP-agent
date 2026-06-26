"""Application configuration.

All settings are read from environment variables (or a local `.env`). Secrets
default to empty/optional so the service can boot without them — they are only
required when a learning run actually performs LLM inference.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_name: str = "LAP API"
    environment: str = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    # NoDecode: skip pydantic-settings' JSON decoding so the env value reaches the
    # comma-splitting validator below (CORS_ORIGINS=a,b instead of a JSON array).
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # ── Nebius Token Factory (OpenAI-compatible LLM) ─────────────────────────
    # Optional at boot; required for learning runs.
    nebius_api_key: str | None = None
    nebius_base_url: str = "https://api.tokenfactory.nebius.com/v1/"
    nebius_model: str = "meta-llama/Llama-3.3-70B-Instruct"
    nebius_temperature: float = 0.0

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 3600

    # ── Runs ─────────────────────────────────────────────────────────────────
    run_max_steps: int = 200

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, value: object) -> object:
        """Allow CORS_ORIGINS to be a comma-separated string in the environment."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def llm_configured(self) -> bool:
        return bool(self.nebius_api_key)


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton (safe to import anywhere)."""
    return Settings()
