from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Any, Dict, List, Optional

from langchain_mcp_adapters.client import MultiServerMCPClient

import anyio

from .models import MCPServerConfig, MCPServerRegistry


class MCPToolLoadTimeoutError(RuntimeError):
    """Raised when MCP tool discovery exceeds the configured timeout."""


class MCPClientManager:
    """Create and manage a shared MCP client connected to multiple servers."""

    def __init__(self, config_path, *, tool_timeout: Optional[float] = None):
        self._config_path = config_path
        self._registry: Optional[MCPServerRegistry] = None
        self._client: Optional[MultiServerMCPClient] = None
        self._tools_cache: Optional[List[Any]] = None
        self._lock = asyncio.Lock()
        self._tools_lock = asyncio.Lock()
        self._tools_task: Optional[asyncio.Task[List[Any]]] = None
        # Enforce a finite timeout to avoid hanging the API if servers stall
        self._tool_timeout = tool_timeout if tool_timeout is not None and tool_timeout > 0 else 10.0
        self._failed_servers: List[str] = []

    @property
    def registry(self) -> MCPServerRegistry:
        if self._registry is None:
            raise RuntimeError("MCP client manager has not been initialized.")
        return self._registry

    async def startup(self) -> None:
        async with self._lock:
            if self._client is not None:
                return

            self._registry = MCPServerRegistry.from_path(self._config_path)
            self._failed_servers = []

            # Create client immediately without probing - let failures happen naturally
            config = self._registry.to_multi_server_client_config()
            self._client = MultiServerMCPClient(config)

            # Tools will be loaded lazily on first use
            self._tools_cache = None

    async def shutdown(self) -> None:
        async with self._lock:
            if self._client is None:
                return

            try:
                close_coro = getattr(self._client, "close", None)
                if close_coro is not None:
                    await close_coro()
            finally:
                self._client = None
                self._failed_servers = []
                async with self._tools_lock:
                    self._tools_cache = None
                    await self._cancel_inflight_tools_task_locked()

    async def reload(self) -> None:
        await self.shutdown()
        await self.startup()

    async def _ensure_client(self) -> MultiServerMCPClient:
        if self._client is None:
            await self.startup()
        assert self._client is not None
        return self._client

    async def list_servers(self) -> List[Dict[str, Any]]:
        await self._ensure_client()
        return self.registry.to_public_payload()

    async def get_tools(self, refresh: bool = False) -> List[Any]:
        log.debug(f"get_tools called with refresh={refresh}")
        # Retry once on transient stdio stream failures (e.g., server process exited,
        # stdout reader channel closed) which frequently surface as ExceptionGroup.
        for attempt in range(2):
            log.debug(f"get_tools: attempt {attempt + 1}/2")
            client = await self._ensure_client()
            log.debug(f"get_tools: client ensured")
            async with self._tools_lock:
                if refresh:
                    log.debug("get_tools: refreshing tools cache")
                    self._tools_cache = None
                    await self._cancel_inflight_tools_task_locked()

                if self._tools_cache is not None and not refresh:
                    log.debug(f"get_tools: returning cached tools ({len(self._tools_cache)} items)")
                    return self._tools_cache

                task = self._tools_task
                if task is None or task.done():
                    log.debug("get_tools: creating new task to fetch tools from client")
                    task = asyncio.create_task(client.get_tools())
                    self._tools_task = task
                else:
                    log.debug("get_tools: reusing existing task")

            try:
                timeout = self._tool_timeout
                log.debug(f"get_tools: waiting for task with timeout={timeout}")
                if timeout is not None:
                    done, _ = await asyncio.wait({task}, timeout=timeout)
                    if not done:
                        log.warning(f"get_tools: task did not complete within {timeout}s, cancelling")
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            log.debug("get_tools: task cancellation completed")
                            pass
                        except (anyio.BrokenResourceError, anyio.EndOfStream) as exc:
                            # Stdio pipes can close while the cancelled task unwinds; treat as transient
                            log.debug(f"get_tools: stdio stream error during cancellation: {type(exc).__name__}")
                            pass
                        except BaseExceptionGroup as exc:
                            log.debug(f"get_tools: exception group during cancellation: {exc}")
                            if not _is_transient_stdio_stream_failure(exc):
                                raise
                        except Exception as exc:
                            # Defensive: ignore any other errors raised while cancelling the task
                            log.debug(f"get_tools: unexpected error during cancellation: {type(exc).__name__}: {exc}")
                            pass
                        finally:
                            async with self._tools_lock:
                                if self._tools_task is task:
                                    self._tools_task = None

                        log.warning("Tool loading timed out after %s seconds", timeout)
                        raise MCPToolLoadTimeoutError(
                            f"Timed out after {timeout:.1f}s while loading MCP tools"
                        )

                log.debug("get_tools: awaiting task result")
                tools = await task
                log.debug(f"get_tools: received {len(tools)} tools from task")
            except MCPToolLoadTimeoutError:
                log.error("get_tools: re-raising MCPToolLoadTimeoutError")
                raise
            except (anyio.BrokenResourceError, anyio.EndOfStream) as exc:
                log.error(f"get_tools: stdio stream error - {type(exc).__name__}: {exc}, attempt={attempt + 1}")
                async with self._tools_lock:
                    if self._tools_task is task:
                        self._tools_task = None
                    cached = self._tools_cache

                log.warning(
                    "MCP tool discovery failed due to closed stdio stream (%s); attempt=%s",
                    type(exc).__name__,
                    attempt + 1,
                )

                if cached is not None:
                    log.debug(f"get_tools: returning cached tools after stdio error ({len(cached)} items)")
                    return cached
                if attempt == 0:
                    log.debug("get_tools: reloading client after stdio error")
                    refresh = True
                    await self.reload()
                    continue
                log.debug("get_tools: returning empty list after stdio error on final attempt")
                return []
            except BaseExceptionGroup as exc:
                log.error(f"get_tools: exception group caught - {exc}, attempt={attempt + 1}")
                if _is_transient_stdio_stream_failure(exc):
                    log.debug("get_tools: exception group is transient stdio stream failure")
                    async with self._tools_lock:
                        if self._tools_task is task:
                            self._tools_task = None
                        cached = self._tools_cache

                    log.warning(
                        "MCP tool discovery failed due to transient stdio stream errors; attempt=%s",
                        attempt + 1,
                    )

                    if cached is not None:
                        log.debug(f"get_tools: returning cached tools after transient error ({len(cached)} items)")
                        return cached
                    if attempt == 0:
                        log.debug("get_tools: reloading client after transient error")
                        refresh = True
                        await self.reload()
                        continue
                    log.debug("get_tools: returning empty list after transient error on final attempt")
                    return []

                log.error("get_tools: exception group is NOT transient, re-raising")
                async with self._tools_lock:
                    if self._tools_task is task:
                        self._tools_task = None
                raise
            except asyncio.CancelledError as exc:
                log.error(f"get_tools: task was cancelled, attempt={attempt + 1}")
                async with self._tools_lock:
                    if self._tools_task is task:
                        self._tools_task = None
                    cached = self._tools_cache

                log.warning(
                    "MCP tool discovery was cancelled; attempt=%s",
                    attempt + 1,
                )

                if cached is not None:
                    log.debug(f"get_tools: returning cached tools after cancellation ({len(cached)} items)")
                    return cached
                if attempt == 0:
                    log.debug("get_tools: reloading client after cancellation")
                    refresh = True
                    await self.reload()
                    continue

                timeout = self._tool_timeout
                message = (
                    f"Tool discovery cancelled after {timeout:.1f}s"
                    if timeout is not None
                    else "Tool discovery cancelled"
                )
                raise MCPToolLoadTimeoutError(message) from exc
            except Exception as exc:
                log.error(f"get_tools: unexpected exception - {type(exc).__name__}: {exc}, attempt={attempt + 1}", exc_info=True)
                async with self._tools_lock:
                    if self._tools_task is task:
                        self._tools_task = None
                raise

            log.debug("get_tools: caching tools and returning")
            async with self._tools_lock:
                self._tools_cache = tools
                if self._tools_task is task:
                    self._tools_task = None
                return self._tools_cache

        log.debug("get_tools: all attempts exhausted, returning empty list")
        return []

    async def invoke_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        client = await self._ensure_client()
        return await client.call_tool(tool_name, arguments)

    async def get_server_status(self) -> Dict[str, Any]:
        await self._ensure_client()
        return {
            "loaded_servers": len(list(self.registry.enabled_servers())),
            "available_tools": len(await self.get_tools()),
            "failed_servers": self._failed_servers,
        }

    async def _cancel_inflight_tools_task_locked(self) -> None:
        task = self._tools_task
        if task is None:
            return

        self._tools_task = None
        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            return
        except (anyio.BrokenResourceError, anyio.EndOfStream):
            return
        except BaseExceptionGroup as exc:
            if _is_transient_stdio_stream_failure(exc):
                return
            raise
        except Exception:
            # Ignore any errors from the cancelled task; underlying streams may already be closed
            return


log = logging.getLogger(__name__)


def _flatten_exception_group(exc: BaseException) -> list[BaseException]:
    if isinstance(exc, BaseExceptionGroup):
        items: list[BaseException] = []
        for nested in exc.exceptions:
            items.extend(_flatten_exception_group(nested))
        return items
    return [exc]


def _is_transient_stdio_stream_failure(exc: BaseException) -> bool:
    leaf_excs = _flatten_exception_group(exc)
    transient_types = (anyio.BrokenResourceError, anyio.EndOfStream, asyncio.CancelledError)
    return bool(leaf_excs) and all(isinstance(item, transient_types) for item in leaf_excs)
