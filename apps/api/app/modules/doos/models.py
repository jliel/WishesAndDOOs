from datetime import datetime, timezone
import uuid

from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Doo(db.Model):
    """Workspace-scoped actionable task ('DOO') optionally linked to a parent Wish."""

    __tablename__ = "doos"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wish_id = db.Column(
        db.String(36),
        db.ForeignKey("wishes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category_id = db.Column(
        db.String(36),
        db.ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = db.Column(db.String(200), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    priority = db.Column(
        db.String(16), nullable=False, default="medium"
    )  # low | medium | high
    status = db.Column(
        db.String(24), nullable=False, default="todo", index=True
    )  # todo | in_progress | done
    due_date = db.Column(db.Date, nullable=True, index=True)
    recurrence_rule = db.Column(
        db.String(32), nullable=False, default="none"
    )  # none | daily | weekly | monthly | custom
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    subtasks = db.relationship(
        "DooSubtask",
        back_populates="doo",
        cascade="all, delete-orphan",
        order_by="DooSubtask.sort_order",
    )


class DooSubtask(db.Model):
    """Checklist sub-task item belonging to a parent Doo."""

    __tablename__ = "doo_subtasks"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doo_id = db.Column(
        db.String(36),
        db.ForeignKey("doos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.String(200), nullable=False)
    is_completed = db.Column(db.Boolean, nullable=False, default=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    doo = db.relationship("Doo", back_populates="subtasks")
