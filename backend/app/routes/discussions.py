from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import discussion_replies_collection, discussions_collection, users_collection
from app.deps import get_current_user, get_optional_user

router = APIRouter(prefix="/api/discussions", tags=["discussions"])


class DiscussionCreate(BaseModel):
    movie_id: str
    text: str = Field(..., min_length=1, max_length=200)


class DiscussionReply(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)
    parent_reply_id: str | None = None


def _user_meta(user_id: str) -> dict:
    user = users_collection.find_one({"user_id": user_id})
    return {
        "username": user.get("username", "User") if user else "User",
        "avatar": user.get("avatar", "") if user else "",
    }


def _toggle_like(collection, id_field: str, doc_id: str, user_id: str) -> dict:
    doc = collection.find_one({id_field: doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    liked_by = doc.get("liked_by") or []
    if user_id in liked_by:
        collection.update_one(
            {id_field: doc_id},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}},
        )
        return {"liked": False, "likes": max(0, int(doc.get("likes", 0)) - 1)}
    collection.update_one(
        {id_field: doc_id},
        {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}},
    )
    return {"liked": True, "likes": int(doc.get("likes", 0)) + 1}


def _hydrate_reply(row: dict) -> dict:
    meta = _user_meta(row["user_id"])
    return {
        "reply_id": row["reply_id"],
        "discussion_id": row["discussion_id"],
        "parent_reply_id": row.get("parent_reply_id"),
        "text": row["text"],
        "likes": row.get("likes", 0),
        "created_at": row["created_at"],
        "username": meta["username"],
        "avatar": meta["avatar"],
        "user_liked": False,
    }


@router.get("/movie/{movie_id}")
async def list_discussions(movie_id: str, current_user: dict | None = Depends(get_optional_user)):
    rows = list(discussions_collection.find({"movie_id": movie_id}).sort("created_at", -1).limit(50))
    discussion_ids = [row["discussion_id"] for row in rows]
    reply_rows = list(
        discussion_replies_collection.find({"discussion_id": {"$in": discussion_ids}}).sort("created_at", 1)
    ) if discussion_ids else []

    replies_by_discussion: dict[str, list[dict]] = {}
    for raw in reply_rows:
        hydrated = _hydrate_reply(raw)
        if current_user:
            hydrated["user_liked"] = current_user["user_id"] in (raw.get("liked_by") or [])
        replies_by_discussion.setdefault(raw["discussion_id"], []).append(hydrated)

    out = []
    user_id = current_user["user_id"] if current_user else None
    for row in rows:
        meta = _user_meta(row["user_id"])
        out.append(
            {
                "discussion_id": row["discussion_id"],
                "movie_id": row["movie_id"],
                "text": row["text"],
                "likes": row.get("likes", 0),
                "reply_count": row.get("reply_count", 0),
                "repost_count": row.get("repost_count", 0),
                "repost_of": row.get("repost_of"),
                "created_at": row["created_at"],
                "username": meta["username"],
                "avatar": meta["avatar"],
                "user_liked": user_id in (row.get("liked_by") or []) if user_id else False,
                "replies": replies_by_discussion.get(row["discussion_id"], []),
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
            "liked_by": [],
            "reply_count": 0,
            "repost_count": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"message": "Posted", "discussion_id": did}


@router.post("/like/{discussion_id}")
async def like_discussion(discussion_id: str, current_user: dict = Depends(get_current_user)):
    return _toggle_like(discussions_collection, "discussion_id", discussion_id, current_user["user_id"])


@router.post("/reply/{discussion_id}")
async def reply_discussion(
    discussion_id: str,
    payload: DiscussionReply,
    current_user: dict = Depends(get_current_user),
):
    parent = discussions_collection.find_one({"discussion_id": discussion_id})
    if not parent:
        raise HTTPException(status_code=404, detail="Post not found")

    if payload.parent_reply_id:
        parent_reply = discussion_replies_collection.find_one({"reply_id": payload.parent_reply_id})
        if not parent_reply or parent_reply.get("discussion_id") != discussion_id:
            raise HTTPException(status_code=404, detail="Parent reply not found")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Reply text is required")

    reply_id = str(uuid.uuid4())
    discussion_replies_collection.insert_one(
        {
            "reply_id": reply_id,
            "discussion_id": discussion_id,
            "parent_reply_id": payload.parent_reply_id,
            "user_id": current_user["user_id"],
            "text": text,
            "likes": 0,
            "liked_by": [],
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    discussions_collection.update_one({"discussion_id": discussion_id}, {"$inc": {"reply_count": 1}})
    meta = _user_meta(current_user["user_id"])
    return {
        "message": "Reply posted",
        "reply": {
            "reply_id": reply_id,
            "discussion_id": discussion_id,
            "parent_reply_id": payload.parent_reply_id,
            "text": text,
            "likes": 0,
            "created_at": datetime.utcnow().isoformat(),
            "username": meta["username"],
            "avatar": meta["avatar"],
            "user_liked": False,
        },
    }


@router.post("/reply-like/{reply_id}")
async def like_reply(reply_id: str, current_user: dict = Depends(get_current_user)):
    return _toggle_like(discussion_replies_collection, "reply_id", reply_id, current_user["user_id"])


@router.post("/repost/{discussion_id}")
async def repost_discussion(discussion_id: str, current_user: dict = Depends(get_current_user)):
    original = discussions_collection.find_one({"discussion_id": discussion_id})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    reposted_by = original.get("reposted_by") or []
    if current_user["user_id"] in reposted_by:
        raise HTTPException(status_code=400, detail="You already reposted this")

    discussions_collection.update_one(
        {"discussion_id": discussion_id},
        {"$addToSet": {"reposted_by": current_user["user_id"]}, "$inc": {"repost_count": 1}},
    )
    new_id = str(uuid.uuid4())
    discussions_collection.insert_one(
        {
            "discussion_id": new_id,
            "movie_id": original["movie_id"],
            "user_id": current_user["user_id"],
            "text": original["text"],
            "likes": 0,
            "liked_by": [],
            "reply_count": 0,
            "repost_count": 0,
            "repost_of": discussion_id,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"message": "Reposted", "discussion_id": new_id}
