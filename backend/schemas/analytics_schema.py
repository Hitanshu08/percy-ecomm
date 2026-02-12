from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


class AnalyticsEventCreate(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=100)
    status: str = Field(default="success", min_length=2, max_length=20)
    target_username: Optional[str] = None
    source: Optional[str] = Field(default=None, max_length=50)
    external_ref: Optional[str] = Field(default=None, max_length=255)
    details: Dict[str, Any] = Field(default_factory=dict)
