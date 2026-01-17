from __future__ import annotations

import logging
from typing import Optional, Any

from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from core.settings import AppSettings
from .types import ArtifactGraphState
from .prompts import get_context_prompt, get_artifact_prompt
from .utils import compose_context_payload, stringify_content

log = logging.getLogger(__name__)


class ArtifactGraphBuilder:
    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._context_model: Optional[ChatOpenAI] = None
        self._artifact_model: Optional[ChatOpenAI] = None
        self._context_prompt = get_context_prompt()
        self._artifact_prompt = get_artifact_prompt()

    def build(self) -> Optional[Any]:
        if not self._settings.has_openai_credentials():
            return None

        # Initialize models
        base_temperature = min(0.35, self._settings.default_temperature + 0.15)
        
        self._context_model = ChatOpenAI(
            api_key=self._settings.openai_api_key,
            model=self._settings.openai_model_name,
            temperature=max(0.25, base_temperature - 0.1),
            streaming=False,
        )
        
        self._artifact_model = ChatOpenAI(
            api_key=self._settings.openai_api_key,
            model=self._settings.openai_model_name,
            temperature=base_temperature,
            streaming=True,
        )

        workflow = StateGraph(ArtifactGraphState)
        workflow.add_node("prepare_context", self._prepare_context)
        workflow.add_node("synthesize_context", self._generate_rich_context)
        workflow.add_node("generate_component", self._artifact_prompt | self._artifact_model)
        
        workflow.add_edge("prepare_context", "synthesize_context")
        workflow.add_edge("synthesize_context", "generate_component")
        workflow.add_edge("generate_component", END)
        
        workflow.set_entry_point("prepare_context")
        
        return workflow.compile()

    def _prepare_context(self, state: ArtifactGraphState) -> ArtifactGraphState:
        context_payload = compose_context_payload(
            history_snippet=state.get("history_snippet", ""),
            tool_digest=state.get("tool_digest", ""),
            user_request=state.get("user_request", ""),
            metadata_blob=state.get("metadata_blob", ""),
        )
        return {
            "context_payload": context_payload,
            "existing_code": state.get("existing_code", ""),
            "component_label": state.get("component_label", "HoloWidget"),
        }

    async def _generate_rich_context(self, state: ArtifactGraphState) -> ArtifactGraphState:
        payload = state.get("context_payload", "").strip()
        component_label = state.get("component_label", "HoloWidget")
        fallback = payload or "No additional mission context provided."

        if not self._context_model:
            return {
                "rich_context": fallback,
                "existing_code": state.get("existing_code", ""),
                "component_label": component_label,
            }

        runnable = self._context_prompt | self._context_model
        try:
            response = await runnable.ainvoke(
                {
                    "context_payload": payload or "Mission inputs unavailable.",
                    "component_label": component_label,
                }
            )
            expanded = stringify_content(getattr(response, "content", response)).strip()
        except Exception as exc:  # pragma: no cover - safety
            log.exception("Context synthesis failed", exc_info=exc)
            expanded = fallback

        if len(expanded.split()) < 80 and len(fallback.split()) >= len(expanded.split()):
            expanded = fallback

        return {
            "rich_context": expanded or fallback,
            "existing_code": state.get("existing_code", ""),
            "component_label": component_label,
        }
