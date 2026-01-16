from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import os
import tomllib
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Application-level configuration loaded from environment and config files."""

    api_prefix: str = "/api"
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model_name: str = Field(default="gpt-4o-mini")
    default_temperature: float = 0.1
    mcp_config_path: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "client" / "mcp-servers.json"
    )
    mcp_tool_timeout_seconds: Optional[float] = Field(default=60.0, ge=0.0)
    allowed_cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )

    # LangSmith tracing (honors env vars first; config.toml as fallback)
    langsmith_endpoint: Optional[str] = Field(default=None, alias="LANGCHAIN_ENDPOINT")
    langsmith_api_key: Optional[str] = Field(default=None, alias="LANGSMITH_API_KEY")
    langsmith_project: Optional[str] = Field(default=None, alias="LANGCHAIN_PROJECT")
    langsmith_tracing_v2: bool = Field(default=False, alias="LANGCHAIN_TRACING_V2")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="VISIONSEA_",
        env_nested_delimiter="__",
        extra="ignore",
    )

    def has_openai_credentials(self) -> bool:
        return bool(self.openai_api_key and self.openai_model_name)

    def apply_langsmith_env(self) -> None:
        """Populate process env vars so LangSmith tracing is activated for agents."""

        env_updates = {}

        if self.langsmith_api_key:
            env_updates["LANGSMITH_API_KEY"] = self.langsmith_api_key
        if self.langsmith_endpoint:
            env_updates["LANGCHAIN_ENDPOINT"] = self.langsmith_endpoint
        if self.langsmith_project:
            env_updates["LANGCHAIN_PROJECT"] = self.langsmith_project

        # Enable tracing if explicitly requested or if we have any LangSmith config
        should_trace = bool(self.langsmith_tracing_v2 or env_updates)
        if should_trace:
            env_updates["LANGCHAIN_TRACING_V2"] = "true"

        # Do not override existing env vars; only backfill
        for key, value in env_updates.items():
            os.environ.setdefault(key, str(value))

    @classmethod
    def load(cls) -> "AppSettings":
        base_settings = cls()
        if base_settings.has_openai_credentials():
            base_settings.apply_langsmith_env()
            return base_settings

        config_path = Path(__file__).resolve().parent.parent / "configuration" / "config.toml"
        if not config_path.exists():
            return base_settings

        with config_path.open("rb") as fp:  # pragma: no cover - simple file IO
            data: Dict[str, Any] = tomllib.load(fp)

        openai_section = data.get("openai", {})
        langsmith_section = data.get("langsmith", {})
        cors_section = data.get("cors", {})

        allowed_origins = _ensure_str_list(
            cors_section.get("allowed_origins", base_settings.allowed_cors_origins)
        )
        if not allowed_origins:
            allowed_origins = base_settings.allowed_cors_origins

        updated = base_settings.model_copy(
            update={
                "openai_api_key": openai_section.get("api_key", base_settings.openai_api_key),
                "openai_model_name": openai_section.get(
                    "model_name", base_settings.openai_model_name
                ),
                "langsmith_endpoint": langsmith_section.get(
                    "endpoint", base_settings.langsmith_endpoint
                ),
                "langsmith_api_key": langsmith_section.get(
                    "api_key", base_settings.langsmith_api_key
                ),
                "langsmith_project": langsmith_section.get(
                    "project", base_settings.langsmith_project
                ),
                "langsmith_tracing_v2": _parse_bool(
                    langsmith_section.get("tracing", base_settings.langsmith_tracing_v2)
                ),
                "allowed_cors_origins": allowed_origins,
            }
        )

        updated.apply_langsmith_env()
        return updated


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _ensure_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        candidates = [part.strip() for part in value.split(",")]
    elif isinstance(value, (list, tuple, set)):
        candidates = [str(item).strip() for item in value]
    else:
        return []

    return [item for item in candidates if item]


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Return a cached instance of the application settings."""

    return AppSettings.load()
