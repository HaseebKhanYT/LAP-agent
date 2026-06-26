"""Nebius Token Factory LLM provider.

Nebius Token Factory exposes an OpenAI-compatible API, so we consume it through
`langchain-openai`'s ChatOpenAI by pointing `base_url` at Token Factory. This is
the *only* module aware of the LLM provider — swapping models or providers is a
config change here.

The provider is **lazy**: constructing it is free and requires no key, so the
service boots without secrets. A clear error is raised only when a chat model is
actually requested without `NEBIUS_API_KEY` — that is the intended boundary where
the operator must supply credentials before a learning run can run inference.
"""

from __future__ import annotations

from typing import Any

from app.core.config import Settings


class LLMNotConfiguredError(RuntimeError):
    """Raised when an LLM call is attempted without a configured Nebius API key."""


class NebiusLLM:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return bool(self._settings.nebius_api_key)

    def chat_model(self, **overrides: Any) -> Any:
        """Return a ChatOpenAI bound to Nebius Token Factory.

        Raises:
            LLMNotConfiguredError: if no API key is set.
        """
        if not self._settings.nebius_api_key:
            raise LLMNotConfiguredError(
                "NEBIUS_API_KEY is not set. Set it in the environment to run "
                "LLM inference (see backend/.env.example)."
            )

        # Imported lazily so module import stays cheap and key-free.
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=overrides.get("model", self._settings.nebius_model),
            api_key=self._settings.nebius_api_key,
            base_url=self._settings.nebius_base_url,
            temperature=overrides.get("temperature", self._settings.nebius_temperature),
            timeout=overrides.get("timeout", 60),
            max_retries=overrides.get("max_retries", 2),
        )
