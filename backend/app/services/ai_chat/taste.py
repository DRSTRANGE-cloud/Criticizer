from __future__ import annotations

from collections import Counter
from datetime import datetime

from app.db import ai_profiles_collection, reviews_collection, watchlist_collection
from app.services.ratings import RATING_LABELS

HIGH_RATINGS = {"Absolute Cinema", "Peak", "Excellent", "Good"}


def build_taste_profile(user_id: str) -> dict:
    reviews = list(reviews_collection.find({"user_id": user_id}))
    wl = list(watchlist_collection.find({"user_id": user_id}))

    genres = [r.get("primary_genre") for r in reviews if r.get("primary_genre")]
    genre_counts = Counter(genres)
    favorite_genres = [g for g, _ in genre_counts.most_common(4)]

    rating_breakdown = {label: 0 for label in RATING_LABELS}
    for r in reviews:
        lab = r.get("rating_label")
        if lab in rating_breakdown:
            rating_breakdown[lab] += 1

    loved_movie_ids = [
        r["movie_id"]
        for r in reviews
        if r.get("rating_label") in HIGH_RATINGS and r.get("movie_id")
    ][:8]
    watchlist_ids = [w["movie_id"] for w in wl if w.get("movie_id")][:12]

    summary_parts = []
    if favorite_genres:
        summary_parts.append(
            "You seem to enjoy " + ", ".join(favorite_genres[:3]) + "."
        )
    if loved_movie_ids:
        summary_parts.append(f"You've highly rated {len(loved_movie_ids)} titles on Criticizer.")
    if watchlist_ids:
        summary_parts.append(f"My List has {len(watchlist_ids)} saved titles.")

    taste_summary = " ".join(summary_parts) if summary_parts else (
        "Still learning your taste — rate and save movies to unlock sharper picks."
    )

    profile = {
        "user_id": user_id,
        "taste_summary": taste_summary,
        "favorite_genres": favorite_genres,
        "rating_breakdown": rating_breakdown,
        "loved_movie_ids": loved_movie_ids,
        "watchlist_ids": watchlist_ids,
        "total_reviews": len(reviews),
        "updated_at": datetime.utcnow().isoformat(),
    }

    ai_profiles_collection.update_one(
        {"user_id": user_id},
        {"$set": profile},
        upsert=True,
    )
    return profile


def get_taste_profile(user_id: str | None) -> dict | None:
    if not user_id:
        return None
    doc = ai_profiles_collection.find_one({"user_id": user_id})
    if doc:
        doc.pop("_id", None)
        return doc
    return build_taste_profile(user_id)
