from datetime import datetime
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.db import users_collection
from app.models.auth import Token, UserCreate, UserLogin
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


@router.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    email_norm = user.email.strip().lower()
    existing_user = users_collection.find_one({"email": email_norm})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    uname = user.username.strip()
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
        "role": "user",
    }

    users_collection.insert_one(new_user)

    access_token = create_access_token(subject=user_id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user_id,
            "email": email_norm,
            "username": uname,
            "avatar": new_user["avatar"],
            "role": "user",
        },
    }


@router.post("/login", response_model=Token)
async def login(user: UserLogin):
    db_user = _find_user_by_email(str(user.email))
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(subject=db_user["user_id"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": db_user["user_id"],
            "email": db_user["email"],
            "username": db_user["username"],
            "avatar": db_user.get("avatar", ""),
            "role": db_user.get("role", "user"),
        },
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "username": current_user["username"],
        "avatar": current_user.get("avatar", ""),
        "role": current_user.get("role", "user"),
    }

