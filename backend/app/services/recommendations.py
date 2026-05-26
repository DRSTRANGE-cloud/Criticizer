from __future__ import annotations

import asyncio
from collections import Counter

from app.db import reviews_collection, watchlist_collection
from app.services.tmdb import discover_movies_filtered, similar_media, trending_movies

GENRE_NAME_TO_ID: dict[str, str] = {
    "action": "28",
    "adventure": "12",
    "animation": "16",
    "comedy": "35",
    "crime": "80",
    "documentary": "99",
    "drama": "18",
    "family": "10751",
    "fantasy": "14",
    "history": "36",
    "horror": "27",
    "music": "10402",
    "mystery": "9648",
    "romance": "10749",
    "science fiction": "878",
    "sci-fi": "878",
    "thriller": "53",
    "war": "10752",
    "western": "37",
}

HIGH_RATINGS = {"Absolute Cinema", "Peak", "Excellent", "Good"}


def _genre_id(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip().lower()
    if key in GENRE_NAME_TO_ID:
        return GENRE_NAME_TO_ID[key]
    for label, gid in GENRE_NAME_TO_ID.items():
        if label in key or key in label:
            return gid
    return None


async def user_recommendations(user_id: str, limit: int = 12) -> list[dict]:
    reviews = list(reviews_collection.find({"user_id": user_id}))
    wl_items = list(watchlist_collection.find({"user_id": user_id}))

    seeds: list[str] = []
    seen_seeds: set[str] = set()

    for r in sorted(reviews, key=lambda x: x.get("created_at", ""), reverse=True):
        if r.get("rating_label") not in HIGH_RATINGS:
            continue
        mid = r.get("movie_id")
        if mid and mid not in seen_seeds:
            seen_seeds.add(mid)
            seeds.append(mid)
        if len(seeds) >= 3:
            break

    for item in wl_items:
        mid = item.get("movie_id")
        if mid and mid not in seen_seeds:
            seen_seeds.add(mid)
            seeds.append(mid)
        if len(seeds) >= 5:
            break

    exclude: set[str] = {s for s in seeds}
    for item in wl_items:
        if item.get("movie_id"):
            exclude.add(item["movie_id"])
    for r in reviews:
        if r.get("movie_id"):
            exclude.add(r["movie_id"])

    out: list[dict] = []
    out_keys: set[str] = set()

    def _add(movies: list[dict]) -> None:
        for m in movies:
            key = m.get("slug") or f"{m.get('media_type', 'movie')}-{m.get('id')}"
            if not key or key in out_keys:
                continue
            if key in exclude or str(m.get("id")) in exclude:
                continue
            out_keys.add(key)
            out.append(m)
            if len(out) >= limit:
                return

    if seeds:
        similar_batches = await asyncio.gather(
            *[similar_media(mid) for mid in seeds[:3]],
            return_exceptions=True,
        )
        for batch in similar_batches:
            if isinstance(batch, list):
                _add(batch)
            if len(out) >= limit:
                break

    genres = [r.get("primary_genre") for r in reviews if r.get("primary_genre")]
    favorite = Counter(genres).most_common(1)[0][0] if genres else None
    gid = _genre_id(favorite)
    if gid and len(out) < limit:
        try:
            discovered, _, _, _ = await discover_movies_filtered(page=1, genre_id=gid, vote_gte=6.0)
            _add(discovered)
        except Exception:
            pass

    if len(out) < limit:
        try:
            _add(await trending_movies())
        except Exception:
            pass

    return out[:limit]
