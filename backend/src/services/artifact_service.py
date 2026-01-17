from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional, TypedDict

from langchain_core.messages import AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from core.settings import AppSettings

log = logging.getLogger(__name__)

ArtifactEvent = Dict[str, Any]


class ArtifactGraphState(TypedDict, total=False):
    history_snippet: str
    tool_digest: str
    user_request: str
    metadata_blob: str
    existing_code: str
    component_label: str
    artifact_brief: str


@dataclass
class ArtifactJobSpec:
    artifact_id: str
    conversation_id: str
    history: List[Dict[str, Any]]
    tool_events: List[Dict[str, Any]]
    last_user_message: str
    current_code: Optional[str] = None
    component_name: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class ArtifactService:
    """Orchestrate LangGraph-powered generation of React component artifacts."""

    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._graph = None
        self._prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are VisionSea's Artifact Architect. \n"
                    "You design responsive, futuristic React components.\n"
                    "CRITICAL RULES:\n"
                    "- Use JavaScript (NOT TypeScript) - no type annotations\n"
                    "- NO 'export' or 'import' statements (React is already available)\n"
                    "- Return ONLY the component definition as a const\n"
                    "- Use functional components with hooks\n"
                    "- Use inline styles or CSS-in-JS only\n"
                    "- No external dependencies or imports\n"
                    "- Avoid markdown code fences\n"
                    "\n"
                    "CONTAINER STYLING (CRITICAL):\n"
                    "- The root div MUST have: width: '100%', height: '100%'\n"
                    "- Use display: 'flex' for layout control\n"
                    "- Set boxSizing: 'border-box' to include padding in dimensions\n"
                    "- Avoid fixed heights (px, rem) or max-width constraints\n"
                    "- Use percentage-based or flex-based sizing\n"
                    "\n"
                    "Example format:\n"
                    "const MyComponent = () => {{\n"
                    "  return (\n"
                    "    <div style={{{{\n"
                    "      width: '100%',\n"
                    "      height: '100%',\n"
                    "      display: 'flex',\n"
                    "      flexDirection: 'column',\n"
                    "      boxSizing: 'border-box',\n"
                    "      padding: '20px'\n"
                    "    }}}}>\n"
                    "      {{/* component content */}}\n"
                    "    </div>\n"
                    "  );\n"
                    "}};"
                    "\n\n"
                    "Do NOT add 'export default' or any import/export statements.",
                ),
                (
                    "human",
                    "Component label: {component_label}\n"
                    "Mission dossier:\n{artifact_brief}\n\n"
                    "Existing component (if provided) should be improved, not discarded:\n"
                    "{existing_code}\n\n"
                    "Produce a creative, visually engaging const component definition (NO exports/imports).\n"
                    "If tool data contains numbers, arrays, or structured data, visualize it with charts/graphs.\n"
                    "Component will be rendered in a sandboxed environment.\n"
                    "Include any helper functions (chart rendering, data processing) within the same code block.",
                ),
            ]
        )
        self._model: Optional[ChatOpenAI] = None

    async def stream_artifact(self, spec: ArtifactJobSpec) -> AsyncIterator[ArtifactEvent]:
        if not self._settings.has_openai_credentials():
            yield self._error_event(spec.artifact_id, "LLM credentials missing for artifact generation.")
            return

        graph = self._ensure_graph()
        if graph is None:
            yield self._error_event(spec.artifact_id, "Artifact graph is unavailable.")
            return

        initial_state: ArtifactGraphState = {
            "history_snippet": self._summarize_history(spec.history),
            "tool_digest": self._summarize_tools(spec.tool_events),
            "user_request": spec.last_user_message,
            "metadata_blob": self._summarize_metadata(spec.metadata),
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
                translated = self._translate_event(raw_event, spec.artifact_id)
                for event in translated:
                    if event["type"] == "artifact_delta":
                        code_stream.append(event.get("chunk", ""))
                    elif event["type"] == "artifact_message":
                        final_message = event.get("content") or final_message
                    yield event
        except Exception as exc:  # pragma: no cover - defensive
            log.exception("Artifact LangGraph run failed", exc_info=exc)
            yield self._error_event(spec.artifact_id, "Artifact generation failed. Please retry.")
            return

        merged_code = self._strip_code_fences(final_message or "".join(code_stream)).strip()
        if not merged_code:
            merged_code = spec.current_code or ""
        
        # Ensure generated component fits container
        merged_code = self._ensure_container_fit(merged_code)

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

        if not self._settings.has_openai_credentials():
            return None

        self._model = ChatOpenAI(
            api_key=self._settings.openai_api_key,
            model=self._settings.openai_model_name,
            temperature=min(0.35, self._settings.default_temperature + 0.15),
            streaming=True,
        )

        workflow = StateGraph(ArtifactGraphState)
        workflow.add_node("prepare_context", self._prepare_context)
        workflow.add_node("generate_component", self._prompt | self._model)
        workflow.add_edge("prepare_context", "generate_component")
        workflow.add_edge("generate_component", END)
        workflow.set_entry_point("prepare_context")
        self._graph = workflow.compile()
        return self._graph

    def _prepare_context(self, state: ArtifactGraphState) -> ArtifactGraphState:
        artifact_brief = self._render_brief(
            history_snippet=state.get("history_snippet", ""),
            tool_digest=state.get("tool_digest", ""),
            user_request=state.get("user_request", ""),
            metadata_blob=state.get("metadata_blob", ""),
        )
        return {
            "artifact_brief": artifact_brief,
            "existing_code": state.get("existing_code", ""),
            "component_label": state.get("component_label", "HoloWidget"),
        }

    def _render_brief(
        self,
        *,
        history_snippet: str,
        tool_digest: str,
        user_request: str,
        metadata_blob: str,
    ) -> str:
        sections = [
            "User request:\n" + user_request.strip(),
        ]
        # Prioritize tool data as it's often the most relevant for visualization
        if tool_digest:
            sections.insert(0, "Tool outputs (use this data for charts/visualizations):\n" + tool_digest.strip())
        if history_snippet:
            sections.append("Context:\n" + history_snippet.strip())
        if metadata_blob:
            sections.append("Additional info:\n" + metadata_blob.strip())
        sections.append(
            "Design directives:\n"
            "- Create visually stunning, futuristic components with glassmorphism\n"
            "- Transform data into charts/graphs using SVG (no external libs)\n"
            "- Self-contained inline styles only\n"
            "- Works in react-live sandbox (no imports/exports)\n"
            "- Root container fills parent: width: '100%', height: '100%'\n"
            "- Responsive flex layouts, avoid fixed dimensions\n"
            "- Add interactivity where appropriate (hover, animations)"
        )
        return "\n\n".join(section for section in sections if section.strip())

    def _summarize_history(self, history: List[Dict[str, Any]], limit: int = 2) -> str:
        """Get last user message and assistant response for focused context."""
        window = history[-limit:] if history else []
        lines = []
        for item in window:
            role = item.get('role', 'assistant').upper()
            content = item.get('content', '').strip()
            # Truncate long messages to avoid bloat
            if len(content) > 500:
                content = content[:500] + "..."
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    def _summarize_tools(self, events: List[Dict[str, Any]], limit: int = 3) -> str:
        """Extract tool names and outputs for creative component generation."""
        collected: List[str] = []
        for event in events:
            # Focus on tool outputs (results) - these often contain data to visualize
            if event.get("type") == "tool_call_end":
                tool_name = event.get('tool_name', 'tool')
                output = event.get("output")
                try:
                    # Try to keep structured data intact for better visualization
                    output_str = json.dumps(output, ensure_ascii=False, indent=2)[:800]
                except (TypeError, ValueError):
                    output_str = str(output)[:800]
                collected.append(f"Tool: {tool_name}\nOutput:\n{output_str}")
            # Include tool names from start events for context
            elif event.get("type") == "tool_call_start":
                tool_name = event.get('tool_name', 'tool')
                collected.append(f"Tool called: {tool_name}")
        return "\n\n".join(collected[-limit:])

    def _summarize_metadata(self, metadata: Dict[str, Any]) -> str:
        if not metadata:
            return ""
        try:
            return json.dumps(metadata, ensure_ascii=False, indent=2)
        except TypeError:
            return str(metadata)

    def _translate_event(self, raw_event: Dict[str, Any], artifact_id: str) -> List[ArtifactEvent]:
        events: List[ArtifactEvent] = []
        messages = raw_event.get("messages") or []
        for message in messages:
            if isinstance(message, AIMessage):
                events.append(
                    {
                        "type": "artifact_message",
                        "artifact_id": artifact_id,
                        "content": self._stringify_content(message.content),
                    }
                )

        event_type = raw_event.get("event")
        data = raw_event.get("data") or {}
        if event_type in {"on_chat_model_stream", "llm_stream"}:
            chunk = data.get("chunk")
            text = self._chunk_to_text(chunk)
            if text:
                events.append(
                    {
                        "type": "artifact_delta",
                        "artifact_id": artifact_id,
                        "chunk": text,
                    }
                )
        elif event_type in {"on_chain_error", "chain_error"}:
            events.append(self._error_event(artifact_id, str(data.get("error") or data)))
        return events

    def _error_event(self, artifact_id: str, message: str) -> ArtifactEvent:
        return {
            "type": "artifact_error",
            "artifact_id": artifact_id,
            "message": message,
        }

    def _stringify_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(self._stringify_content(part) for part in content)
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

    def _strip_code_fences(self, value: str) -> str:
        trimmed = value.strip()
        
        # Remove markdown code fences
        if trimmed.startswith("```"):
            body = trimmed[3:]
            newline_index = body.find("\n")
            if newline_index != -1:
                language = body[:newline_index].strip().lower()
                if language in {"tsx", "jsx", "js", "ts", "typescript", "javascript"}:
                    body = body[newline_index + 1 :]
            if body.endswith("```"):
                body = body[:-3]
            trimmed = body.strip()
        
        # Remove export statements (breaks react-live sandbox)
        lines = trimmed.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip export default and import lines
            if stripped.startswith('export default') or stripped.startswith('export '):
                continue
            if stripped.startswith('import ') and 'from' in stripped:
                continue
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines).strip()
    
    def _ensure_container_fit(self, code: str) -> str:
        """Wrap component to ensure it fills the container properly."""
        if not code or not code.strip():
            return code
        
        # Extract component name
        import re
        component_match = re.search(r'(?:const|function)\s+(\w+)\s*[=:]', code)
        if not component_match:
            return code
        
        component_name = component_match.group(1)
        
        # Check if code already has container-fitting wrapper
        if 'width: \'100%\'' in code and 'height: \'100%\'' in code:
            return code
        
        # Create wrapper component that ensures proper fit
        wrapper = f"""const {component_name}Container = () => {{
  return (
    <div style={{{{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'auto'
    }}}}>
      <{component_name} />
    </div>
  );
}};

{code}"""
        
        # Replace the render call to use wrapper
        if f'render(<{component_name} />' in code:
            return wrapper.replace(f'<{component_name} />', f'<{component_name}Container />')
        
        return code
