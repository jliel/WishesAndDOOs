import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from flask import current_app

# OWASP recommended Argon2id parameters
_password_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=19456,  # 19 MiB
    parallelism=1,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_access_token(
    user_id: str,
    email: str,
    default_workspace_id: str | None = None,
) -> str:
    """Create a short-lived signed JWT access token (default 15 minutes)."""
    now = datetime.now(timezone.utc)
    expires_delta: timedelta = current_app.config.get(
        "JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=15)
    )
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "workspace_id": default_workspace_id,
        "type": "access",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    secret = current_app.config["JWT_SECRET_KEY"]
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a signed JWT access token. Raises jwt.PyJWTError on invalid/expired."""
    secret = current_app.config["JWT_SECRET_KEY"]
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def hash_refresh_token(raw_token: str) -> str:
    """Return the SHA-256 hex digest of a refresh token for database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Generate a high-entropy cryptographic refresh token and its SHA-256 hash."""
    raw_token = secrets.token_urlsafe(48)
    return raw_token, hash_refresh_token(raw_token)
