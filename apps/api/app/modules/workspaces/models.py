import uuid
from datetime import datetime, timezone

from app.extensions import db


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(db.Model):
    """Multi-tenant workspace container (Personal in v1.0, Shared in v2.0)."""

    __tablename__ = "workspaces"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    type = db.Column(db.String(32), nullable=False, default="personal")
    currency = db.Column(db.String(8), nullable=False, default="USD")
    created_by = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    members = db.relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    categories = db.relationship(
        "Category",
        back_populates="workspace",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class WorkspaceMember(db.Model):
    """Associates a User with a Workspace and role (owner | editor | viewer)."""

    __tablename__ = "workspace_members"

    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role = db.Column(db.String(24), nullable=False, default="owner")
    joined_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    workspace = db.relationship("Workspace", back_populates="members")
    user = db.relationship("User", back_populates="workspace_memberships")


class Category(db.Model):
    """Workspace-scoped category for Wishes, DOOs, and Finances."""

    __tablename__ = "categories"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = db.Column(
        db.String(36),
        db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module = db.Column(db.String(24), nullable=False, index=True)  # finance | wish | doo
    name = db.Column(db.String(80), nullable=False)
    icon = db.Column(db.String(48), nullable=False, default="label-outline")
    color = db.Column(db.String(24), nullable=False, default="finance")

    workspace = db.relationship("Workspace", back_populates="categories")
