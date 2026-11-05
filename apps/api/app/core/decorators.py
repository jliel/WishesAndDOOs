from functools import wraps
from typing import Callable

import jwt
from flask import g, jsonify, request

from app.core.security import decode_access_token
from app.extensions import db
from app.modules.auth.models import User
from app.modules.workspaces.models import WorkspaceMember


def require_auth(fn: Callable) -> Callable:
    """Verify Bearer JWT access token and attach `g.current_user`."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return (
                jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Authentication required. Please sign in.",
                    }
                ),
                401,
            )

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return (
                jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Missing access token.",
                    }
                ),
                401,
            )

        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return (
                jsonify(
                    {
                        "error": "token_expired",
                        "message": "Your session has expired. Please refresh or sign in again.",
                    }
                ),
                401,
            )
        except jwt.PyJWTError:
            return (
                jsonify(
                    {
                        "error": "invalid_token",
                        "message": "Invalid authentication token.",
                    }
                ),
                401,
            )

        user = db.session.get(User, payload.get("sub"))
        if not user:
            return (
                jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Account no longer exists.",
                    }
                ),
                401,
            )

        g.current_user = user
        g.access_token_payload = payload
        return fn(*args, **kwargs)

    return wrapper


def require_workspace_role(*allowed_roles: str) -> Callable:
    """Verify the authenticated user belongs to `<workspace_id>` with an allowed role."""

    roles = set(allowed_roles) if allowed_roles else {"owner", "editor", "viewer"}

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        @require_auth
        def wrapper(*args, **kwargs):
            workspace_id = kwargs.get("workspace_id") or request.view_args.get(
                "workspace_id"
            )
            if not workspace_id:
                return (
                    jsonify(
                        {
                            "error": "bad_request",
                            "message": "Workspace ID is required.",
                        }
                    ),
                    400,
                )

            membership = (
                db.session.query(WorkspaceMember)
                .filter_by(workspace_id=workspace_id, user_id=g.current_user.id)
                .first()
            )
            if not membership or membership.role not in roles:
                return (
                    jsonify(
                        {
                            "error": "forbidden",
                            "message": "You do not have permission to access this workspace.",
                        }
                    ),
                    403,
                )

            g.current_membership = membership
            return fn(*args, **kwargs)

        return wrapper

    return decorator
