from __future__ import annotations

import asyncio
import re
from typing import Any

from app.db import discussions_collection, reviews_collection
from app.services.ai_chat.intents import (
    MOOD_GENRE_IDS,
    ChatIntent,
    detect_mood,
    extract_title_candidates,
)
from app.services.tmdb import (
    discover_movies_filtered,
    media_details,
    person_movie_credits,
    resolve_movie_titles,
    search_movies,
    search_person,
    trending_anime,
    trending_mixed,
)
from app.services.watchmode import fetch_watchmode_sources


async def _discussion_summary(movie_id: str) -> dict[str, Any]:
    reviews = list(reviews_collection.find({"movie_id": movie_id}).limit(30))
    posts = list(discussions_collection.find({"movie_id": movie_id}).limit(20))
    if not reviews and not posts:
        return {"movie_id": movie_id, "review_count": 0, "sample_reviews": []}

    labels = [r.get("rating_label") for r in reviews if r.get("rating_label")]
    return {
        "movie_id": movie_id,
        "review_count": len(reviews),
        "discussion_posts": len(posts),
        "rating_labels": labels[:15],
        "sample_snippets": [
            (r.get("review_text") or "")[:120]
            for r in reviews[:5]
            if r.get("review_text")
        ],
    }


async def gather_context(
    message: str,
    intent: ChatIntent,
    taste: dict | None,
) -> dict[str, Any]:
    ctx: dict[str, Any] = {"intent": intent.value, "message": message}
    tasks: list[tuple[str, Any]] = []

    mood = detect_mood(message)
    if mood:
        ctx["detected_mood"] = mood

    title_hints = extract_title_candidates(message)
    if title_hints:
        tasks.append(("referenced_titles", resolve_movie_titles(title_hints)))

    if intent == ChatIntent.TRENDING or "anime" in message.lower():
        if "anime" in message.lower():
            tasks.append(("trending_anime", trending_anime()))
        else:
            tasks.append(("trending", trending_mixed()))

    if intent == ChatIntent.MOOD and mood:
        genre_ids = MOOD_GENRE_IDS.get(mood, "18")
        tasks.append(
            (
                "mood_picks",
                discover_movies_filtered(page=1, genre_id=genre_ids.split(",")[0], vote_gte=6.5),
            )
        )

    if intent == ChatIntent.STREAMING:
        # try to find a title in the message
        for hint in title_hints or [message]:
            clean = re.sub(
                r"\b(where|can|i|watch|streaming|on|netflix|please)\b",
                "",
                hint,
                flags=re.I,
            ).strip()
            if len(clean) > 3:
                tasks.append(("search_title", search_movies(clean, page=1)))
                break

    if intent == ChatIntent.CAST_CREW:
        person_match = re.search(
            r"(?:directed by|director|starring|movies by|films by)\s+([A-Za-z\s.]+)",
            message,
            re.I,
        )
        if person_match:
            person_name = person_match.group(1).strip()[:60]

            async def _person_workflow(n: str = person_name):
                people = await search_person(n)
                if not people:
                    return {"people": [], "filmography": []}
                top = people[0]
                credits = await person_movie_credits(top["id"])
                return {"people": people[:3], "filmography": credits, "focus": top}

            tasks.append(("cast_crew", _person_workflow()))

    if intent == ChatIntent.DISCUSSION:
        for hint in title_hints:
            async def _disc(h=hint):
                movies, _, _, _ = await search_movies(h, page=1)
                if not movies:
                    return {}
                mid = movies[0].get("slug") or movies[0].get("id")
                return await _discussion_summary(str(mid))

            tasks.append(("community", _disc()))
            break

    if intent in (ChatIntent.RECOMMENDATION, ChatIntent.GENERAL, ChatIntent.GROUP, ChatIntent.DECISION):
        if taste and taste.get("favorite_genres"):
            gid = taste["favorite_genres"][0]
            from app.services.recommendations import _genre_id

            genre_id = _genre_id(gid)
            if genre_id:
                tasks.append(
                    ("taste_discover", discover_movies_filtered(page=1, genre_id=genre_id, vote_gte=6.0))
                )

    if intent == ChatIntent.COMPARE:
        parts = re.split(r"\s+vs\.?\s+|\s+versus\s+", message, flags=re.I)
        if len(parts) >= 2:
            tasks.append(("compare_titles", resolve_movie_titles([parts[0][-40:], parts[1][:40]])))

    results: dict[str, Any] = {}
    if tasks:
        keys = [k for k, _ in tasks]
        coros = [c for _, c in tasks]
        gathered = await asyncio.gather(*coros, return_exceptions=True)
        for key, val in zip(keys, gathered):
            if isinstance(val, Exception):
                continue
            if key == "mood_picks" and isinstance(val, tuple):
                results[key] = val[0]
            elif key == "taste_discover" and isinstance(val, tuple):
                results[key] = val[0]
            elif key == "search_title" and isinstance(val, tuple):
                results[key] = val[0]
            else:
                results[key] = val

    # Streaming providers for first resolved title
    if intent == ChatIntent.STREAMING and results.get("search_title"):
        movies = results["search_title"]
        if movies:
            m = movies[0]
            year = (m.get("release_date") or "")[:4] or None
            providers = await fetch_watchmode_sources(m.get("title") or "", year)
            results["where_to_watch"] = providers[:8]
            results["focus_movie"] = m

    if intent == ChatIntent.EXPLAIN and title_hints:
        try:
            movies, _, _, _ = await search_movies(title_hints[0], page=1)
            if movies:
                slug = movies[0].get("slug") or movies[0].get("id")
                results["focus_movie"] = await media_details(str(slug))
        except Exception:
            pass

    ctx["data"] = results
    if taste:
        ctx["taste_summary"] = taste.get("taste_summary")
        ctx["favorite_genres"] = taste.get("favorite_genres", [])
    return ctx
