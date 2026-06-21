from datetime import datetime
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
import httpx

from app.config import settings
from app.deps import get_current_user
from app.db import users_collection
from app.models.auth import OAuthLogin, Token, UserCreate, UserLogin
from app.utils.security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _find_user_by_email(email: str):
    """Match user by email case-insensitively (handles legacy mixed-case documents)."""
    raw = (email or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    u = users_collection.find_one({"email": lowered})
    if u:
        return u
    return users_collection.find_one({"email": {"$regex": f"^{re.escape(raw)}$", "$options": "i"}})


def _safe_username(value: str | None, fallback: str) -> str:
    raw = (value or fallback).strip().split("@")[0]
    cleaned = re.sub(r"[^A-Za-z0-9_.-]", "", raw)[:24] or fallback
    candidate = cleaned if len(cleaned) >= 3 else f"user_{cleaned}".strip("_")
    base = candidate[:24]
    suffix = 0
    while users_collection.find_one({"username": candidate}):
        suffix += 1
        candidate = f"{base[:20]}{suffix}"
    return candidate


def _token_response(user: dict) -> dict:
    access_token = create_access_token(subject=user["user_id"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "username": user["username"],
            "avatar": user.get("avatar", ""),
            "role": user.get("role", "user"),
            "provider": user.get("provider", "local"),
        },
    }


def _upsert_oauth_user(*, provider: str, email: str, username: str | None, avatar: str | None) -> dict:
    email_norm = email.strip().lower()
    if not email_norm:
        raise HTTPException(status_code=400, detail="OAuth provider did not return an email")

    existing = _find_user_by_email(email_norm)
    if existing:
        updates = {
            "provider": existing.get("provider") or provider,
            "email": email_norm,
            "avatar": avatar or existing.get("avatar", ""),
            "updated_at": datetime.utcnow().isoformat(),
        }
        users_collection.update_one({"user_id": existing["user_id"]}, {"$set": updates})
        existing.update(updates)
        return existing

    user_id = str(uuid.uuid4())
    uname = _safe_username(username, f"{provider}_{user_id[:8]}")
    new_user = {
        "user_id": user_id,
        "email": email_norm,
        "username": uname,
        "password_hash": "",
        "created_at": datetime.utcnow().isoformat(),
        "avatar": avatar or f"https://ui-avatars.com/api/?name={uname}&background=random",
        "provider": provider,
        "role": "user",
    }
    users_collection.insert_one(new_user)
    return new_user


async def _verify_google(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    payload = response.json()
    if payload.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    if payload.get("email_verified") not in (True, "true", "True", "1"):
        raise HTTPException(status_code=401, detail="Google email is not verified")
    return {
        "email": payload.get("email"),
        "username": payload.get("name") or payload.get("email"),
        "avatar": payload.get("picture"),
    }


async def _verify_github(code: str, redirect_uri: str | None) -> dict:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured")
    token_data = {
        "client_id": settings.github_client_id,
        "client_secret": settings.github_client_secret,
        "code": code,
    }
    if redirect_uri:
        token_data["redirect_uri"] = redirect_uri
    async with httpx.AsyncClient(timeout=12) as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data=token_data,
        )
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if token_response.status_code != 200 or not access_token:
            raise HTTPException(status_code=401, detail="Invalid GitHub authorization code")

        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
        user_response = await client.get("https://api.github.com/user", headers=headers)
        email_response = await client.get("https://api.github.com/user/emails", headers=headers)
    if user_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Unable to verify GitHub user")
    user_payload = user_response.json()
    email = user_payload.get("email")
    if not email and email_response.status_code == 200:
        for item in email_response.json():
            if item.get("primary") and item.get("verified"):
                email = item.get("email")
                break
    return {
        "email": email,
        "username": user_payload.get("login") or user_payload.get("name"),
        "avatar": user_payload.get("avatar_url"),
    }


@router.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    email_norm = user.email.strip().lower()
    existing_user = users_collection.find_one({"email": email_norm})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    uname = user.username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,30}", uname):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 characters and use only letters, numbers, dots, dashes, or underscores",
        )
    existing_username = users_collection.find_one({"username": uname})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user.password)

    new_user = {
        "user_id": user_id,
        "email": email_norm,
        "username": uname,
        "password_hash": hashed_password,
        "created_at": datetime.utcnow().isoformat(),
        "avatar": f"https://ui-avatars.com/api/?name={uname}&background=random",
        "provider": "local",
        "role": "user",
    }

    users_collection.insert_one(new_user)
    return _token_response(new_user)


@router.post("/login", response_model=Token)
async def login(user: UserLogin):
    db_user = _find_user_by_email(str(user.email))
    if not db_user or not verify_password(user.password, db_user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return _token_response(db_user)


@router.post("/oauth", response_model=Token)
async def oauth_login(payload: OAuthLogin):
    provider = payload.provider.strip().lower()
    if provider == "google":
        if not payload.credential:
            raise HTTPException(status_code=400, detail="Google credential is required")
        profile = await _verify_google(payload.credential)
    elif provider == "github":
        if not payload.code:
            raise HTTPException(status_code=400, detail="GitHub authorization code is required")
        profile = await _verify_github(payload.code, payload.redirect_uri)
    else:
        raise HTTPException(status_code=400, detail="Unsupported OAuth provider")

    user = _upsert_oauth_user(
        provider=provider,
        email=profile.get("email") or "",
        username=profile.get("username"),
        avatar=profile.get("avatar"),
    )
    return _token_response(user)


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "username": current_user["username"],
        "avatar": current_user.get("avatar", ""),
        "role": current_user.get("role", "user"),
        "provider": current_user.get("provider", "local"),
    }

