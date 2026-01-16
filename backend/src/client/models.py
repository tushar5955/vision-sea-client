from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Literal, Mapping, Optional

from pydantic import BaseModel, Field, model_validator

TransportType = Literal["stdio", "streamable_http"]

PLACEHOLDER_PATTERN = re.compile(r"\$\{([^}]+)\}")


def _resolve_placeholders(value: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        env_key = match.group(1)
        return os.getenv(env_key, match.group(0))

    return PLACEHOLDER_PATTERN.sub(replacer, value)


class MCPServerConfig(BaseModel):
    """Configuration for a single MCP server connection."""

    name: str
    transport: TransportType = "stdio"
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list)
    url: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    description: Optional[str] = None
    enabled: bool = True
    working_dir: Optional[Path] = None
    filter_non_json_stdout: bool = False

    @model_validator(mode="after")
    def validate_transport_requirements(self) -> "MCPServerConfig":
        if not self.enabled:
            return self

        if self.transport == "stdio" and not self.command:
            raise ValueError(
                f"Server '{self.name}' with stdio transport requires a 'command'."
            )
        if self.transport == "streamable_http" and not self.url:
            raise ValueError(
                f"Server '{self.name}' with streamable_http transport requires a 'url'."
            )
        return self

    def to_client_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {"transport": self.transport}
        if self.transport == "stdio":
            resolved_command = _resolve_placeholders(self.command) if self.command else None
            resolved_args = [_resolve_placeholders(arg) for arg in self.args]

            if resolved_command:
                if self.filter_non_json_stdout:
                    data["command"] = sys.executable
                    bridge_args = [
                        "-m",
                        "client.stdio_bridge",
                        "--filter-non-json",
                        "--",
                        resolved_command,
                    ]
                    bridge_args.extend(resolved_args)
                    data["args"] = bridge_args
                else:
                    data["command"] = resolved_command
                    if resolved_args:
                        data["args"] = resolved_args
            if self.env:
                data["env"] = self.env
            if self.working_dir:
                data["cwd"] = str(self.working_dir)
        else:
            if self.url:
                data["url"] = _resolve_placeholders(self.url)
        return data


class MCPServerRegistry(BaseModel):
    """Collection of MCP server definitions loaded from configuration."""

    servers: Dict[str, MCPServerConfig] = Field(default_factory=dict)

    @classmethod
    def from_mapping(cls, mapping: Mapping[str, Any]) -> "MCPServerRegistry":
        """
        Create an MCPServerRegistry instance from a mapping/dictionary.

        This class method constructs an MCPServerRegistry by parsing a dictionary that contains
        MCP server configurations. It handles two mapping formats:
        1. A nested structure with an "mcpServers" key
        2. A flat structure where the mapping itself contains server configurations

        Args:
            cls: The class itself (MCPServerRegistry). This is automatically passed when calling
                 the class method and represents the class being instantiated.
            mapping (Mapping[str, Any]): A dictionary-like object containing server configurations.
                                          Can either have a top-level "mcpServers" key or be a flat
                                          mapping of server names to their configurations.

        Returns:
            MCPServerRegistry: A new instance of MCPServerRegistry populated with the parsed
                              server configurations.

        Notes:
            - If a server configuration is None/empty, it's converted to an empty dict
            - The server name is automatically set from the key if not present in the payload
            - If "transport" is missing but "url" exists, transport defaults to "streamable_http"
            - Each server configuration is validated using MCPServerConfig.model_validate()
        """
        raw_servers = mapping.get("mcpServers") or mapping
        configs: Dict[str, MCPServerConfig] = {}
        for name, payload in raw_servers.items():
            payload = payload or {}
            payload.setdefault("name", name)
            if "transport" not in payload and payload.get("url"):
                payload["transport"] = "streamable_http"
            config = MCPServerConfig.model_validate(payload)
            configs[name] = config
        return cls(servers=configs)

    @classmethod
    def from_path(cls, path: Path) -> "MCPServerRegistry":
        import json

        with path.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
        return cls.from_mapping(data)

    def enabled_servers(self) -> Iterable[MCPServerConfig]:
        return (config for config in self.servers.values() if config.enabled)

    def disable_server(self, name: str) -> None:
        if name in self.servers:
            self.servers[name].enabled = False

    def to_multi_server_client_config(self) -> Dict[str, Dict[str, Any]]:
        return {
            name: config.to_client_dict()
            for name, config in self.servers.items()
            if config.enabled
        }

    def to_public_payload(self) -> list[Dict[str, Any]]:
        return [
            {
                "name": config.name,
                "transport": config.transport,
                "description": config.description,
                "enabled": config.enabled,
                "has_command": bool(config.command),
                "has_url": bool(config.url),
            }
            for config in self.servers.values()
        ]
 