from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.db import reviews_collection, users_collection
from app.models.reviews import ReviewCreate, ReviewLikePayload
from app.services.ratings import empty_distribution, RATING_LABELS
from app.services.tmdb import movie_details

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


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
        md = await movie_details(review.movie_id)
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
                md = await movie_details(mid)
                review["movie_title"] = md.get("title") or "Unknown"
                review["movie_poster"] = md.get("poster_path")
            except Exception:
                review["movie_title"] = "Unknown"
                review["movie_poster"] = None
    return {"reviews": reviews}


@router.post("/like")
async def like_review(payload: ReviewLikePayload, current_user: dict = Depends(get_current_user)):
    result = reviews_collection.update_one({"review_id": payload.review_id}, {"$inc": {"likes": 1}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"message": "Review liked"}

