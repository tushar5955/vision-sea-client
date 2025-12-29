from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.input_payload import ToolHitlUpdateRequest, ToolInvokeRequest
from api.output_payload import (
    MCPServersResponse,
    MCPStatusResponse,
    MCPToolInfo,
    MCPToolsResponse,
    ToolHitlStatusResponse,
    ToolInvokeResponse,
)
from client import MCPClientManager, MCPToolLoadTimeoutError
from services.assistant_service import AssistantService
from web.dependencies import get_assistant_service, get_mcp_manager

router = APIRouter(prefix="/mcp", tags=["mcp"])

log = logging.getLogger(__name__)


@router.get("/servers", response_model=MCPServersResponse)
async def list_servers(
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> MCPServersResponse:
    try:
        servers = await manager.list_servers()
        return MCPServersResponse(servers=servers)
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to list MCP servers", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to list MCP servers: {exc}",
        ) from exc


@router.get("/status", response_model=MCPStatusResponse)
async def get_status(
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> MCPStatusResponse:
    try:
        status_payload = await manager.get_server_status()
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to get MCP status", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to get MCP status: {exc}",
        ) from exc
    return MCPStatusResponse(**status_payload)


@router.post("/reload", status_code=204, response_class=Response)
async def reload_servers(
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> Response:
    try:
        await manager.reload()
        return Response(status_code=204)
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to reload MCP servers", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to reload MCP servers: {exc}",
        ) from exc


@router.get("/tools", response_model=MCPToolsResponse)
async def list_tools(
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> MCPToolsResponse:
    try:
        tools = await manager.get_tools()
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to list MCP tools", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to list MCP tools: {exc}",
        ) from exc
    tool_models: List[MCPToolInfo] = []
    for tool in tools:
        name = getattr(tool, "name", None) or getattr(tool, "tool_name", "unknown")
        description = getattr(tool, "description", None)
        if callable(description):
            description = description()
        tool_models.append(MCPToolInfo(name=name, description=description))
    return MCPToolsResponse(tools=tool_models)


@router.post("/tools/invoke", response_model=ToolInvokeResponse)
async def invoke_tool(
    payload: ToolInvokeRequest,
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> ToolInvokeResponse:
    try:
        output = await manager.invoke_tool(payload.tool_name, payload.arguments)
        return ToolInvokeResponse(
            tool_name=payload.tool_name,
            arguments=payload.arguments,
            output=output,
        )
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to invoke MCP tool", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to invoke tool '{payload.tool_name}': {exc}",
        ) from exc


@router.get("/tools/hitl", response_model=ToolHitlStatusResponse)
async def list_tool_hitl_states(
    assistant_service: AssistantService = Depends(get_assistant_service),
) -> ToolHitlStatusResponse:
    try:
        states = await assistant_service.list_tool_hitl_states()
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to list HITL tool states", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to list HITL tool states: {exc}",
        ) from exc
    return ToolHitlStatusResponse(tools=states)


@router.post(
    "/tools/hitl",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def update_tool_hitl_state(
    payload: ToolHitlUpdateRequest,
    assistant_service: AssistantService = Depends(get_assistant_service),
) -> Response:
    try:
        await assistant_service.set_tool_hitl_state(
            payload.tool_name, payload.requires_human
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except MCPToolLoadTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception("Failed to update HITL tool state", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to update HITL tool state: {exc}",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
