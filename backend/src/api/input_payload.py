from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessagePayload(BaseModel):
    role: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ArtifactRequestPayload(BaseModel):
    enabled: bool = False
    artifact_id: Optional[str] = None
    component_name: Optional[str] = None
    current_code: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: List[ChatMessagePayload] = Field(default_factory=list)
    artifact_request: Optional[ArtifactRequestPayload] = None


class ToolInvokeRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class ServerToggleRequest(BaseModel):
    server_name: str
    enabled: bool


class HitlDecisionAction(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class HitlDecisionEntry(BaseModel):
    action: HitlDecisionAction
    decision: Literal["approve", "reject", "skip", "edit"] = "approve"
    edited_args: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


class HitlDecisionRequest(BaseModel):
    conversation_id: str
    decisions: List[HitlDecisionEntry] = Field(min_length=1)


class ToolHitlUpdateRequest(BaseModel):
    tool_name: str
    requires_human: bool