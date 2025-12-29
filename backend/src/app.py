from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import assistant, chat, mcp
from core.settings import AppSettings, get_settings
from client import MCPClientManager
from web import dependencies
from web.dependencies import get_mcp_manager, get_settings_dependency

@asynccontextmanager
async def lifespan(_: FastAPI):
    await dependencies.startup()
    try:
        yield
    finally:
        await dependencies.shutdown()


app = FastAPI(title="VisionSea MCP Backend", version="1.0.0", lifespan=lifespan)

_middlewares_configured = False
_routes_configured = False


def configure_middlewares(settings: AppSettings) -> None:
    global _middlewares_configured
    if _middlewares_configured:
        return
    allow_origins = settings.allowed_cors_origins or ["*"]
    allow_all = "*" in allow_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else allow_origins,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    _middlewares_configured = True


def configure_routes(settings: AppSettings) -> None:
    global _routes_configured
    if _routes_configured:
        return
    api_prefix = settings.api_prefix
    app.include_router(assistant.router, prefix=api_prefix)
    app.include_router(chat.router, prefix=api_prefix)
    app.include_router(mcp.router, prefix=api_prefix)
    _routes_configured = True


_initial_settings = get_settings()
configure_middlewares(_initial_settings)
configure_routes(_initial_settings)

@app.get("/", tags=["meta"])
async def root(settings: AppSettings = Depends(get_settings_dependency)) -> dict[str, str]:
    return {"app": "VisionSea Backend", "version": "1.0.0", "api_prefix": settings.api_prefix}


@app.get("/health", tags=["meta"])
async def health(
    manager: MCPClientManager = Depends(get_mcp_manager),
) -> dict[str, int | str]:
    status_payload = await manager.get_server_status()
    return {"status": "ok", **status_payload}
