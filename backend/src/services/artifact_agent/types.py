from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, TypedDict


ArtifactEvent = Dict[str, Any]


class ArtifactGraphState(TypedDict, total=False):
    history_snippet: str
    tool_digest: str
    user_request: str
    metadata_blob: str
    existing_code: str
    component_label: str
    context_payload: str
    rich_context: str


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
