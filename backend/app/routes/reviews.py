from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.db import comments_collection, reviews_collection, users_collection
from app.models.reviews import ReviewCreate, ReviewLikePayload
from app.services.ratings import empty_distribution, RATING_LABELS
from app.services.tmdb import media_details

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


def _display_name(user_id: str | None) -> str:
    if not user_id:
        return "Criticizer user"
    user = users_collection.find_one({"user_id": user_id})
    return (user or {}).get("username") or "Criticizer user"


def _clip(text: str | None, limit: int = 180) -> str:
    value = (text or "").strip()
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1].rstrip()}..."


@router.post("/create")
async def create_review(review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    if review.rating_label not in RATING_LABELS:
        raise HTTPException(status_code=400, detail="Invalid rating label")

    existing_review = reviews_collection.find_one(
        {"user_id": current_user["user_id"], "movie_id": review.movie_id}
    )
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this movie")

    try:
        md = await media_details(review.movie_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid movie or TMDB unavailable") from None

    genres = md.get("genres") or []
    primary_genre = genres[0] if genres else None

    review_id = str(uuid.uuid4())
    new_review = {
        "review_id": review_id,
        "user_id": current_user["user_id"],
        "movie_id": review.movie_id,
        "rating_label": review.rating_label,
        "review_text": review.review_text,
        "created_at": datetime.utcnow().isoformat(),
        "likes": 0,
        "primary_genre": primary_genre,
    }
    reviews_collection.insert_one(new_review)
    return {"message": "Review created successfully", "review_id": review_id}


@router.get("/movie/{movie_id}")
async def get_movie_reviews(movie_id: str):
    reviews = list(reviews_collection.find({"movie_id": movie_id}))
    for review in reviews:
        review["_id"] = str(review["_id"])
        user = users_collection.find_one({"user_id": review["user_id"]})
        if user:
            review["username"] = user["username"]
            review["avatar"] = user.get("avatar", "")

    dist = empty_distribution()
    for r in reviews:
        label = r.get("rating_label")
        if label in dist:
            dist[label] += 1

    return {"reviews": reviews, "rating_distribution": dist, "total_votes": len(reviews)}


@router.get("/user/{user_id}")
async def get_user_reviews(user_id: str):
    reviews = list(reviews_collection.find({"user_id": user_id}))
    for review in reviews:
        review["_id"] = str(review["_id"])
        mid = review.get("movie_id")
        if mid:
            try:
                md = await media_details(mid)
                review["movie_title"] = md.get("title") or "Unknown"
                review["movie_poster"] = md.get("poster_path")
            except Exception:
                review["movie_title"] = "Unknown"
                review["movie_poster"] = None
    return {"reviews": reviews}


@router.get("/feed/recent")
async def recent_review_feed(limit: int = 8):
    safe_limit = max(1, min(limit, 12))
    reviews = list(reviews_collection.find({}).sort("created_at", -1).limit(safe_limit))
    comments = list(comments_collection.find({}).sort("created_at", -1).limit(safe_limit))
    items = []

    async def add_item(row: dict, item_type: str, review_row: dict | None = None):
        source = review_row or row
        movie_id = source.get("movie_id")
        if not movie_id:
            return
        try:
            md = await media_details(movie_id)
        except Exception:
            md = {}

        items.append(
            {
                "id": row.get("review_id") or row.get("comment_id") or str(row.get("_id")),
                "type": item_type,
                "movie_id": movie_id,
                "movie_slug": md.get("slug") or movie_id,
                "movie_title": md.get("title") or "Unknown title",
                "movie_poster": md.get("poster_path"),
                "username": _display_name(row.get("user_id")),
                "text": _clip(row.get("review_text") or row.get("text")),
                "rating_label": source.get("rating_label"),
                "created_at": row.get("created_at"),
            }
        )

    for review in reviews:
        await add_item(review, "review")

    for comment in comments:
        parent = reviews_collection.find_one({"review_id": comment.get("review_id")})
        await add_item(comment, "comment", parent)

    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return {"items": items[:safe_limit]}


@router.post("/like")
async def like_review(payload: ReviewLikePayload, current_user: dict = Depends(get_current_user)):
    review = reviews_collection.find_one({"review_id": payload.review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    liked_by = review.get("liked_by") or []
    user_id = current_user["user_id"]
    if user_id in liked_by:
        reviews_collection.update_one(
            {"review_id": payload.review_id},
            {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}},
        )
        return {"liked": False, "likes": max(0, int(review.get("likes", 0)) - 1)}
    reviews_collection.update_one(
        {"review_id": payload.review_id},
        {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}},
    )
    return {"liked": True, "likes": int(review.get("likes", 0)) + 1}


@router.delete("/{review_id}")
async def delete_review(review_id: str, current_user: dict = Depends(get_current_user)):
    review = reviews_collection.find_one({"review_id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")

    reviews_collection.delete_one({"review_id": review_id})
    comments_collection.delete_many({"review_id": review_id})
    return {"message": "Review deleted"}

