from typing import Optional, List
from pydantic import BaseModel, Field


class DooSubtaskInput(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    is_completed: bool = False
    sort_order: int = 0


class DooCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    workspace_id: Optional[str] = None
    wish_id: Optional[str] = None
    category_id: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    status: str = Field("todo", pattern="^(todo|in_progress|done)$")
    due_date: Optional[str] = None  # YYYY-MM-DD
    recurrence_rule: str = Field("none", pattern="^(none|daily|weekly|monthly|custom)$")
    subtasks: Optional[List[DooSubtaskInput]] = None


class DooUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    wish_id: Optional[str] = None
    category_id: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    status: Optional[str] = Field(None, pattern="^(todo|in_progress|done)$")
    due_date: Optional[str] = None  # YYYY-MM-DD or empty to clear
    recurrence_rule: Optional[str] = Field(None, pattern="^(none|daily|weekly|monthly|custom)$")
    subtasks: Optional[List[DooSubtaskInput]] = None


class DooToggleStatusRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(todo|in_progress|done)$")


class SubtaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    sort_order: Optional[int] = 0


class SubtaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    is_completed: Optional[bool] = None
    sort_order: Optional[int] = None
