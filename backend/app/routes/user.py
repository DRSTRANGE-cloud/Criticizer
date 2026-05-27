from collections import Counter

from fastapi import APIRouter, Depends, HTTPException

from app.db import reviews_collection, users_collection, watchlist_collection
from app.deps import get_current_user
from app.services.ratings import RATING_LABELS
from app.services.recommendations import user_recommendations

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

    genres = [r.get("primary_genre") for r in reviews if r.get("primary_genre")]
    favorite_category = None
    if genres:
        favorite_category = Counter(genres).most_common(1)[0][0]

    rating_breakdown = {label: 0 for label in RATING_LABELS}
    for r in reviews:
        lab = r.get("rating_label")
        if lab in rating_breakdown:
            rating_breakdown[lab] += 1

    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "avatar": user.get("avatar", ""),
        "joined_date": user.get("created_at", ""),
        "total_reviews": len(reviews),
        "watchlist_count": watchlist_count,
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
    except Exception as e:
        return {"movies": [], "error": str(e)}
