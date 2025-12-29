from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.output_payload import (
    ChatConversationListResponse,
    ChatMessageResponse,
    ChatResponse,
)
from services.chat_service import ChatService
from web.dependencies import get_chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=ChatConversationListResponse)
async def list_conversations(
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatConversationListResponse:
    conversations = await chat_service.list_conversations()
    return ChatConversationListResponse(conversations=conversations)


@router.get("/{conversation_id}", response_model=ChatResponse)
async def get_conversation(
    conversation_id: str,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    history = await chat_service.get_history(conversation_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found.",
        )

    history_models: List[ChatMessageResponse] = [
        ChatMessageResponse(**item) for item in history
    ]
    return ChatResponse(
        conversation_id=conversation_id,
        message=history_models[-1],
        history=history_models,
    )


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_conversation(
    conversation_id: str,
    chat_service: ChatService = Depends(get_chat_service),
) -> Response:
    await chat_service.clear(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
