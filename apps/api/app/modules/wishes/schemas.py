from typing import Optional, List
from pydantic import BaseModel, Field


class WishCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    workspace_id: Optional[str] = None
    category_id: Optional[str] = None
    savings_goal_id: Optional[str] = None
    account_id: Optional[str] = None
    linked_doo_ids: Optional[List[str]] = None
    notes: Optional[str] = None
    url: Optional[str] = Field(None, max_length=512)
    image_storage_key: Optional[str] = Field(None, max_length=512)
    estimated_price: Optional[float] = Field(None, ge=0)
    priority: str = Field("medium", pattern="^(low|medium|high)$")


class WishUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=160)
    category_id: Optional[str] = None
    savings_goal_id: Optional[str] = None
    account_id: Optional[str] = None
    linked_doo_ids: Optional[List[str]] = None
    notes: Optional[str] = None
    url: Optional[str] = Field(None, max_length=512)
    image_storage_key: Optional[str] = Field(None, max_length=512)
    estimated_price: Optional[float] = Field(None, ge=0)
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    status: Optional[str] = Field(None, pattern="^(active|granted|archived)$")


class WishFulfillRequest(BaseModel):
    record_expense: bool = False
    account_id: Optional[str] = None
    expense_amount: Optional[float] = Field(None, ge=0)
    category_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=240)
