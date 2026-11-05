from datetime import datetime, timezone
import uuid

from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Wish(db.Model):
    """Workspace-scoped Wish item optionally linked to a SavingsGoal and DOOs."""

    __tablename__ = "wishes"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
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
    title = db.Column(db.String(160), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    url = db.Column(db.String(512), nullable=True)
    image_storage_key = db.Column(db.String(512), nullable=True)
    estimated_price = db.Column(db.Numeric(12, 2), nullable=True)
    priority = db.Column(
        db.String(16), nullable=False, default="medium"
    )  # low | medium | high
    status = db.Column(
        db.String(24), nullable=False, default="active", index=True
    )  # active | granted | archived
    granted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    fulfilled_transaction_id = db.Column(
        db.String(36),
        db.ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
