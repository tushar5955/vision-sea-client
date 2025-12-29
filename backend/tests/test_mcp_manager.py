import asyncio
import json

import pytest

from client.manager import MCPClientManager, MCPToolLoadTimeoutError


@pytest.mark.asyncio
async def test_manager_loads_tools(monkeypatch, tmp_path):
    config_payload = {
        "mcpServers": {
            "math": {
                "command": "python",
                "args": ["math_server.py"],
                "transport": "stdio",
            }
        }
    }
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(config_payload), encoding="utf-8")

    class FakeClient:
        def __init__(self, config):
            self.config = config
            self.tools = [object()]
            self.closed = False

        async def connect(self):
            return None

        async def get_tools(self):
            return self.tools

        async def call_tool(self, name, args):
            return {"name": name, "args": args}

        async def close(self):
            self.closed = True

    fake_client = FakeClient
    monkeypatch.setattr("client.manager.MultiServerMCPClient", fake_client)

    manager = MCPClientManager(config_path)

    tools = await manager.get_tools()
    assert tools == fake_client(config_payload["mcpServers"]).tools

    status = await manager.get_server_status()
    assert status["loaded_servers"] == 1
    assert status["available_tools"] == 1

    await manager.shutdown()


@pytest.mark.asyncio
async def test_manager_coalesces_concurrent_tool_requests(monkeypatch, tmp_path):
    config_payload = {
        "mcpServers": {
            "math": {
                "command": "python",
                "args": ["math_server.py"],
                "transport": "stdio",
            }
        }
    }
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(config_payload), encoding="utf-8")

    call_counter = {"count": 0}

    class SlowClient:
        def __init__(self, config):
            self.config = config
            self.tools = [object()]

        async def connect(self):
            return None

        async def get_tools(self):
            call_counter["count"] += 1
            await asyncio.sleep(0.01)
            return self.tools

        async def call_tool(self, name, args):
            return {"name": name, "args": args}

        async def close(self):
            return None

    monkeypatch.setattr("client.manager.MultiServerMCPClient", SlowClient)

    manager = MCPClientManager(config_path)

    # Launch multiple concurrent requests; all should share a single fetch
    results = await asyncio.gather(
        manager.get_tools(),
        manager.get_tools(),
        manager.get_tools(),
    )

    assert call_counter["count"] == 1
    assert results[0] is results[1] is results[2]

    # Subsequent requests use the cached tools
    cached = await manager.get_tools()
    assert cached is results[0]
    assert call_counter["count"] == 1

    await manager.shutdown()


@pytest.mark.asyncio
async def test_manager_times_out_tool_loading(monkeypatch, tmp_path):
    config_payload = {
        "mcpServers": {
            "math": {
                "command": "python",
                "args": ["math_server.py"],
                "transport": "stdio",
            }
        }
    }
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(config_payload), encoding="utf-8")

    call_counter = {"count": 0}

    class HangingClient:
        def __init__(self, config):
            self.config = config

        async def connect(self):
            return None

        async def get_tools(self):
            call_counter["count"] += 1
            await asyncio.sleep(0.05)
            return [object()]

        async def call_tool(self, name, args):
            return {"name": name, "args": args}

        async def close(self):
            return None

    monkeypatch.setattr("client.manager.MultiServerMCPClient", HangingClient)

    manager = MCPClientManager(config_path, tool_timeout=0.01)

    with pytest.raises(MCPToolLoadTimeoutError):
        await manager.get_tools()

    assert call_counter["count"] == 1

    with pytest.raises(MCPToolLoadTimeoutError):
        await manager.get_tools()

    assert call_counter["count"] == 2

    await manager.shutdown()
