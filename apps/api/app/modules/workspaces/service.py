from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from app.extensions import db
from app.modules.auth.models import User, UserSession
from app.modules.workspaces.models import Workspace, WorkspaceMember
from app.core.security import verify_password, hash_password


class SettingsError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def update_user_profile(
    user_id: str,
    display_name: Optional[str] = None,
    theme_style: Optional[str] = None,
    color_mode: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> Dict[str, Any]:
    user = db.session.get(User, user_id)
    if not user:
        raise SettingsError("user_not_found", "User not found.", 404)

    if display_name is not None:
        name_clean = display_name.strip()
        if not name_clean:
            raise SettingsError("invalid_display_name", "Display name cannot be empty.", 422)
        user.display_name = name_clean

    if theme_style is not None:
        if theme_style not in ("classical", "pastel", "joyful"):
            raise SettingsError("invalid_theme_style", "Theme style must be classical, pastel, or joyful.", 422)
        user.theme_style = theme_style

    if color_mode is not None:
        if color_mode not in ("system", "light", "dark"):
            raise SettingsError("invalid_color_mode", "Color mode must be system, light, or dark.", 422)
        user.color_mode = color_mode

    if avatar_url is not None:
        user.avatar_url = avatar_url.strip() or None

    db.session.commit()
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "theme_style": user.theme_style,
        "color_mode": user.color_mode,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def change_user_password(
    user_id: str,
    current_password: str,
    new_password: str,
) -> None:
    user = db.session.get(User, user_id)
    if not user:
        raise SettingsError("user_not_found", "User not found.", 404)

    # Note: verify_password expects (password_hash, password)
    if not verify_password(user.password_hash, current_password):
        raise SettingsError("invalid_current_password", "Current password does not match.", 400)

    from app.modules.auth.service import revoke_session_token

    user.password_hash = hash_password(new_password)
    # Revoke all existing sessions on password change for security
    revoke_session_token(user_id=user.id)
    db.session.commit()


def update_workspace(
    user_id: str,
    workspace_id: str,
    name: Optional[str] = None,
    currency: Optional[str] = None,
) -> Dict[str, Any]:
    membership = (
        db.session.query(WorkspaceMember)
        .filter_by(workspace_id=workspace_id, user_id=user_id)
        .first()
    )
    if not membership:
        raise SettingsError("forbidden_workspace", "You do not have access to this workspace.", 403)

    ws = db.session.get(Workspace, workspace_id)
    if not ws:
        raise SettingsError("workspace_not_found", "Workspace not found.", 404)

    if name is not None:
        clean_name = name.strip()
        if not clean_name:
            raise SettingsError("invalid_name", "Workspace name cannot be empty.", 422)
        ws.name = clean_name

    if currency is not None:
        curr_clean = currency.strip().upper()
        if curr_clean not in ("USD", "EUR", "GBP", "MXN", "CAD", "JPY"):
            raise SettingsError("invalid_currency", "Unsupported currency.", 422)
        ws.currency = curr_clean

    db.session.commit()
    return {
        "id": ws.id,
        "name": ws.name,
        "currency": ws.currency,
        "type": ws.type,
    }


def list_user_sessions(user_id: str, current_token_hash: Optional[str] = None) -> List[Dict[str, Any]]:
    sessions = (
        db.session.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.is_revoked == False)
        .order_by(UserSession.created_at.desc())
        .all()
    )

    result = []
    for s in sessions:
        is_current = bool(current_token_hash and s.refresh_token_hash == current_token_hash)
        result.append({
            "id": s.id,
            "ip_address": s.ip_address or "Unknown IP",
            "user_agent": s.user_agent or "Unknown Browser",
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "is_current": is_current,
        })
    return result


def revoke_user_session(user_id: str, session_id: str) -> None:
    session = db.session.get(UserSession, session_id)
    if not session or session.user_id != user_id:
        raise SettingsError("session_not_found", "Session not found.", 404)

    session.is_revoked = True
    db.session.commit()
