import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.db import watchlist_collection
from app.models.reviews import WatchlistItem
from app.services.tmdb import media_details

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

VALID_STATUSES = {"watchlist", "watch_later", "watched"}


@router.post("/add")
async def add_to_watchlist(item: WatchlistItem, current_user: dict = Depends(get_current_user)):
    status = (item.status or "watchlist").strip().lower()
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid watch status")

    existing = watchlist_collection.find_one(
        {"user_id": current_user["user_id"], "movie_id": item.movie_id}
    )
    if existing:
        watchlist_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": status}},
        )
        return {"message": "Watch status updated", "status": status}

    watchlist_collection.insert_one(
        {
            "user_id": current_user["user_id"],
            "movie_id": item.movie_id,
            "status": status,
        }
    )
    return {"message": "Movie saved", "status": status}


@router.delete("/remove/{movie_id}")
async def remove_from_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    watchlist_collection.delete_one({"user_id": current_user["user_id"], "movie_id": movie_id})
    return {"message": "Movie removed from watchlist"}


@router.get("/get")
async def get_watchlist(status: str | None = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["user_id"]}
    if status:
        status = status.strip().lower()
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid watch status")
        query["status"] = status
    items = list(watchlist_collection.find(query))
    if not items:
        return {"movies": [], "items": [], "movie_ids": []}

    movie_ids = [item["movie_id"] for item in items]
    status_by_movie = {item["movie_id"]: item.get("status", "watchlist") for item in items}

    async def _one(mid: str):
        try:
            details = await media_details(mid)
            details["watch_status"] = status_by_movie.get(mid, "watchlist")
            return details
        except Exception:
            return None

    movies = [m for m in await asyncio.gather(*[_one(mid) for mid in movie_ids]) if m]
    grouped = {key: [] for key in VALID_STATUSES}
    for movie in movies:
        grouped[movie["watch_status"]].append(movie)
    return {"movies": movies, "items": grouped, "movie_ids": movie_ids}


@router.get("/check/{movie_id}")
async def check_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    item = watchlist_collection.find_one({"user_id": current_user["user_id"], "movie_id": movie_id})
    if not item:
        return {"in_watchlist": False, "status": None}
    return {"in_watchlist": True, "status": item.get("status", "watchlist")}

