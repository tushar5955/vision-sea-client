from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

from langchain_core.messages import AIMessage
from .types import ArtifactEvent

log = logging.getLogger(__name__)


def summarize_history(history: List[Dict[str, Any]], limit: int = 2) -> str:
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


def summarize_tools(events: List[Dict[str, Any]], limit: int = 3) -> str:
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


def summarize_metadata(metadata: Dict[str, Any]) -> str:
    if not metadata:
        return ""
    try:
        return json.dumps(metadata, ensure_ascii=False, indent=2)
    except TypeError:
        return str(metadata)


def compose_context_payload(
    *,
    history_snippet: str,
    tool_digest: str,
    user_request: str,
    metadata_blob: str,
) -> str:
    sections: List[str] = []
    if tool_digest.strip():
        sections.append("Tool telemetry (prioritize for visualization):\n" + tool_digest.strip())
    if user_request.strip():
        sections.append("Latest user directive:\n" + user_request.strip())
    if history_snippet.strip():
        sections.append("Conversation excerpt:\n" + history_snippet.strip())
    if metadata_blob.strip():
        sections.append("Metadata dossier:\n" + metadata_blob.strip())
    sections.append(
        "Synthesis guidance:\n"
        "- Keep chronological flow clear\n"
        "- Surface numeric ranges, rankings, or timelines verbatim\n"
        "- Flag datasets that deserve charts, particle fields, or animated counters\n"
        "- Suggest suitable chart forms (e.g., arc gauge for completion %, stacked sparkline for time-series)"
    )
    return "\n\n".join(section for section in sections if section.strip())


def stringify_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(stringify_content(part) for part in content)
    return str(content)


def chunk_to_text(chunk: Any) -> str:
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


def translate_event(raw_event: Dict[str, Any], artifact_id: str) -> List[ArtifactEvent]:
    events: List[ArtifactEvent] = []
    messages = raw_event.get("messages") or []
    for message in messages:
        if isinstance(message, AIMessage):
            events.append(
                {
                    "type": "artifact_message",
                    "artifact_id": artifact_id,
                    "content": stringify_content(message.content),
                }
            )

    event_type = raw_event.get("event")
    data = raw_event.get("data") or {}
    if event_type in {"on_chat_model_stream", "llm_stream"}:
        chunk = data.get("chunk")
        text = chunk_to_text(chunk)
        if text:
            events.append(
                {
                    "type": "artifact_delta",
                    "artifact_id": artifact_id,
                    "chunk": text,
                }
            )
    elif event_type in {"on_chain_error", "chain_error"}:
        events.append(error_event(artifact_id, str(data.get("error") or data)))
    return events


def error_event(artifact_id: str, message: str) -> ArtifactEvent:
    return {
        "type": "artifact_error",
        "artifact_id": artifact_id,
        "message": message,
    }


def strip_code_fences(value: str) -> str:
    trimmed = value.strip()
    
    # Robustly extract code block: find the first ``` block
    # This handles cases where LLM adds conversational text before the code
    block_match = re.search(r'```(?:\w+)?\s*\n(.*?)\s*```', trimmed, re.DOTALL)
    if block_match:
        trimmed = block_match.group(1).strip()
    elif trimmed.startswith("```"):
        # Fallback for when regex doesn't match (e.g. unclosed code block)
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


def ensure_container_fit(code: str) -> str:
    """Wrap component to ensure it fills the container properly."""
    if not code or not code.strip():
        return code
    
    # Extract component name
    component_match = re.search(r'(?:const|function)\s+(\w+)\s*[=:]', code)
    if not component_match:
        return code
    
    component_name = component_match.group(1)

    has_dimension_styles = "width: '100%'" in code and "height: '100%'" in code
    uses_runtime_shell = "artifact-runtime-surface" in code

    # Skip wrapping when component already opts into the shared shell or inline sizing
    if has_dimension_styles or uses_runtime_shell:
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

"""

    updated_code = code
    if f'render(<{component_name} />' in code:
        updated_code = code.replace(
            f'render(<{component_name} />',
            f'render(<{component_name}Container />',
            1,
        )

    return f"{wrapper}\n\n{updated_code}"
