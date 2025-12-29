from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from uuid import uuid4

ChatMessage = Dict[str, Any]


class ChatService:
    """In-memory conversation store used by the API for chat features."""

    def __init__(self) -> None:
        self._history: Dict[str, List[ChatMessage]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def new_conversation_id() -> str:
        return uuid4().hex

    async def append(self, conversation_id: str, message: ChatMessage) -> None:
        async with self._lock:
            self._history.setdefault(conversation_id, []).append(message)

    async def get_history(self, conversation_id: str) -> List[ChatMessage]:
        async with self._lock:
            return list(self._history.get(conversation_id, []))

    async def replace_history(
        self, conversation_id: str, messages: List[ChatMessage]
    ) -> None:
        async with self._lock:
            self._history[conversation_id] = list(messages)

    async def list_conversations(self) -> List[str]:
        async with self._lock:
            return list(self._history.keys())

    async def clear(self, conversation_id: Optional[str] = None) -> None:
        async with self._lock:
            if conversation_id is None:
                self._history.clear()
            else:
                self._history.pop(conversation_id, None)
