from datetime import datetime, timedelta, timezone
from typing import Any

from flask import current_app

from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.extensions import db
from app.modules.auth.models import AuditLog, User, UserSession
from app.modules.workspaces.models import Category, Workspace, WorkspaceMember

DEMO_EMAIL = "demo@wishesanddoos.app"
DEMO_PASSWORD = "DemoPassword123!"
DEMO_DISPLAY_NAME = "Alex Rivera"

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)

DEFAULT_WORKSPACE_CATEGORIES: list[dict[str, str]] = [
    # Finance module default categories (MaterialIcons names)
    {"module": "finance", "name": "Housing & Bills", "icon": "home", "color": "finance"},
    {"module": "finance", "name": "Groceries & Dining", "icon": "restaurant", "color": "finance"},
    {"module": "finance", "name": "Travel & Leisure", "icon": "flight", "color": "finance"},
    {"module": "finance", "name": "Income & Salary", "icon": "account-balance-wallet", "color": "finance"},
    # Wish module default categories (MaterialIcons names)
    {"module": "wish", "name": "Experiences & Travel", "icon": "explore", "color": "wish"},
    {"module": "wish", "name": "Tech & Gear", "icon": "devices", "color": "wish"},
    {"module": "wish", "name": "Home & Living", "icon": "auto-awesome", "color": "wish"},
    # DOO module default categories (MaterialIcons names)
    {"module": "doo", "name": "Personal & Health", "icon": "favorite-border", "color": "doo"},
    {"module": "doo", "name": "Household", "icon": "checklist", "color": "doo"},
    {"module": "doo", "name": "Finance & Admin", "icon": "work-outline", "color": "doo"},
]


class AuthError(Exception):
    """Domain exception for authentication and registration failures."""

    def __init__(
        self,
        message: str,
        code: str = "invalid_credentials",
        status_code: int = 401,
        retry_after_seconds: int | None = None,
        field_errors: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds
        self.field_errors = field_errors


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def seed_default_categories_for_workspace(workspace_id: str) -> list[Category]:
    """Seed the standard Finance, Wish, and DOO categories for a workspace if empty."""
    existing_count = (
        db.session.query(Category).filter_by(workspace_id=workspace_id).count()
    )
    if existing_count > 0:
        return (
            db.session.query(Category).filter_by(workspace_id=workspace_id).all()
        )

    created: list[Category] = []
    for item in DEFAULT_WORKSPACE_CATEGORIES:
        cat = Category(
            workspace_id=workspace_id,
            module=item["module"],
            name=item["name"],
            icon=item["icon"],
            color=item["color"],
        )
        db.session.add(cat)
        created.append(cat)
    return created


def serialize_user_and_workspaces(
    user: User,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Serialize a User and their Workspace memberships into response dictionaries."""
    workspaces_list: list[dict[str, Any]] = []
    for membership in user.workspace_memberships:
        ws = membership.workspace
        if ws:
            workspaces_list.append(
                {
                    "id": ws.id,
                    "name": ws.name,
                    "type": ws.type,
                    "currency": ws.currency,
                    "role": membership.role,
                    "categories_count": len(ws.categories) if ws.categories else 0,
                }
            )

    user_dict = {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "theme_style": user.theme_style,
        "color_mode": user.color_mode,
        "is_email_verified": user.is_email_verified,
        "is_2fa_enabled": user.is_2fa_enabled,
    }
    return user_dict, workspaces_list


def record_audit_event(
    event_type: str,
    user_id: str | None = None,
    workspace_id: str | None = None,
    ip_address: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Append an entry to the security audit log."""
    entry = AuditLog(
        user_id=user_id,
        workspace_id=workspace_id,
        event_type=event_type,
        ip_address=ip_address,
        metadata_json=metadata or {},
    )
    db.session.add(entry)


def ensure_demo_user_seeded() -> User:
    """Idempotently seed the demo user, default Personal Workspace, and default categories."""
    existing = db.session.query(User).filter_by(email=DEMO_EMAIL).first()
    if existing:
        if existing.workspace_memberships:
            first_ws_id = existing.workspace_memberships[0].workspace_id
            seed_default_categories_for_workspace(first_ws_id)
            db.session.commit()
        return existing

    demo_user = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        display_name=DEMO_DISPLAY_NAME,
        theme_style="classical",
        color_mode="light",
        is_email_verified=True,
        is_2fa_enabled=False,
    )
    db.session.add(demo_user)
    db.session.flush()

    personal_workspace = Workspace(
        name="Personal Workspace",
        type="personal",
        currency="USD",
        created_by=demo_user.id,
    )
    db.session.add(personal_workspace)
    db.session.flush()

    membership = WorkspaceMember(
        workspace_id=personal_workspace.id,
        user_id=demo_user.id,
        role="owner",
    )
    db.session.add(membership)
    seed_default_categories_for_workspace(personal_workspace.id)

    record_audit_event(
        event_type="seed_demo_user",
        user_id=demo_user.id,
        workspace_id=personal_workspace.id,
        metadata={"email": DEMO_EMAIL},
    )
    db.session.commit()
    return demo_user


def register_user(
    display_name: str,
    email: str,
    password: str,
    currency: str = "USD",
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Atomically register a new User, default Personal Workspace, default Categories, and active Session."""
    now = datetime.now(timezone.utc)
    normalized_email = email.strip().lower()

    existing = db.session.query(User).filter_by(email=normalized_email).first()
    if existing:
        record_audit_event(
            event_type="register_conflict_existing_email",
            ip_address=ip_address,
            metadata={"email": normalized_email},
        )
        db.session.commit()
        raise AuthError(
            message="An account with this email address already exists. Please sign in instead.",
            code="email_already_registered",
            status_code=409,
            field_errors={
                "email": "An account with this email address already exists."
            },
        )

    new_user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        display_name=display_name.strip(),
        theme_style="classical",
        color_mode="light",
        is_email_verified=True,
        is_2fa_enabled=False,
    )
    db.session.add(new_user)
    db.session.flush()

    personal_workspace = Workspace(
        name="Personal Workspace",
        type="personal",
        currency=currency.strip().upper(),
        created_by=new_user.id,
    )
    db.session.add(personal_workspace)
    db.session.flush()

    membership = WorkspaceMember(
        workspace_id=personal_workspace.id,
        user_id=new_user.id,
        role="owner",
    )
    db.session.add(membership)
    seed_default_categories_for_workspace(personal_workspace.id)
    db.session.flush()
    db.session.refresh(new_user)
    db.session.refresh(personal_workspace)

    raw_refresh_token, refresh_hash = generate_refresh_token()
    refresh_expires_delta: timedelta = current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=14)
    )
    session_record = UserSession(
        user_id=new_user.id,
        refresh_token_hash=refresh_hash,
        user_agent=(user_agent or "")[:512] or None,
        ip_address=ip_address,
        is_revoked=False,
        expires_at=now + refresh_expires_delta,
    )
    db.session.add(session_record)

    access_token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        default_workspace_id=personal_workspace.id,
    )

    record_audit_event(
        event_type="user_registered",
        user_id=new_user.id,
        workspace_id=personal_workspace.id,
        ip_address=ip_address,
        metadata={
            "currency": personal_workspace.currency,
            "categories_seeded": len(DEFAULT_WORKSPACE_CATEGORIES),
        },
    )
    db.session.commit()

    user_dict, workspaces_list = serialize_user_and_workspaces(new_user)
    access_expires_delta: timedelta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=15)
    )

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token,
        "token_type": "Bearer",
        "expires_in": int(access_expires_delta.total_seconds()),
        "user": user_dict,
        "workspaces": workspaces_list,
    }


def authenticate_user(
    email: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Verify email/password with Argon2id, enforce lockout rules, and issue tokens."""
    now = datetime.now(timezone.utc)
    normalized_email = email.strip().lower()
    user = db.session.query(User).filter_by(email=normalized_email).first()

    if not user:
        record_audit_event(
            event_type="login_failed_unknown_email",
            ip_address=ip_address,
            metadata={"email": normalized_email},
        )
        db.session.commit()
        raise AuthError(
            message="Invalid email or password.",
            code="invalid_credentials",
            status_code=401,
        )

    locked_until = _as_utc(user.locked_until)
    if locked_until and locked_until > now:
        remaining_seconds = max(1, int((locked_until - now).total_seconds()))
        record_audit_event(
            event_type="login_blocked_locked_account",
            user_id=user.id,
            ip_address=ip_address,
            metadata={"remaining_seconds": remaining_seconds},
        )
        db.session.commit()
        raise AuthError(
            message="Account temporarily locked due to multiple failed sign-in attempts. Please wait 15 minutes and try again.",
            code="account_locked",
            status_code=429,
            retry_after_seconds=remaining_seconds,
        )

    if not verify_password(user.password_hash, password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + LOCKOUT_DURATION
            record_audit_event(
                event_type="account_locked",
                user_id=user.id,
                ip_address=ip_address,
                metadata={"failed_attempts": user.failed_login_attempts},
            )
            db.session.commit()
            raise AuthError(
                message="Too many failed sign-in attempts. Your account has been locked for 15 minutes.",
                code="account_locked",
                status_code=429,
                retry_after_seconds=int(LOCKOUT_DURATION.total_seconds()),
            )

        record_audit_event(
            event_type="login_failed",
            user_id=user.id,
            ip_address=ip_address,
            metadata={"failed_attempts": user.failed_login_attempts},
        )
        db.session.commit()
        raise AuthError(
            message="Invalid email or password.",
            code="invalid_credentials",
            status_code=401,
        )

    # Successful authentication: reset failed attempts & create rotating refresh session
    user.failed_login_attempts = 0
    user.locked_until = None

    raw_refresh_token, refresh_hash = generate_refresh_token()
    refresh_expires_delta: timedelta = current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=14)
    )
    session_record = UserSession(
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        user_agent=(user_agent or "")[:512] or None,
        ip_address=ip_address,
        is_revoked=False,
        expires_at=now + refresh_expires_delta,
    )
    db.session.add(session_record)

    user_dict, workspaces_list = serialize_user_and_workspaces(user)
    default_workspace_id = workspaces_list[0]["id"] if workspaces_list else None

    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        default_workspace_id=default_workspace_id,
    )

    record_audit_event(
        event_type="login_success",
        user_id=user.id,
        workspace_id=default_workspace_id,
        ip_address=ip_address,
        metadata={"session_id": session_record.id},
    )
    db.session.commit()

    access_expires_delta: timedelta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=15)
    )

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token,
        "token_type": "Bearer",
        "expires_in": int(access_expires_delta.total_seconds()),
        "user": user_dict,
        "workspaces": workspaces_list,
    }


def rotate_refresh_token(
    raw_refresh_token: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Validate and rotate a refresh token. Revokes all user sessions on token reuse."""
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(raw_refresh_token)
    session_record = (
        db.session.query(UserSession).filter_by(refresh_token_hash=token_hash).first()
    )

    if not session_record:
        raise AuthError(
            message="Invalid or unrecognized session token.",
            code="invalid_refresh_token",
            status_code=401,
        )

    if session_record.is_revoked:
        # Token reuse detected! Revoke all active sessions for this user immediately
        db.session.query(UserSession).filter_by(
            user_id=session_record.user_id, is_revoked=False
        ).update({"is_revoked": True})
        record_audit_event(
            event_type="refresh_token_reuse_detected",
            user_id=session_record.user_id,
            ip_address=ip_address,
            metadata={"revoked_session_id": session_record.id},
        )
        db.session.commit()
        raise AuthError(
            message="Session token has already been used. All sessions were revoked for security.",
            code="refresh_token_reused",
            status_code=401,
        )

    expires_at = _as_utc(session_record.expires_at)
    if not expires_at or expires_at <= now:
        session_record.is_revoked = True
        db.session.commit()
        raise AuthError(
            message="Your session has expired. Please sign in again.",
            code="refresh_token_expired",
            status_code=401,
        )

    user = session_record.user
    if not user:
        raise AuthError(
            message="User account not found.",
            code="user_not_found",
            status_code=401,
        )

    # Rotate: revoke current session and create a replacement session
    session_record.is_revoked = True
    new_raw_refresh, new_refresh_hash = generate_refresh_token()
    refresh_expires_delta: timedelta = current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=14)
    )
    new_session = UserSession(
        user_id=user.id,
        refresh_token_hash=new_refresh_hash,
        user_agent=(user_agent or "")[:512] or session_record.user_agent,
        ip_address=ip_address or session_record.ip_address,
        is_revoked=False,
        expires_at=now + refresh_expires_delta,
    )
    db.session.add(new_session)

    user_dict, workspaces_list = serialize_user_and_workspaces(user)
    default_workspace_id = workspaces_list[0]["id"] if workspaces_list else None

    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        default_workspace_id=default_workspace_id,
    )

    record_audit_event(
        event_type="token_refreshed",
        user_id=user.id,
        workspace_id=default_workspace_id,
        ip_address=ip_address,
    )
    db.session.commit()

    access_expires_delta: timedelta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=15)
    )

    return {
        "access_token": access_token,
        "refresh_token": new_raw_refresh,
        "token_type": "Bearer",
        "expires_in": int(access_expires_delta.total_seconds()),
        "user": user_dict,
        "workspaces": workspaces_list,
    }


def revoke_session_token(
    raw_refresh_token: str | None = None,
    user_id: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Revoke a specific refresh token session (or all active sessions for user_id if specified)."""
    if raw_refresh_token:
        token_hash = hash_refresh_token(raw_refresh_token)
        session_record = (
            db.session.query(UserSession)
            .filter_by(refresh_token_hash=token_hash)
            .first()
        )
        if session_record:
            session_record.is_revoked = True
            record_audit_event(
                event_type="logout",
                user_id=session_record.user_id,
                ip_address=ip_address,
                metadata={"session_id": session_record.id},
            )
            db.session.commit()
            return

    if user_id:
        db.session.query(UserSession).filter_by(user_id=user_id, is_revoked=False).update(
            {"is_revoked": True}
        )
        record_audit_event(
            event_type="logout_all_sessions",
            user_id=user_id,
            ip_address=ip_address,
        )
        db.session.commit()
