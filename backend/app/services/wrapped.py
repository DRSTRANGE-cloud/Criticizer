from __future__ import annotations

import asyncio
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from app.db import chat_history_collection, reviews_collection, watchlist_collection
from app.services.cache import wrapped_cache
from app.services.recommendations import RATING_LABEL_SCORE
from app.services.tmdb import media_details

DNA_DIMENSIONS = {
    "emotional": {
        "genres": {"Drama", "Family", "Music", "Romance"},
        "keywords": {"friendship", "coming of age", "grief", "love", "loss", "family"},
    },
    "philosophical": {
        "genres": {"Science Fiction", "Mystery", "Documentary"},
        "keywords": {"time travel", "identity", "memory", "space", "existentialism", "dream"},
    },
    "action": {
        "genres": {"Action", "Adventure", "War", "Thriller"},
        "keywords": {"survival", "mission", "battle", "hero", "revenge"},
    },
    "dark": {
        "genres": {"Crime", "Horror", "Thriller", "Mystery"},
        "keywords": {"dystopia", "murder", "revenge", "survival", "obsession"},
    },
    "comedy": {
        "genres": {"Comedy", "Family"},
        "keywords": {"friendship", "road trip", "school", "holiday"},
    },
    "romance": {
        "genres": {"Romance", "Drama"},
        "keywords": {"love", "relationship", "heartbreak", "wedding"},
    },
}

AURA_BY_DIMENSION = {
    "emotional": "Emotional Depth",
    "philosophical": "Cosmic Curiosity",
    "action": "Controlled Chaos",
    "dark": "Rainy Night Energy",
    "comedy": "Warm Escape",
    "romance": "Tender Voltage",
}

ARCHETYPE_BY_DIMENSION = {
    "emotional": "The Dreamer",
    "philosophical": "The Explorer",
    "action": "The Survivor",
    "dark": "The Strategist",
    "comedy": "The Wanderer",
    "romance": "The Romantic",
}

MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _activity_year(rows: list[dict[str, Any]]) -> int:
    years = [dt.year for dt in (_parse_date(row.get("created_at")) for row in rows) if dt]
    return max(years) if years else datetime.utcnow().year


def _top_titles(rows: list[dict[str, Any]], detail_map: dict[str, dict[str, Any]], count: int = 3) -> list[dict[str, Any]]:
    scored: list[tuple[float, dict[str, Any]]] = []
    seen_titles: set[str] = set()
    for row in rows:
        movie_id = row.get("movie_id")
        detail = detail_map.get(str(movie_id))
        if not detail:
            continue
        title = str(detail.get("title") or "")
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        score = float(RATING_LABEL_SCORE.get(row.get("rating_label"), 3.0)) * 10 + float(detail.get("vote_average") or 0)
        scored.append((score, detail))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [detail for _, detail in scored[:count]]


async def _load_details(movie_ids: list[str]) -> dict[str, dict[str, Any]]:
    sem = asyncio.Semaphore(6)

    async def _one(movie_id: str) -> tuple[str, dict[str, Any] | None]:
        async with sem:
            try:
                return movie_id, await media_details(movie_id)
            except Exception:
                return movie_id, None

    rows = await asyncio.gather(*[_one(movie_id) for movie_id in movie_ids], return_exceptions=True)
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, tuple) and row[1]:
            out[row[0]] = row[1]
    return out


def _normalize_scores(raw: dict[str, float]) -> dict[str, int]:
    max_score = max(raw.values()) if raw else 0
    if max_score <= 0:
        return {key: 0 for key in DNA_DIMENSIONS}
    return {key: int(round((value / max_score) * 100)) for key, value in raw.items()}


def _build_dna(detail_map: dict[str, dict[str, Any]], review_rows: list[dict[str, Any]]) -> dict[str, int]:
    score_map = {key: 0.0 for key in DNA_DIMENSIONS}
    for row in review_rows:
        detail = detail_map.get(str(row.get("movie_id")))
        if not detail:
            continue
        weight = RATING_LABEL_SCORE.get(row.get("rating_label"), 3.0)
        genres = set(detail.get("genres") or [])
        keywords = {str(item).lower() for item in (detail.get("keywords") or [])}
        for key, config in DNA_DIMENSIONS.items():
            genre_hits = len(genres & config["genres"])
            keyword_hits = len(keywords & config["keywords"])
            score_map[key] += genre_hits * weight * 1.3 + keyword_hits * weight * 0.9
    return _normalize_scores(score_map)


def _genre_timeline(review_rows: list[dict[str, Any]], detail_map: dict[str, dict[str, Any]], year: int) -> list[dict[str, Any]]:
    buckets: dict[int, Counter[str]] = defaultdict(Counter)
    for row in review_rows:
        dt = _parse_date(row.get("created_at"))
        if not dt or dt.year != year:
            continue
        detail = detail_map.get(str(row.get("movie_id")))
        if not detail:
            continue
        genre = (detail.get("genres") or [row.get("primary_genre") or "Mixed"])[0]
        buckets[dt.month][genre] += 1
    out: list[dict[str, Any]] = []
    for month in sorted(buckets):
        genre, count = buckets[month].most_common(1)[0]
        out.append({"month": MONTH_LABELS[month - 1], "genre": genre, "count": count})
    return out


def _hidden_stats(
    review_rows: list[dict[str, Any]],
    watch_rows: list[dict[str, Any]],
    chat_rows: list[dict[str, Any]],
    detail_map: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    touched_titles = Counter()
    director_counter = Counter()
    actor_counter = Counter()
    night_activity: tuple[datetime | None, str | None] = (None, None)
    longest_movie: dict[str, Any] | None = None

    for row in review_rows + watch_rows:
        movie_id = str(row.get("movie_id") or "")
        detail = detail_map.get(movie_id)
        if not detail:
            continue
        title = detail.get("title")
        if title:
            touched_titles[title] += 1
        if detail.get("director"):
            director_counter[str(detail["director"])] += 1
        for cast_member in (detail.get("cast") or [])[:3]:
            if cast_member.get("name"):
                actor_counter[str(cast_member["name"])] += 1
        if not longest_movie or int(detail.get("runtime") or 0) > int(longest_movie.get("runtime") or 0):
            longest_movie = detail
        dt = _parse_date(row.get("created_at"))
        if dt and (dt.hour >= 21 or dt.hour <= 3):
            if not night_activity[0] or dt > night_activity[0]:
                night_activity = (dt, title)

    most_reviewed_genre = Counter(row.get("primary_genre") for row in review_rows if row.get("primary_genre")).most_common(1)
    revisited = touched_titles.most_common(1)

    return [
        {"label": "Most revisited title", "value": revisited[0][0] if revisited else "Not enough data yet"},
        {"label": "Most reviewed genre", "value": most_reviewed_genre[0][0] if most_reviewed_genre else "Still forming"},
        {"label": "Favorite director", "value": director_counter.most_common(1)[0][0] if director_counter else "Still forming"},
        {"label": "Favorite actor", "value": actor_counter.most_common(1)[0][0] if actor_counter else "Still forming"},
        {
            "label": "Latest night watch",
            "value": night_activity[1] if night_activity[1] else "No late-night activity tracked yet",
        },
        {
            "label": "Longest movie watched",
            "value": (
                f"{longest_movie.get('title')} ({int(longest_movie.get('runtime') or 0)} min)"
                if longest_movie
                else "No runtime data yet"
            ),
        },
        {"label": "AI interactions", "value": str(len(chat_rows))},
    ]


def _life_as_a_movie(top_titles: list[dict[str, Any]], dna: dict[str, int]) -> dict[str, Any]:
    if not top_titles:
        return {
            "headline": "Your story is still loading",
            "combo": "",
            "explanation": "Rate and save more movies to unlock a richer cinematic identity.",
            "themes": [],
            "emotional_profile": "Curious beginnings",
        }

    combo = " x ".join(title.get("title") for title in top_titles[:3] if title.get("title"))
    dominant = max(dna, key=dna.get) if dna else "emotional"
    secondary = sorted(dna.items(), key=lambda item: item[1], reverse=True)[1][0] if len(dna) > 1 else dominant
    explanation = (
        f"Your year blends the wonder of {top_titles[0].get('title')}"
        f"{f', the pull of {top_titles[1].get("title")}' if len(top_titles) > 1 else ''}"
        f"{f', and the edge of {top_titles[2].get("title")}' if len(top_titles) > 2 else ''}. "
        f"That points to a viewer who chases {dominant} stories without losing taste for {secondary} ideas."
    )
    return {
        "headline": "Your Life As A Movie",
        "combo": combo,
        "explanation": explanation,
        "themes": [dominant.title(), secondary.title()],
        "emotional_profile": f"{dominant.title()} with a streak of {secondary.title()}",
    }


def _summary_from_stats(dna: dict[str, int], top_titles: list[dict[str, Any]], timeline: list[dict[str, Any]]) -> str:
    dominant = max(dna, key=dna.get) if dna else "emotional"
    titles = ", ".join(title.get("title") for title in top_titles[:2] if title.get("title"))
    timeline_hint = timeline[-1]["genre"] if timeline else "character-driven stories"
    return (
        f"This year you gravitated toward {dominant} cinema, with standout touchpoints like {titles or 'your top picks'}. "
        f"Your taste kept evolving and recently leaned into {timeline_hint.lower()}."
    )


async def build_wrapped(user_id: str) -> dict[str, Any]:
    cache_key = f"wrapped:{user_id}"
    cached = wrapped_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    reviews = list(reviews_collection.find({"user_id": user_id}))
    watch_items = list(watchlist_collection.find({"user_id": user_id}))
    chat_rows = list(chat_history_collection.find({"user_id": user_id, "role": "user"}))
    all_activity_rows = [*reviews, *watch_items, *chat_rows]
    activity_year = _activity_year(all_activity_rows)

    year_reviews = [row for row in reviews if (_parse_date(row.get("created_at")) or datetime.utcnow()).year == activity_year]
    year_watch_items = [row for row in watch_items if (_parse_date(row.get("created_at")) or datetime.utcnow()).year == activity_year]
    year_chat_rows = [row for row in chat_rows if (_parse_date(row.get("created_at")) or datetime.utcnow()).year == activity_year]

    unique_movie_ids = {
        str(row.get("movie_id"))
        for row in [*year_reviews, *year_watch_items]
        if row.get("movie_id")
    }
    detail_map = await _load_details(list(unique_movie_ids))

    watched_ids = {
        str(row.get("movie_id"))
        for row in year_watch_items
        if row.get("status") == "watched" and row.get("movie_id")
    }
    watched_ids.update(str(row.get("movie_id")) for row in year_reviews if row.get("movie_id"))
    watched_details = [detail_map[movie_id] for movie_id in watched_ids if movie_id in detail_map]

    rating_values = [RATING_LABEL_SCORE.get(row.get("rating_label"), 0) for row in year_reviews if row.get("rating_label")]
    avg_rating = round(sum(rating_values) / len(rating_values), 1) if rating_values else 0
    total_minutes = sum(int(detail.get("runtime") or 0) for detail in watched_details)
    dna = _build_dna(detail_map, year_reviews)
    top_titles = _top_titles(year_reviews, detail_map, count=3)
    timeline = _genre_timeline(year_reviews, detail_map, activity_year)
    dominant_dimension = max(dna, key=dna.get) if dna else "emotional"

    wrapped = {
        "year": activity_year,
        "tagline": "Your Year In Cinema",
        "stats": {
            "movies_watched": len(watched_details),
            "reviews_written": len(year_reviews),
            "average_rating": avg_rating,
            "hours_watched": round(total_minutes / 60, 1) if total_minutes else 0,
        },
        "cinema_dna": dna,
        "life_as_movie": _life_as_a_movie(top_titles, dna),
        "main_character_archetype": {
            "title": ARCHETYPE_BY_DIMENSION.get(dominant_dimension, "The Explorer"),
            "reason": f"Your strongest viewing signal this year was {dominant_dimension}, which shaped how you explored stories.",
        },
        "cinematic_aura": [
            AURA_BY_DIMENSION[key]
            for key, _ in sorted(dna.items(), key=lambda item: item[1], reverse=True)[:3]
            if dna.get(key, 0) > 0
        ],
        "genre_timeline": timeline,
        "hidden_stats": _hidden_stats(year_reviews, year_watch_items, year_chat_rows, detail_map),
        "ai_summary": _summary_from_stats(dna, top_titles, timeline),
        "top_titles": [
            {
                "title": detail.get("title"),
                "slug": detail.get("slug"),
                "poster_path": detail.get("poster_path"),
            }
            for detail in top_titles
        ],
        "share_card": {
            "headline": "Criticizer Wrapped",
            "subheadline": f"{ARCHETYPE_BY_DIMENSION.get(dominant_dimension, 'The Explorer')} | {AURA_BY_DIMENSION.get(dominant_dimension, 'Cinema Lover')}",
            "stat_line": f"{len(watched_details)} watched • {len(year_reviews)} reviews • {round(total_minutes / 60, 1) if total_minutes else 0} hours",
            "feature_title": top_titles[0].get("title") if top_titles else "Your cinema year",
        },
    }
    wrapped_cache.set(cache_key, wrapped, ttl_seconds=900)
    return wrapped
