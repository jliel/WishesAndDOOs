from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AccountCreateRequest(BaseModel):
    """Pydantic v2 schema for creating a new financial account / wallet."""

    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["checking", "savings", "cash", "credit"] = "checking"
    balance: Decimal = Field(default=Decimal("0.00"))
    icon: str = Field(default="account-balance-wallet", max_length=48)
    color: str = Field(default="finance", max_length=24)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Account name cannot be empty.")
        return cleaned


class AccountUpdateRequest(BaseModel):
    """Pydantic v2 schema for updating an existing account."""

    name: Optional[str] = Field(default=None, max_length=100)
    type: Optional[Literal["checking", "savings", "cash", "credit"]] = None
    icon: Optional[str] = Field(default=None, max_length=48)
    color: Optional[str] = Field(default=None, max_length=24)


class TransactionCreateRequest(BaseModel):
    """Pydantic v2 schema for recording a financial transaction."""

    account_id: str = Field(..., min_length=1)
    category_id: Optional[str] = Field(default=None)
    savings_goal_id: Optional[str] = Field(default=None)
    type: Literal["income", "expense", "transfer"] = "expense"
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    description: str = Field(..., min_length=1, max_length=240)
    transaction_date: Optional[date] = Field(default=None)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Transaction description cannot be empty.")
        return cleaned


class BudgetSetRequest(BaseModel):
    """Pydantic v2 schema for setting/upserting a monthly category budget limit."""

    category_id: str = Field(..., min_length=1)
    monthly_limit: Decimal = Field(..., ge=Decimal("0.00"))
    period_month: Optional[str] = Field(default=None, max_length=7)


class SavingsGoalCreateRequest(BaseModel):
    """Pydantic v2 schema for creating a savings goal."""

    name: str = Field(..., min_length=1, max_length=120)
    target_amount: Decimal = Field(..., gt=Decimal("0.00"))
    current_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    target_date: Optional[date] = Field(default=None)
    account_id: Optional[str] = Field(default=None)
    icon: str = Field(default="savings", max_length=48)
    color: str = Field(default="finance", max_length=24)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Goal name cannot be empty.")
        return cleaned


class SavingsGoalUpdateRequest(BaseModel):
    """Pydantic v2 schema for updating a savings goal."""

    name: Optional[str] = Field(default=None, max_length=120)
    target_amount: Optional[Decimal] = Field(default=None, gt=Decimal("0.00"))
    target_date: Optional[date] = Field(default=None)
    account_id: Optional[str] = Field(default=None)
    icon: Optional[str] = Field(default=None, max_length=48)
    color: Optional[str] = Field(default=None, max_length=24)


class SavingsGoalFundRequest(BaseModel):
    """Pydantic v2 schema for explicitly funding a savings goal from an account."""

    amount: Decimal = Field(..., gt=Decimal("0.00"))
    account_id: str = Field(..., min_length=1)
    description: Optional[str] = Field(default=None, max_length=240)
