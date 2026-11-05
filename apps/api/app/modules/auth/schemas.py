import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

COMMON_WEAK_PASSWORDS = {
    "password123",
    "password1234",
    "1234567890",
    "qwertyuiop",
    "letmein1234",
    "welcome1234",
    "admin12345",
}

SUPPORTED_CURRENCIES = {"USD", "MXN", "EUR", "GBP", "CAD"}


class LoginRequest(BaseModel):
    """Pydantic v2 schema for email + password sign-in."""

    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Please enter a valid email address.")
        return normalized


class RegisterRequest(BaseModel):
    """Pydantic v2 schema for new user & Personal Workspace registration."""

    display_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=256)
    currency: str = Field(default="USD", min_length=3, max_length=8)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        cleaned = " ".join(value.strip().split())
        if len(cleaned) < 2:
            raise ValueError("Display name must be at least 2 characters.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_and_normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_REGEX.match(normalized):
            raise ValueError("Please enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("Password must be at least 10 characters long.")
        if value.lower() in COMMON_WEAK_PASSWORDS:
            raise ValueError(
                "This password is too common. Please choose a stronger password."
            )
        if not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value):
            raise ValueError(
                "Password must include both uppercase and lowercase letters."
            )
        if not re.search(r"[\d\W_]", value):
            raise ValueError(
                "Password must include at least one number or symbol."
            )
        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        code = value.strip().upper()
        if code not in SUPPORTED_CURRENCIES:
            raise ValueError(
                f"Currency must be one of: {', '.join(sorted(SUPPORTED_CURRENCIES))}."
            )
        return code


class RefreshTokenRequest(BaseModel):
    """Optional JSON body for refresh token rotation (cookie fallback supported)."""

    refresh_token: str | None = Field(default=None, min_length=16, max_length=512)


class WorkspaceSummarySchema(BaseModel):
    id: str
    name: str
    type: str
    currency: str
    role: str


class UserProfileSchema(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    theme_style: Literal["classical", "pastel", "joyful"] = "classical"
    color_mode: Literal["light", "dark", "system"] = "system"
    is_email_verified: bool = True
    is_2fa_enabled: bool = False
