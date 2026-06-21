from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=30)
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class OAuthLogin(BaseModel):
    provider: str
    credential: str | None = None
    code: str | None = None
    redirect_uri: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict[str, Any]
