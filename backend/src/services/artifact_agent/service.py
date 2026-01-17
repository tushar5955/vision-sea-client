from __future__ import annotations

import logging
from datetime import datetime
from typing import AsyncIterator, List, Optional

from core.settings import AppSettings
from .types import ArtifactEvent, ArtifactGraphState, ArtifactJobSpec
from .utils import (
    summarize_history,
    summarize_tools,
    summarize_metadata,
    translate_event,
    error_event,
    strip_code_fences,
    ensure_container_fit
)
from .graph import ArtifactGraphBuilder

log = logging.getLogger(__name__)


class ArtifactService:
    """Orchestrate LangGraph-powered generation of React component artifacts."""

    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._graph = None

    async def stream_artifact(self, spec: ArtifactJobSpec) -> AsyncIterator[ArtifactEvent]:
        if not self._settings.has_openai_credentials():
            yield error_event(spec.artifact_id, "LLM credentials missing for artifact generation.")
            return

        graph = self._ensure_graph()
        if graph is None:
            yield error_event(spec.artifact_id, "Artifact graph is unavailable.")
            return

        initial_state: ArtifactGraphState = {
            "history_snippet": summarize_history(spec.history),
            "tool_digest": summarize_tools(spec.tool_events),
            "user_request": spec.last_user_message,
            "metadata_blob": summarize_metadata(spec.metadata),
            "existing_code": spec.current_code or "",
            "component_label": spec.component_name or "HoloWidget",
        }

        yield {
            "type": "artifact_started",
            "artifact_id": spec.artifact_id,
            "metadata": {
                "component_name": spec.component_name or "HoloWidget",
                "conversation_id": spec.conversation_id,
            },
        }

        code_stream: List[str] = []
        final_message: Optional[str] = None
        # Use timestamp for unique thread ID to avoid rate limit issues with long contexts
        thread_id = f"artifact-{spec.artifact_id}-{datetime.now().timestamp()}"
        config = {"configurable": {"thread_id": thread_id}}

        try:
            async for raw_event in graph.astream_events(
                initial_state,
                config=config,
                stream_mode="values",
            ):
                translated = translate_event(raw_event, spec.artifact_id)
                for event in translated:
                    if event["type"] == "artifact_delta":
                        code_stream.append(event.get("chunk", ""))
                    elif event["type"] == "artifact_message":
                        final_message = event.get("content") or final_message
                    yield event
        except Exception as exc:  # pragma: no cover - defensive
            log.exception("Artifact LangGraph run failed", exc_info=exc)
            yield error_event(spec.artifact_id, "Artifact generation failed. Please retry.")
            return

        merged_code = strip_code_fences(final_message or "".join(code_stream)).strip()
        if not merged_code:
            merged_code = spec.current_code or ""
        
        # Ensure generated component fits container
        merged_code = ensure_container_fit(merged_code)

        metadata = dict(spec.metadata)
        metadata.setdefault("component_name", spec.component_name or "HoloWidget")
        metadata.setdefault("tool_digest", initial_state["tool_digest"])
        metadata.setdefault("history_excerpt", initial_state["history_snippet"])

        yield {
            "type": "artifact_ready",
            "artifact_id": spec.artifact_id,
            "code": merged_code,
            "metadata": metadata,
        }

    def _ensure_graph(self):
        if self._graph is not None:
            return self._graph
            
        builder = ArtifactGraphBuilder(self._settings)
        self._graph = builder.build()
        return self._graph
