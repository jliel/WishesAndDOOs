from datetime import timedelta
from flask import Blueprint, current_app, g, jsonify, make_response, request
from pydantic import ValidationError

from app.core.decorators import require_auth
from app.extensions import limiter
from app.modules.auth.schemas import LoginRequest, RefreshTokenRequest, RegisterRequest
from app.modules.auth.service import (
    AuthError,
    authenticate_user,
    register_user,
    revoke_session_token,
    rotate_refresh_token,
    serialize_user_and_workspaces,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

REFRESH_COOKIE_NAME = "wad_refresh_token"


def _set_refresh_cookie(response, refresh_token: str) -> None:
    refresh_expires: timedelta = current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=14)
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(refresh_expires.total_seconds()),
        httponly=True,
        secure=not current_app.debug and not current_app.testing,
        samesite="Lax",
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        httponly=True,
        samesite="Lax",
    )


@auth_bp.post("/register")
@limiter.limit("5 per minute")
def register():
    """Register a new User, default Personal Workspace, and default Categories atomically."""
    raw_data = request.get_json(silent=True) or {}

    try:
        payload = RegisterRequest.model_validate(raw_data)
    except ValidationError as exc:
        field_errors = {}
        for err in exc.errors():
            loc = str(err["loc"][0]) if err.get("loc") else "form"
            field_errors[loc] = err["msg"].removeprefix("Value error, ")
        first_message = next(
            iter(field_errors.values()),
            "Please review the highlighted registration fields.",
        )
        return (
            jsonify(
                {
                    "error": "validation_error",
                    "message": first_message,
                    "field_errors": field_errors,
                }
            ),
            400,
        )

    try:
        session_data = register_user(
            display_name=payload.display_name,
            email=payload.email,
            password=payload.password,
            currency=payload.currency,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except AuthError as err:
        resp_body: dict = {
            "error": err.code,
            "message": err.message,
        }
        if err.field_errors:
            resp_body["field_errors"] = err.field_errors
        if err.retry_after_seconds is not None:
            resp_body["retry_after_seconds"] = err.retry_after_seconds
        return jsonify(resp_body), err.status_code

    response = make_response(jsonify(session_data), 201)
    _set_refresh_cookie(response, session_data["refresh_token"])
    return response


@auth_bp.post("/login")
@limiter.limit("5 per minute")
def login():
    """Authenticate user with Email + Password (Argon2id) and issue JWT + Refresh Session."""
    raw_data = request.get_json(silent=True) or {}

    try:
        payload = LoginRequest.model_validate(raw_data)
    except ValidationError as exc:
        field_errors = {}
        for err in exc.errors():
            loc = str(err["loc"][0]) if err.get("loc") else "form"
            field_errors[loc] = err["msg"].removeprefix("Value error, ")
        return (
            jsonify(
                {
                    "error": "validation_error",
                    "message": "Please check your email and password fields.",
                    "field_errors": field_errors,
                }
            ),
            400,
        )

    try:
        session_data = authenticate_user(
            email=payload.email,
            password=payload.password,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except AuthError as err:
        resp_body = {
            "error": err.code,
            "message": err.message,
        }
        if err.retry_after_seconds is not None:
            resp_body["retry_after_seconds"] = err.retry_after_seconds
        return jsonify(resp_body), err.status_code

    response = make_response(jsonify(session_data), 200)
    _set_refresh_cookie(response, session_data["refresh_token"])
    return response


@auth_bp.post("/refresh")
@limiter.limit("20 per minute")
def refresh():
    """Rotate refresh token and issue a fresh short-lived access token."""
    raw_data = request.get_json(silent=True) or {}
    try:
        parsed = RefreshTokenRequest.model_validate(raw_data)
    except ValidationError:
        parsed = RefreshTokenRequest(refresh_token=None)

    raw_refresh_token = parsed.refresh_token or request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_refresh_token:
        return (
            jsonify(
                {
                    "error": "missing_refresh_token",
                    "message": "Refresh token is required to renew session.",
                }
            ),
            401,
        )

    try:
        session_data = rotate_refresh_token(
            raw_refresh_token=raw_refresh_token,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except AuthError as err:
        response = make_response(
            jsonify({"error": err.code, "message": err.message}),
            err.status_code,
        )
        _clear_refresh_cookie(response)
        return response

    response = make_response(jsonify(session_data), 200)
    _set_refresh_cookie(response, session_data["refresh_token"])
    return response


@auth_bp.post("/logout")
def logout():
    """Revoke active refresh session and clear cookie."""
    raw_data = request.get_json(silent=True) or {}
    raw_refresh_token = raw_data.get("refresh_token") or request.cookies.get(
        REFRESH_COOKIE_NAME
    )

    revoke_session_token(
        raw_refresh_token=raw_refresh_token,
        ip_address=request.remote_addr,
    )

    response = make_response(
        jsonify({"status": "ok", "message": "Signed out successfully."}),
        200,
    )
    _clear_refresh_cookie(response)
    return response


@auth_bp.get("/me")
@require_auth
def get_me():
    """Return currently authenticated user profile and workspaces."""
    user_dict, workspaces_list = serialize_user_and_workspaces(g.current_user)
    return (
        jsonify(
            {
                "user": user_dict,
                "workspaces": workspaces_list,
            }
        ),
        200,
    )
