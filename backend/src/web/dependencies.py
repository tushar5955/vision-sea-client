from __future__ import annotations

import asyncio
from typing import Optional

from core.settings import AppSettings, get_settings
from client import MCPClientManager
from services.assistant_service import AssistantService
from services.chat_service import ChatService

_settings: AppSettings = get_settings()
_mcp_manager = MCPClientManager(
    _settings.mcp_config_path,
    tool_timeout=_settings.mcp_tool_timeout_seconds,
)
_chat_service = ChatService()
_assistant_service: Optional[AssistantService] = None
_assistant_lock = asyncio.Lock()


async def startup() -> None:
    await _mcp_manager.startup()


async def shutdown() -> None:
    await _mcp_manager.shutdown()


async def get_settings_dependency() -> AppSettings:
    return _settings


async def get_mcp_manager() -> MCPClientManager:
    return _mcp_manager


async def get_chat_service() -> ChatService:
    return _chat_service


async def get_assistant_service() -> AssistantService:
    global _assistant_service
    if _assistant_service is not None:
        return _assistant_service

    async with _assistant_lock:
        if _assistant_service is None:
            _assistant_service = AssistantService(_settings, _mcp_manager, _chat_service)
    return _assistant_service
