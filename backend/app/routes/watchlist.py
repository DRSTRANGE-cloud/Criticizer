import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.db import watchlist_collection
from app.models.reviews import WatchlistItem
from app.services.tmdb import media_details

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

VALID_STATUSES = {"watchlist", "watched"}
# Legacy status merged into watchlist
_LEGACY_WATCH_LATER = "watch_later"


def _normalize_status(status: str | None) -> str:
    s = (status or "watchlist").strip().lower()
    if s == _LEGACY_WATCH_LATER:
        return "watchlist"
    return s


def _movie_snapshot(details: dict) -> dict:
    return {
        "id": details.get("id"),
        "slug": details.get("slug"),
        "media_type": details.get("media_type", "movie"),
        "title": details.get("title", ""),
        "poster_path": details.get("poster_path"),
        "backdrop_path": details.get("backdrop_path"),
        "release_date": details.get("release_date", ""),
        "vote_average": details.get("vote_average", 0),
        "overview": (details.get("overview") or "")[:200],
    }


def _from_snapshot(item: dict) -> dict | None:
    snap = item.get("movie_snapshot")
    if not snap or not snap.get("id"):
        return None
    return {
        **snap,
        "watch_status": _normalize_status(item.get("status")),
    }


@router.post("/add")
async def add_to_watchlist(item: WatchlistItem, current_user: dict = Depends(get_current_user)):
    status = _normalize_status(item.status)
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid watch status")

    snapshot = None
    try:
        details = await media_details(item.movie_id)
        snapshot = _movie_snapshot(details)
    except Exception:
        pass

    existing = watchlist_collection.find_one(
        {"user_id": current_user["user_id"], "movie_id": item.movie_id}
    )
    update_fields: dict = {"status": status}
    if snapshot:
        update_fields["movie_snapshot"] = snapshot

    if existing:
        watchlist_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        return {"message": "Watch status updated", "status": status}

    doc = {
        "user_id": current_user["user_id"],
        "movie_id": item.movie_id,
        "status": status,
    }
    if snapshot:
        doc["movie_snapshot"] = snapshot
    watchlist_collection.insert_one(doc)
    return {"message": "Movie saved", "status": status}


@router.delete("/remove/{movie_id}")
async def remove_from_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    watchlist_collection.delete_one({"user_id": current_user["user_id"], "movie_id": movie_id})
    return {"message": "Movie removed from watchlist"}


@router.get("/get")
async def get_watchlist(status: str | None = None, current_user: dict = Depends(get_current_user)):
    query: dict = {"user_id": current_user["user_id"]}
    if status:
        status = _normalize_status(status)
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid watch status")
        if status == "watchlist":
            query["status"] = {"$in": ["watchlist", _LEGACY_WATCH_LATER]}
        else:
            query["status"] = status

    items = list(watchlist_collection.find(query))
    if not items:
        return {"movies": [], "items": {"watchlist": [], "watched": []}, "movie_ids": []}

    movie_ids = [item["movie_id"] for item in items]
    status_by_movie = {
        item["movie_id"]: _normalize_status(item.get("status")) for item in items
    }

    async def _one(item: dict):
        cached = _from_snapshot(item)
        if cached:
            return cached
        mid = item["movie_id"]
        try:
            details = await media_details(mid)
            details["watch_status"] = status_by_movie.get(mid, "watchlist")
            return details
        except Exception:
            return None

    sem = asyncio.Semaphore(6)

    async def _limited(item: dict):
        async with sem:
            return await _one(item)

    movies = [m for m in await asyncio.gather(*[_limited(i) for i in items]) if m]
    grouped = {key: [] for key in VALID_STATUSES}
    for movie in movies:
        st = movie.get("watch_status", "watchlist")
        grouped[st].append(movie)

    return {"movies": movies, "items": grouped, "movie_ids": movie_ids}


@router.get("/check/{movie_id}")
async def check_watchlist(movie_id: str, current_user: dict = Depends(get_current_user)):
    item = watchlist_collection.find_one({"user_id": current_user["user_id"], "movie_id": movie_id})
    if not item:
        return {"in_watchlist": False, "status": None}
    return {"in_watchlist": True, "status": _normalize_status(item.get("status"))}
