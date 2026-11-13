import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.modules.auth.schemas import COMMON_WEAK_PASSWORDS


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=120)
    theme_style: Optional[str] = Field(None, pattern="^(classical|pastel|joyful)$")
    color_mode: Optional[str] = Field(None, pattern="^(system|light|dark)$")
    avatar_url: Optional[str] = Field(None, max_length=512)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=10)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 10:
            raise ValueError("Password must be at least 10 characters long.")
        if value.lower() in COMMON_WEAK_PASSWORDS:
            raise ValueError("This password is too common. Please choose a stronger password.")
        if not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value):
            raise ValueError("Password must include both uppercase and lowercase letters.")
        if not re.search(r"[0-9\W_]", value):
            raise ValueError("Password must include at least one number or symbol.")
        return value


class WorkspaceUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    currency: Optional[str] = Field(None, pattern="^(USD|EUR|GBP|MXN|CAD|JPY)$")
