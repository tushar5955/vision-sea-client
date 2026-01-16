from __future__ import annotations

import json
from typing import AsyncIterator, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from api.input_payload import ChatRequest, HitlDecisionRequest
from api.output_payload import ChatMessageResponse, ChatResponse
from services.assistant_service import AssistantService
from services.chat_service import ChatService
from web.dependencies import get_assistant_service, get_chat_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/message", response_model=ChatResponse)
async def create_assistant_message(
    payload: ChatRequest,
    assistant_service: AssistantService = Depends(get_assistant_service),
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    conversation_id = payload.conversation_id or ChatService.new_conversation_id()

    if payload.history:
        history_dicts = [
            {"role": msg.role, "content": msg.content, "metadata": msg.metadata}
            for msg in payload.history
        ]
        await chat_service.replace_history(conversation_id, history_dicts)

    reply = await assistant_service.get_response(
        conversation_id, payload.message, payload.artifact_request
    )
    history = await chat_service.get_history(conversation_id)

    response_history: List[ChatMessageResponse] = [
        ChatMessageResponse(**item) for item in history
    ]
    assistant_message = response_history[-1]

    return ChatResponse(
        conversation_id=conversation_id,
        message=assistant_message,
        history=response_history,
    )


@router.post("/stream")
async def stream_assistant_message(
    payload: ChatRequest,
    assistant_service: AssistantService = Depends(get_assistant_service),
    chat_service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    conversation_id = payload.conversation_id or ChatService.new_conversation_id()

    if payload.history:
        history_dicts = [
            {"role": msg.role, "content": msg.content, "metadata": msg.metadata}
            for msg in payload.history
        ]
        await chat_service.replace_history(conversation_id, history_dicts)

    async def event_generator() -> AsyncIterator[str]:
        async for event in assistant_service.stream_response(
            conversation_id, payload.message, payload.artifact_request
        ):
            data = json.dumps(event, ensure_ascii=False, default=str)
            yield f"data: {data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post(
    "/interrupts/{interrupt_id}",
    status_code=status.HTTP_202_ACCEPTED,
)
async def resolve_hitl_interrupt(
    interrupt_id: str,
    payload: HitlDecisionRequest,
    assistant_service: AssistantService = Depends(get_assistant_service),
) -> dict[str, str]:
    try:
        decisions = [decision.model_dump() for decision in payload.decisions]
        await assistant_service.submit_hitl_decision(interrupt_id, decisions)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return {"status": "accepted"}
