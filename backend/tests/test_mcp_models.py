import json
from pathlib import Path

from client.models import MCPServerRegistry


def write_config(tmp_path: Path) -> Path:
    data = {
        "mcpServers": {
            "binance": {
                "command": "python",
                "args": ["--api-key", "${BINANCE_KEY}"],
                "transport": "stdio",
            },
            "weather": {
                "url": "${WEATHER_URL}",
                "transport": "streamable_http",
            },
        }
    }
    config_path = tmp_path / "mcp.json"
    config_path.write_text(json.dumps(data), encoding="utf-8")
    return config_path


def test_placeholder_resolution(monkeypatch, tmp_path):
    monkeypatch.setenv("BINANCE_KEY", "abc123")
    monkeypatch.setenv("WEATHER_URL", "http://localhost:9000/mcp")
    config_path = write_config(tmp_path)

    registry = MCPServerRegistry.from_path(config_path)
    client_config = registry.to_multi_server_client_config()

    binance = client_config["binance"]
    assert binance["command"] == "python"
    assert binance["args"][1] == "abc123"

    weather = client_config["weather"]
    assert weather["url"] == "http://localhost:9000/mcp"
