from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from web import dependencies


class StubMCPManager:
    def __init__(self) -> None:
        self.tools = [type("Tool", (), {"name": "stub", "description": "Stub tool"})()]
        self.reloaded = False

    async def startup(self) -> None:
        return None

    async def shutdown(self) -> None:
        return None

    async def list_servers(self):
        return [
            {
                "name": "stub",
                "transport": "stdio",
                "description": "Stub server",
                "enabled": True,
                "has_command": True,
                "has_url": False,
            }
        ]

    async def get_server_status(self):
        return {"loaded_servers": 1, "available_tools": len(self.tools)}

    async def get_tools(self, refresh: bool = False):
        return self.tools

    async def invoke_tool(self, tool_name, arguments):
        return {"tool": tool_name, "arguments": arguments}

    async def reload(self):
        self.reloaded = True


class StubAssistantService:
    async def get_response(self, conversation_id: str, message: str) -> str:
        return f"echo: {message}"


@pytest.fixture
def api_client(monkeypatch):
    from app import app

    stub_manager = StubMCPManager()
    stub_assistant = StubAssistantService()

    dependencies._mcp_manager = stub_manager
    dependencies._assistant_service = stub_assistant

    async def _get_mcp_manager():
        return stub_manager

    async def _get_assistant_service():
        return stub_assistant

    monkeypatch.setattr(dependencies, "get_mcp_manager", _get_mcp_manager)
    monkeypatch.setattr(dependencies, "get_assistant_service", _get_assistant_service)

    with TestClient(app) as client:
        yield client


def test_health_endpoint(api_client):
    response = api_client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["loaded_servers"] == 1


def test_assistant_chat(api_client):
    response = api_client.post(
        "/api/assistant/message",
        json={"message": "hello"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"]["content"].startswith("echo: hello")


def test_list_servers(api_client):
    response = api_client.get("/api/mcp/servers")
    assert response.status_code == 200
    data = response.json()
    assert data["servers"][0]["name"] == "stub"


def test_invoke_tool(api_client):
    response = api_client.post(
        "/api/mcp/tools/invoke",
        json={"tool_name": "stub", "arguments": {"foo": "bar"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["output"]["arguments"]["foo"] == "bar"
