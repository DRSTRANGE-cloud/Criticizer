from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import discussions_collection, users_collection
from app.deps import get_current_user

router = APIRouter(prefix="/api/discussions", tags=["discussions"])


class DiscussionCreate(BaseModel):
    movie_id: str
    text: str = Field(..., min_length=1, max_length=200)


class DiscussionReply(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)


@router.get("/movie/{movie_id}")
async def list_discussions(movie_id: str):
    rows = list(discussions_collection.find({"movie_id": movie_id}).sort("created_at", -1).limit(50))
    out = []
    for row in rows:
        user = users_collection.find_one({"user_id": row["user_id"]})
        out.append(
            {
                "discussion_id": row["discussion_id"],
                "movie_id": row["movie_id"],
                "text": row["text"],
                "likes": row.get("likes", 0),
                "reply_count": row.get("reply_count", 0),
                "created_at": row["created_at"],
                "username": user.get("username", "User") if user else "User",
                "avatar": user.get("avatar", "") if user else "",
            }
        )
    return {"posts": out}


@router.post("/create")
async def create_discussion(payload: DiscussionCreate, current_user: dict = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    did = str(uuid.uuid4())
    discussions_collection.insert_one(
        {
            "discussion_id": did,
            "movie_id": payload.movie_id,
            "user_id": current_user["user_id"],
            "text": text,
            "likes": 0,
            "reply_count": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"message": "Posted", "discussion_id": did}


@router.post("/like/{discussion_id}")
async def like_discussion(discussion_id: str, current_user: dict = Depends(get_current_user)):
    result = discussions_collection.update_one({"discussion_id": discussion_id}, {"$inc": {"likes": 1}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Liked"}


@router.post("/reply/{discussion_id}")
async def reply_discussion(discussion_id: str, payload: DiscussionReply, current_user: dict = Depends(get_current_user)):
    result = discussions_collection.update_one({"discussion_id": discussion_id}, {"$inc": {"reply_count": 1}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Reply count updated"}
