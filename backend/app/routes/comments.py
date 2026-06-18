from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.db import comments_collection, users_collection
from app.deps import get_current_user
from app.models.reviews import CommentCreate

router = APIRouter(prefix="/api/comments", tags=["comments"])


def _hydrate(comment: dict) -> dict:
    comment["_id"] = str(comment["_id"])
    user = users_collection.find_one({"user_id": comment["user_id"]})
    comment["username"] = user.get("username", "User") if user else "User"
    comment["avatar"] = user.get("avatar", "") if user else ""
    return comment


@router.get("/review/{review_id}")
async def get_review_comments(review_id: str):
    comments = list(comments_collection.find({"review_id": review_id}).sort("created_at", 1))
    top_level = []
    replies_by_parent: dict[str, list[dict]] = {}

    for raw in comments:
        comment = _hydrate(raw)
        parent_id = comment.get("parent_comment_id")
        if parent_id:
            replies_by_parent.setdefault(parent_id, []).append(comment)
        else:
            top_level.append(comment)

    for comment in top_level:
        comment["replies"] = replies_by_parent.get(comment["comment_id"], [])

    return {"comments": top_level, "count": len(comments)}


@router.get("/user/{user_id}")
async def get_user_comments(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Comments are private")

    rows = list(comments_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50))
    comments = []
    for row in rows:
        comments.append(_hydrate(row))
    return {"comments": comments}


@router.post("/create")
async def create_comment(payload: CommentCreate, current_user: dict = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text is required")
    if len(text) > 800:
        raise HTTPException(status_code=400, detail="Comment is too long")

    if payload.parent_comment_id:
        parent = comments_collection.find_one({"comment_id": payload.parent_comment_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.get("parent_comment_id"):
            raise HTTPException(status_code=400, detail="Only one reply level is supported")

    comment_id = str(uuid.uuid4())
    comments_collection.insert_one(
        {
            "comment_id": comment_id,
            "review_id": payload.review_id,
            "user_id": current_user["user_id"],
            "text": text,
            "parent_comment_id": payload.parent_comment_id,
            "likes": 0,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"comment_id": comment_id, "message": "Comment added"}


@router.post("/like/{comment_id}")
async def like_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    result = comments_collection.update_one({"comment_id": comment_id}, {"$inc": {"likes": 1}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"message": "Comment liked"}


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    comment = comments_collection.find_one({"comment_id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    comments_collection.delete_many(
        {"$or": [{"comment_id": comment_id}, {"parent_comment_id": comment_id}]}
    )
    return {"message": "Comment deleted"}
