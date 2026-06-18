from collections import Counter

from fastapi import APIRouter, Depends, HTTPException

from app.db import chat_history_collection, reviews_collection, users_collection, watchlist_collection
from app.deps import get_current_user
from app.services.ratings import RATING_LABELS
from app.services.recommendations import user_recommendations
from app.services.wrapped import build_wrapped

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/profile/{user_id}")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Profile is private")

    user = users_collection.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reviews = list(reviews_collection.find({"user_id": user_id}))
    watchlist_count = watchlist_collection.count_documents({"user_id": user_id})
    watched_count = watchlist_collection.count_documents({"user_id": user_id, "status": "watched"})
    chat_count = chat_history_collection.count_documents({"user_id": user_id, "role": "user"})

    genres = [row.get("primary_genre") for row in reviews if row.get("primary_genre")]
    favorite_category = Counter(genres).most_common(1)[0][0] if genres else None

    rating_breakdown = {label: 0 for label in RATING_LABELS}
    for review in reviews:
        label = review.get("rating_label")
        if label in rating_breakdown:
            rating_breakdown[label] += 1

    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "avatar": user.get("avatar", ""),
        "joined_date": user.get("created_at", ""),
        "total_reviews": len(reviews),
        "watchlist_count": watchlist_count,
        "watched_count": watched_count,
        "chat_count": chat_count,
        "favorite_category": favorite_category,
        "rating_breakdown": rating_breakdown,
    }


@router.get("/recommendations/{user_id}")
async def get_user_recommendations(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Recommendations are private")

    user = users_collection.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        movies = await user_recommendations(user_id)
        return {"movies": movies, "error": None}
    except Exception as exc:
        return {"movies": [], "error": str(exc)}


@router.get("/wrapped/{user_id}")
async def get_wrapped(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Wrapped is private")

    user = users_collection.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        return await build_wrapped(user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
