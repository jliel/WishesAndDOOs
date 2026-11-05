from datetime import date, datetime, timezone
from decimal import Decimal
import uuid

from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


class Account(db.Model):
    """Workspace-scoped financial account / wallet."""

    __tablename__ = "accounts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(
        db.String(24), nullable=False, default="checking"
    )  # checking | savings | cash | credit
    balance = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    icon = db.Column(db.String(48), nullable=False, default="account-balance-wallet")
    color = db.Column(db.String(24), nullable=False, default="finance")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)


class SavingsGoal(db.Model):
    """Workspace-scoped savings goal optionally backed by an account and linked to Wishes."""

    __tablename__ = "savings_goals"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = db.Column(
        db.String(36),
        db.ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name = db.Column(db.String(120), nullable=False)
    target_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    current_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    target_date = db.Column(db.Date, nullable=True)
    icon = db.Column(db.String(48), nullable=False, default="savings")
    color = db.Column(db.String(24), nullable=False, default="finance")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)


class Transaction(db.Model):
    """Workspace-scoped financial transaction (income, expense, transfer)."""

    __tablename__ = "transactions"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = db.Column(
        db.String(36),
        db.ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id = db.Column(
        db.String(36),
        db.ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    savings_goal_id = db.Column(
        db.String(36),
        db.ForeignKey("savings_goals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type = db.Column(
        db.String(24), nullable=False, default="expense", index=True
    )  # income | expense | transfer
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(240), nullable=False)
    transaction_date = db.Column(db.Date, nullable=False, default=today_utc, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)


class Budget(db.Model):
    """Workspace-scoped monthly category budget limit."""

    __tablename__ = "budgets"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id = db.Column(
        db.String(36),
        db.ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    monthly_limit = db.Column(db.Numeric(12, 2), nullable=False)
    period_month = db.Column(db.String(7), nullable=False, index=True)  # YYYY-MM
