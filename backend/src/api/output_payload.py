from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatMessageResponse(BaseModel):
    role: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessageResponse
    history: List[ChatMessageResponse]


class AssistantResponse(BaseModel):
    conversation_id: str
    message: str


class ToolInvokeResponse(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    output: Any


class ChatConversationListResponse(BaseModel):
    conversations: List[str]


class MCPServerInfo(BaseModel):
    name: str
    transport: str
    description: Optional[str] = None
    enabled: bool
    has_command: bool
    has_url: bool


class MCPServersResponse(BaseModel):
    servers: List[MCPServerInfo]


class MCPStatusResponse(BaseModel):
    loaded_servers: int
    available_tools: int
    failed_servers: List[str] = Field(default_factory=list)


class MCPToolInfo(BaseModel):
    name: str
    description: Optional[str] = None


class MCPToolsResponse(BaseModel):
    tools: List[MCPToolInfo]


class ToolHitlStatus(BaseModel):
    tool_name: str
    requires_human: bool


class ToolHitlStatusResponse(BaseModel):
    tools: List[ToolHitlStatus]