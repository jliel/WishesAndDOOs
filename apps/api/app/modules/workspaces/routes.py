from flask import Blueprint, g, jsonify, request
from pydantic import ValidationError

from app.core.decorators import require_auth
from app.modules.workspaces.schemas import (
    ChangePasswordRequest,
    ProfileUpdateRequest,
    WorkspaceUpdateRequest,
)
from app.modules.workspaces.service import (
    SettingsError,
    change_user_password,
    list_user_sessions,
    revoke_user_session,
    update_user_profile,
    update_workspace,
)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/v1/settings")
workspaces_bp = Blueprint("workspaces", __name__, url_prefix="/api/v1/workspaces")


@settings_bp.errorhandler(ValidationError)
@workspaces_bp.errorhandler(ValidationError)
def handle_validation_error(err: ValidationError):
    first_error = err.errors()[0]
    field = ".".join(str(loc) for loc in first_error.get("loc", []))
    msg = first_error.get("msg", "Invalid input.")
    return (
        jsonify(
            {
                "error": "validation_error",
                "field": field,
                "message": msg,
            }
        ),
        422,
    )


@settings_bp.errorhandler(SettingsError)
@workspaces_bp.errorhandler(SettingsError)
def handle_settings_error(err: SettingsError):
    return jsonify({"error": err.code, "message": err.message}), err.status_code


@settings_bp.route("/profile", methods=["GET"])
@require_auth
def get_profile():
    user = g.current_user
    return (
        jsonify(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                    "theme_style": user.theme_style,
                    "color_mode": user.color_mode,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            }
        ),
        200,
    )


@settings_bp.route("/profile", methods=["PUT", "PATCH"])
@require_auth
def update_profile():
    body = request.get_json(silent=True) or {}
    validated = ProfileUpdateRequest(**body)
    user_data = update_user_profile(
        user_id=g.current_user.id,
        display_name=validated.display_name,
        theme_style=validated.theme_style,
        color_mode=validated.color_mode,
        avatar_url=validated.avatar_url,
    )
    return jsonify({"user": user_data, "message": "Profile updated successfully."}), 200


@settings_bp.route("/change-password", methods=["POST"])
@require_auth
def change_password():
    body = request.get_json(silent=True) or {}
    validated = ChangePasswordRequest(**body)
    change_user_password(
        user_id=g.current_user.id,
        current_password=validated.current_password,
        new_password=validated.new_password,
    )
    return jsonify({"message": "Password changed successfully."}), 200


@settings_bp.route("/sessions", methods=["GET"])
@require_auth
def get_sessions():
    sessions = list_user_sessions(user_id=g.current_user.id)
    return jsonify({"sessions": sessions}), 200


@settings_bp.route("/sessions/<string:session_id>/revoke", methods=["POST"])
@require_auth
def revoke_session(session_id: str):
    revoke_user_session(user_id=g.current_user.id, session_id=session_id)
    return jsonify({"message": "Session revoked."}), 200


@workspaces_bp.route("/<string:workspace_id>", methods=["PUT", "PATCH"])
@require_auth
def update_workspace_endpoint(workspace_id: str):
    body = request.get_json(silent=True) or {}
    validated = WorkspaceUpdateRequest(**body)
    data = update_workspace(
        user_id=g.current_user.id,
        workspace_id=workspace_id,
        name=validated.name,
        currency=validated.currency,
    )
    return jsonify({"workspace": data, "message": "Workspace settings saved."}), 200
