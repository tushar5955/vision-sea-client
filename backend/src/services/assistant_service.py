from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional, Sequence, Tuple
from uuid import uuid4

from fastapi.encoders import jsonable_encoder
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from core.settings import AppSettings
from api.input_payload import ArtifactRequestPayload
from client import MCPClientManager
from services.chat_service import ChatService
from services.artifact_service import ArtifactJobSpec, ArtifactService

log = logging.getLogger(__name__)

StreamEvent = Dict[str, Any]


class AssistantService:
    """Coordinate conversations that leverage MCP tools via an LLM-backed agent."""

    def __init__(
        self,
        settings: AppSettings,
        mcp_manager: MCPClientManager,
        chat_service: ChatService,
        artifact_service: ArtifactService,
    ) -> None:
        self._settings = settings
        self._mcp_manager = mcp_manager
        self._chat_service = chat_service
        self._artifact_service = artifact_service
        self._agent = None
        self._agent_lock = asyncio.Lock()
        self._checkpointer = InMemorySaver()
        self._tool_hitl_overrides: Dict[str, bool] = {}
        self._pending_interrupts: Dict[str, asyncio.Future[Dict[str, Any]]] = {}
        self._pending_interrupt_actions: Dict[str, List[Dict[str, Any]]] = {}

    async def get_response(
        self,
        conversation_id: str,
        message: str,
        artifact_request: Optional[ArtifactRequestPayload] = None,
    ) -> str:
        messages = await self._prepare_messages(conversation_id, message)

        agent = await self._ensure_agent()
        if agent is None:
            log.debug("LLM credentials missing; returning fallback response")
            tools = await self._mcp_manager.get_tools()
            tool_names = [self._tool_name(tool) for tool in tools]
            reply = self._build_fallback_reply(message, tool_names)
        else:
            reply = await self._collect_agent_reply(agent, conversation_id, messages)

        await self._chat_service.append(
            conversation_id,
            {"role": "assistant", "content": reply},
        )
        return reply

    async def stream_response(
        self,
        conversation_id: str,
        message: str,
        artifact_request: Optional[ArtifactRequestPayload] = None,
    ) -> AsyncIterator[StreamEvent]:
        messages = await self._prepare_messages(conversation_id, message)
        history_snapshot: List[Dict[str, Any]] = []
        tool_history: List[StreamEvent] = []

        agent = await self._ensure_agent()
        if agent is None:
            tools = await self._mcp_manager.get_tools()
            tool_names = [self._tool_name(tool) for tool in tools]
            fallback = self._build_fallback_reply(message, tool_names)
            await self._chat_service.append(
                conversation_id, {"role": "assistant", "content": fallback}
            )
            yield self._event("conversation_started", conversation_id)
            yield self._event(
                "final_message", conversation_id, {"content": fallback}
            )
            yield self._event("done", conversation_id)
            return

        payload = {"messages": messages}
        tokens: List[str] = []
        final_text: Optional[str] = None

        yield self._event("conversation_started", conversation_id)

        try:
            async for event in self._agent_stream(
                agent,
                payload,
                conversation_id,
                interactive=True,
            ):
                if event["type"] == "assistant_message":
                    final_text = event.get("content") or final_text
                elif event["type"] == "token":
                    tokens.append(event.get("text", ""))
                if event["type"] in {"tool_call_start", "tool_call_end"}:
                    tool_history.append(event)
                yield event
        except Exception as exc:  # pragma: no cover - defensive logging
            log.exception("Streaming run failed", exc_info=exc)
            error_message = "I ran into an issue while processing your request."
            yield self._event("error", conversation_id, {"message": error_message})
            final_text = final_text or "".join(tokens) or error_message
        finally:
            final_text = final_text or "".join(tokens) or "I'm not sure how to respond to that yet."
            await self._chat_service.append(
                conversation_id, {"role": "assistant", "content": final_text}
            )
            history_snapshot = await self._chat_service.get_history(conversation_id)
            yield self._event(
                "final_message", conversation_id, {"content": final_text}
            )
            if artifact_request and artifact_request.enabled:
                async for artifact_event in self._stream_artifact(
                    conversation_id,
                    artifact_request,
                    history_snapshot,
                    tool_history,
                ):
                    yield artifact_event
            yield self._event("done", conversation_id)

    async def submit_hitl_decision(
        self, interrupt_id: str, decisions: Sequence[Dict[str, Any]]
    ) -> None:
        waiter = self._pending_interrupts.get(interrupt_id)
        if waiter is None:
            raise ValueError(f"Interrupt '{interrupt_id}' is not awaiting input")

        command, summary_items = self._build_command_from_decisions(
            interrupt_id, decisions
        )
        summary = {"interrupt_id": interrupt_id, "decisions": summary_items}

        if not waiter.done():
            waiter.set_result({"command": command, "summary": summary})

    async def list_tool_hitl_states(self) -> List[Dict[str, Any]]:
        tools = await self._mcp_manager.get_tools()
        items: List[Dict[str, Any]] = []
        for tool in tools:
            name = self._tool_name(tool)
            items.append(
                {
                    "tool_name": name,
                    "requires_human": bool(self._tool_hitl_overrides.get(name, False)),
                }
            )
        items.sort(key=lambda item: item["tool_name"])
        return items

    async def set_tool_hitl_state(self, tool_name: str, requires_human: bool) -> None:
        tools = await self._mcp_manager.get_tools()
        tool_names = {self._tool_name(tool) for tool in tools}
        if tool_name not in tool_names:
            raise ValueError(f"Unknown tool '{tool_name}'")

        if requires_human:
            if not self._tool_hitl_overrides.get(tool_name):
                self._tool_hitl_overrides[tool_name] = True
                self._agent = None
        else:
            if self._tool_hitl_overrides.pop(tool_name, None) is not None:
                self._agent = None

    async def _prepare_messages(
        self, conversation_id: str, message: str
    ) -> List[Any]:
        await self._chat_service.append(
            conversation_id,
            {"role": "user", "content": message},
        )
        history = await self._chat_service.get_history(conversation_id)
        return self._convert_history_to_messages(history)

    async def _collect_agent_reply(
        self, agent: Any, conversation_id: str, messages: List[Any]
    ) -> str:
        payload = {"messages": messages}
        tokens: List[str] = []
        final_text: Optional[str] = None

        async for event in self._agent_stream(
            agent,
            payload,
            conversation_id,
            interactive=False,
        ):
            if event["type"] == "assistant_message":
                final_text = event.get("content") or final_text
            elif event["type"] == "token":
                tokens.append(event.get("text", ""))

        return final_text or "".join(tokens) or "I'm not sure how to respond to that yet."

    async def _agent_stream(
        self,
        agent: Any,
        payload: Dict[str, Any],
        conversation_id: str,
        *,
        interactive: bool,
    ) -> AsyncIterator[StreamEvent]:
        config = {"configurable": {"thread_id": conversation_id}}
        next_payload: Optional[Any] = payload
        printed_message_ids: set[str] = set()
        tool_runs: Dict[str, Dict[str, Any]] = {}

        while next_payload is not None:
            async for raw_event in agent.astream_events(  # type: ignore[attr-defined]
                next_payload,
                config=config,
                stream_mode="values",
            ):
                events = self._translate_event(
                    raw_event, conversation_id, printed_message_ids, tool_runs
                )
                for event in events:
                    yield event

                interrupt_payload = self._extract_interrupt(raw_event)
                if interrupt_payload:
                    if interactive:
                        events, resume_payload = await self._handle_interrupt(
                            interrupt_payload,
                            conversation_id,
                        )
                        for event in events:
                            yield event
                    else:
                        resume_payload = self._auto_resume_command(interrupt_payload)
                    next_payload = resume_payload
                    break
            else:
                next_payload = None

    async def _stream_artifact(
        self,
        conversation_id: str,
        artifact_request: ArtifactRequestPayload,
        history: List[Dict[str, Any]],
        tool_history: List[StreamEvent],
    ) -> AsyncIterator[StreamEvent]:
        if not artifact_request.enabled:
            return
        if self._artifact_service is None:
            yield self._event(
                "artifact_error",
                conversation_id,
                {"message": "Artifact service unavailable."},
            )
            return

        last_user_message = self._extract_last_user(history)
        if not last_user_message:
            return

        metadata = artifact_request.metadata or {}
        spec = ArtifactJobSpec(
            artifact_id=artifact_request.artifact_id or uuid4().hex,
            conversation_id=conversation_id,
            history=history,
            tool_events=tool_history,
            last_user_message=last_user_message,
            current_code=artifact_request.current_code,
            component_name=artifact_request.component_name,
            metadata=metadata,
        )

        async for artifact_event in self._artifact_service.stream_artifact(spec):
            event_type = artifact_event.get("type", "artifact_message")
            extras = {k: v for k, v in artifact_event.items() if k != "type"}
            yield self._event(event_type, conversation_id, extras)

    async def _ensure_agent(self):  # pragma: no cover - integration path
        if not self._settings.has_openai_credentials():
            return None

        async with self._agent_lock:
            if self._agent is not None:
                return self._agent

            tools = await self._mcp_manager.get_tools()
            llm = ChatOpenAI(
                api_key=self._settings.openai_api_key,
                model=self._settings.openai_model_name,
                temperature=self._settings.default_temperature,
            )

            tool_map = self._build_interrupt_map(tools)
            middleware = [HumanInTheLoopMiddleware(interrupt_on=tool_map)]

            self._agent = create_agent(
                model=llm,
                tools=tools,
                middleware=middleware,
                checkpointer=self._checkpointer,
            )
            return self._agent

    def _build_interrupt_map(self, tools: Sequence[Any]) -> Dict[str, bool]:
        if not self._tool_hitl_overrides:
            return {}
        return {
            self._tool_name(tool): bool(
                self._tool_hitl_overrides.get(self._tool_name(tool), False)
            )
            for tool in tools
        }

    def _translate_event(
        self,
        raw_event: Dict[str, Any],
        conversation_id: str,
        printed_message_ids: set[str],
        tool_runs: Dict[str, Dict[str, Any]],
    ) -> List[StreamEvent]:
        events: List[StreamEvent] = []
        messages = raw_event.get("messages") or []
        for message in messages:
            mid = getattr(message, "id", None) or f"msg-{id(message)}"
            if mid in printed_message_ids:
                continue
            printed_message_ids.add(mid)

            if isinstance(message, AIMessage):
                text = self._stringify_content(message.content)
                events.append(
                    self._event(
                        "assistant_message",
                        conversation_id,
                        {"content": text},
                    )
                )
            elif isinstance(message, ToolMessage):
                events.append(
                    self._event(
                        "tool_message",
                        conversation_id,
                        {
                            "tool_name": getattr(message, "name", "tool"),
                            "content": self._safe_json(message.content),
                        },
                    )
                )

        event_type = raw_event.get("event")
        data = raw_event.get("data") or {}
        name = raw_event.get("name") or data.get("name") or "tool"
        run_id = raw_event.get("run_id") or data.get("run_id")

        if event_type in {"on_tool_start", "tool_start"}:
            args = data.get("input") or data.get("tool_input") or {}
            call_id = run_id or f"tool-{len(tool_runs) + 1}"
            tool_runs[call_id] = {"name": name, "args": self._safe_json(args)}
            events.append(
                self._event(
                    "tool_call_start",
                    conversation_id,
                    {
                        "tool_name": name,
                        "tool_call_id": call_id,
                        "args": tool_runs[call_id]["args"],
                    },
                )
            )
        elif event_type in {"on_tool_end", "tool_end"}:
            call_id = run_id or raw_event.get("parent_run_id")
            info = tool_runs.get(call_id or "", {"name": name})
            output = data.get("output") or data.get("result")
            events.append(
                self._event(
                    "tool_call_end",
                    conversation_id,
                    {
                        "tool_name": info.get("name", name),
                        "tool_call_id": call_id or info.get("name", name),
                        "output": self._safe_json(output),
                        "status": "success",
                    },
                )
            )
        elif event_type in {"on_chat_model_stream", "llm_stream"}:
            chunk = data.get("chunk")
            text = self._chunk_to_text(chunk)
            if text:
                events.append(
                    self._event(
                        "token",
                        conversation_id,
                        {"text": text},
                    )
                )
        elif event_type in {"on_chain_error", "chain_error"}:
            message = str(data.get("error") or name)
            events.append(
                self._event("error", conversation_id, {"message": message})
            )
        elif event_type in {"on_chain_end", "chain_end"}:
            output = data.get("output") or {}
            final_text = None
            if isinstance(output, str):
                final_text = output
            elif isinstance(output, dict) and isinstance(output.get("output"), str):
                final_text = output["output"]
            if final_text:
                events.append(
                    self._event(
                        "assistant_message",
                        conversation_id,
                        {"content": final_text},
                    )
                )

        return events

    async def _handle_interrupt(
        self, payload: Dict[str, Any], conversation_id: str
    ) -> Tuple[List[StreamEvent], Optional[Any]]:
        interrupt_id = payload.get("id") or f"interrupt-{len(self._pending_interrupts) + 1}"
        action_requests = self._normalize_action_requests(payload)

        request_event = self._event(
            "hitl_request",
            conversation_id,
            {
                "interrupt_id": interrupt_id,
                "action_requests": action_requests,
            },
        )

        waiter: asyncio.Future[Dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending_interrupts[interrupt_id] = waiter
        self._pending_interrupt_actions[interrupt_id] = action_requests

        resume_payload: Optional[Any] = None
        resolution_event: Optional[StreamEvent] = None

        try:
            result = await waiter
            resume_payload = result.get("command")
            summary = result.get("summary")
            if summary:
                resolution_event = self._event(
                    "hitl_resolution", conversation_id, summary
                )
        finally:
            self._pending_interrupts.pop(interrupt_id, None)
            self._pending_interrupt_actions.pop(interrupt_id, None)

        events: List[StreamEvent] = [request_event]
        if resolution_event:
            events.append(resolution_event)

        return events, resume_payload

    def _auto_resume_command(self, payload: Dict[str, Any]) -> Command:
        interrupt_id = payload.get("id") or "auto-interrupt"
        action_requests = self._normalize_action_requests(payload)
        decisions = [
            {"type": "approve"}
            for _ in action_requests
        ] or [{"type": "approve"}]
        return Command(resume={interrupt_id: {"decisions": decisions}})

    def _normalize_action_requests(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        action_requests = payload.get("action_requests") or []
        normalized: List[Dict[str, Any]] = []
        for idx, request in enumerate(action_requests):
            if not isinstance(request, dict):
                continue
            action_name = request.get("name") or request.get("tool_name") or "tool"
            args = jsonable_encoder(request.get("args") or request.get("parameters") or {})
            call_id = request.get("tool_call_id") or request.get("id") or f"hitl-action-{idx}"
            normalized.append(
                {
                    "name": action_name,
                    "args": args,
                    "tool_call_id": call_id,
                }
            )
        return normalized

    def _build_command_from_decisions(
        self, interrupt_id: str, decisions: Sequence[Dict[str, Any]]
    ) -> Tuple[Command, List[Dict[str, Any]]]:
        converted: List[Dict[str, Any]] = []
        summaries: List[Dict[str, Any]] = []
        fallback_actions = self._pending_interrupt_actions.get(interrupt_id, [])

        for idx, entry in enumerate(decisions):
            action = entry.get("action")
            if not isinstance(action, dict):
                if idx < len(fallback_actions):
                    action = fallback_actions[idx]
                elif fallback_actions:
                    action = fallback_actions[0]
                else:
                    action = {"name": "tool", "args": {}}
            decision_type = entry.get("decision", "approve")
            payload: Dict[str, Any] = {"type": decision_type}
            if decision_type == "edit":
                edited_args = entry.get("edited_args") or action.get("args") or {}
                payload["edited_action"] = {
                    "name": action.get("name", "tool"),
                    "args": edited_args,
                }
            if decision_type in {"reject", "skip"}:
                payload["reason"] = entry.get("reason") or "Action halted by user"
            converted.append(payload)
            summaries.append(
                {
                    "tool_name": action.get("name", "tool"),
                    "decision": decision_type,
                    "reason": entry.get("reason"),
                }
            )

        if not converted:
            converted.append({"type": "approve"})
            summaries.append({"tool_name": "tool", "decision": "approve", "reason": None})

        return Command(resume={interrupt_id: {"decisions": converted}}), summaries

    def _extract_interrupt(self, raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        token = raw_event.get("interrupt")
        if not token:
            placeholder = raw_event.get("__interrupt__")
            if isinstance(placeholder, list) and placeholder:
                token = placeholder[0]
            elif placeholder:
                token = placeholder
        if not token:
            return None

        interrupt_id = getattr(token, "id", None) or getattr(token, "interrupt_id", None)
        value = getattr(token, "value", None) or token
        if isinstance(value, dict):
            payload = dict(value)
        else:
            payload = {"action_requests": []}
        if interrupt_id:
            payload["id"] = interrupt_id
        return payload

    def _event(
        self, event_type: str, conversation_id: str, extra: Optional[Dict[str, Any]] = None
    ) -> StreamEvent:
        payload = {
            "type": event_type,
            "conversation_id": conversation_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if extra:
            encoded = self._safe_json(extra)
            if isinstance(encoded, dict):
                payload.update(encoded)
            else:
                payload["data"] = encoded
        return payload

    def _safe_json(self, value: Any) -> Any:
        try:
            return jsonable_encoder(value)
        except Exception as exc:  # pragma: no cover - defensive
            log.debug("Failed to JSON-encode value; falling back to string", exc_info=exc)
            try:
                return str(value)
            except Exception:  # noqa: BLE001 - best-effort stringification
                return "<non-serializable>"

    def _stringify_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(self._stringify_content(part) for part in content)
        if isinstance(content, dict):
            return str(jsonable_encoder(content))
        return str(content)

    def _chunk_to_text(self, chunk: Any) -> str:
        if chunk is None:
            return ""
        text = getattr(chunk, "content", None)
        if isinstance(text, list):
            return "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in text
            )
        if isinstance(text, str):
            return text
        return str(chunk)

    def _tool_name(self, tool: Any) -> str:
        return getattr(tool, "name", None) or getattr(tool, "tool_name", "unknown_tool")

    @staticmethod
    def _convert_history_to_messages(history: List[Dict[str, Any]]) -> List[Any]:
        converted: List[Any] = []
        for item in history:
            role = item.get("role")
            content = item.get("content", "")
            if role == "assistant":
                converted.append(AIMessage(content=content))
            elif role == "system":
                converted.append(SystemMessage(content=content))
            elif role == "user":
                converted.append(HumanMessage(content=content))
        return converted

    @staticmethod
    def _extract_last_user(history: List[Dict[str, Any]]) -> str:
        for item in reversed(history):
            if item.get("role") == "user":
                return str(item.get("content", "")).strip()
        return ""

    @staticmethod
    def _build_fallback_reply(message: str, tools: List[str]) -> str:
        tool_list = ", ".join(tools) if tools else "no configured tools"
        return (
            "LLM credentials are not configured. "
            "Here's what I can tell you: "
            f"you said '{message}'. Available tools: {tool_list}."
        )
