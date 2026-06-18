from __future__ import annotations

import asyncio
import re
from typing import Any

from app.db import discussions_collection, reviews_collection
from app.services.ai_chat.intents import ChatIntent, detect_mood, extract_title_candidates
from app.services.recommendations import recommend_for_query
from app.services.tmdb import (
    media_details,
    person_combined_credits,
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

    labels = [row.get("rating_label") for row in reviews if row.get("rating_label")]
    return {
        "movie_id": movie_id,
        "review_count": len(reviews),
        "discussion_posts": len(posts),
        "rating_labels": labels[:15],
        "sample_snippets": [(row.get("review_text") or "")[:120] for row in reviews[:5] if row.get("review_text")],
    }


async def gather_context(
    message: str,
    intent: ChatIntent,
    taste: dict | None,
    user_id: str | None = None,
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

    if intent in {
        ChatIntent.RECOMMENDATION,
        ChatIntent.MOOD,
        ChatIntent.GENERAL,
        ChatIntent.GROUP,
        ChatIntent.DECISION,
        ChatIntent.TRENDING,
    }:
        tasks.append(
            (
                "candidate_recommendations",
                recommend_for_query(message, taste=taste, user_id=user_id, limit=8),
            )
        )

    if intent == ChatIntent.STREAMING:
        for hint in title_hints or [message]:
            clean = re.sub(r"\b(where|can|i|watch|streaming|on|netflix|please)\b", "", hint, flags=re.I).strip()
            if len(clean) > 2:
                tasks.append(("search_title", search_movies(clean, page=1)))
                break

    if intent == ChatIntent.CAST_CREW:
        person_match = re.search(
            r"(?:directed by|director|starring|movies by|films by|actor|actress|with)\s+([A-Za-z][A-Za-z\s.'-]{2,60})",
            message,
            re.I,
        )
        if person_match:
            person_name = person_match.group(1).strip()

            async def _person_workflow(name: str = person_name):
                people = await search_person(name)
                if not people:
                    return {"people": [], "filmography": []}
                top = people[0]
                credits = await person_combined_credits(top["id"])
                return {"people": people[:3], "filmography": credits[:12], "focus": top}

            tasks.append(("cast_crew", _person_workflow()))

    if intent == ChatIntent.DISCUSSION:
        for hint in title_hints:
            async def _discussion_lookup(name: str = hint):
                movies, _, _, _ = await search_movies(name, page=1)
                if not movies:
                    return {}
                movie_id = movies[0].get("slug") or movies[0].get("id")
                return await _discussion_summary(str(movie_id))

            tasks.append(("community", _discussion_lookup()))
            break

    if intent == ChatIntent.COMPARE:
        parts = re.split(r"\s+vs\.?\s+|\s+versus\s+", message, flags=re.I)
        if len(parts) >= 2:
            tasks.append(("compare_titles", resolve_movie_titles([parts[0][-40:], parts[1][:40]])))

    results: dict[str, Any] = {}
    if tasks:
        keys = [key for key, _ in tasks]
        coros = [coro for _, coro in tasks]
        gathered = await asyncio.gather(*coros, return_exceptions=True)
        for key, value in zip(keys, gathered):
            if isinstance(value, Exception):
                continue
            if key == "search_title" and isinstance(value, tuple):
                results[key] = value[0]
            else:
                results[key] = value

    if title_hints and not results.get("focus_movie"):
        try:
            movies, _, _, _ = await search_movies(title_hints[0], page=1)
            if movies:
                slug = movies[0].get("slug") or movies[0].get("id")
                results["focus_movie"] = await media_details(str(slug))
        except Exception:
            pass

    if intent == ChatIntent.STREAMING and results.get("search_title"):
        movies = results["search_title"]
        if movies:
            focus = movies[0]
            year = (focus.get("release_date") or "")[:4] or None
            providers = await fetch_watchmode_sources(focus.get("title") or "", year)
            results["where_to_watch"] = providers[:8]
            results["focus_movie"] = focus

    ctx["data"] = results
    if taste:
        ctx["taste_summary"] = taste.get("taste_summary")
        ctx["favorite_genres"] = taste.get("favorite_genres", [])
    return ctx
