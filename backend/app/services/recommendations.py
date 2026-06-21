from __future__ import annotations

import asyncio
import re
from collections import Counter, defaultdict
from typing import Any

from app.db import reviews_collection, watchlist_collection
from app.services.cache import recommendation_cache
from app.services.tmdb import (
    collection_media,
    discover_anime,
    discover_movies_filtered,
    discover_tv,
    media_details,
    person_combined_credits,
    recommended_media,
    resolve_movie_titles,
    search_person,
    similar_media,
    trending_movies,
)

GENRE_NAME_TO_ID: dict[str, str] = {
    "action": "28",
    "adventure": "12",
    "animation": "16",
    "anime": "16",
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
    "scifi": "878",
    "thriller": "53",
    "war": "10752",
    "western": "37",
}

LANGUAGE_ALIASES: dict[str, str] = {
    "english": "en",
    "hindi": "hi",
    "japanese": "ja",
    "korean": "ko",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "italian": "it",
}

HIGH_RATINGS = {"Absolute Cinema", "It's Peak", "Excellent", "Good", "Kinda Liked It"}

MIN_SIMILARITY_SCORE = 20.0

RATING_LABEL_SCORE = {
    "Waste of Time": 1.0,
    "Check that Out Once": 2.0,
    "Kinda Liked It": 3.0,
    "It's Peak": 4.0,
    "Absolute Cinema": 5.0,
}

MOOD_TO_GENRE = {
    "emotional": "18",
    "dark": "53",
    "feel-good": "35",
    "relaxing": "10751",
    "romantic": "10749",
    "intense": "28",
    "hype": "12",
}

_TITLE_STOPWORDS = {
    "a",
    "an",
    "and",
    "at",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "part",
    "story",
    "the",
    "to",
    "with",
}


def _genre_id(name: str | None) -> str | None:
    if not name:
        return None
    key = name.strip().lower()
    if key in GENRE_NAME_TO_ID:
        return GENRE_NAME_TO_ID[key]
    for label, genre_id in GENRE_NAME_TO_ID.items():
        if label in key or key in label:
            return genre_id
    return None


def _title_tokens(title: str | None) -> set[str]:
    if not title:
        return set()
    tokens = re.findall(r"[a-z0-9]+", title.lower())
    return {token for token in tokens if token not in _TITLE_STOPWORDS and len(token) > 1}


def _score_similarity(
    base: dict[str, Any],
    candidate: dict[str, Any],
    source: str,
) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    base_collection = (base.get("collection") or {}).get("id")
    candidate_collection = (candidate.get("collection") or {}).get("id")
    if base_collection and candidate_collection and base_collection == candidate_collection:
        score += 60
        reasons.append("same collection")

    title_overlap = len(_title_tokens(base.get("title")) & _title_tokens(candidate.get("title")))
    if title_overlap >= 2:
        score += 24
        reasons.append("same franchise feel")

    shared_genres = len(set(base.get("genre_ids") or []) & set(candidate.get("genre_ids") or []))
    if shared_genres:
        score += min(30, shared_genres * 10)
        reasons.append(f"{shared_genres} shared genres")

    base_director = str(base.get("director_id") or "")
    candidate_director = str(candidate.get("director_id") or "")
    if base_director and candidate_director and base_director == candidate_director:
        score += 18
        reasons.append("same director")

    shared_cast = len(set(base.get("cast_ids") or []) & set(candidate.get("cast_ids") or []))
    if shared_cast:
        score += min(18, shared_cast * 6)
        reasons.append(f"{shared_cast} shared cast")

    shared_keywords = len(
        {str(x).lower() for x in (base.get("keywords") or [])}
        & {str(x).lower() for x in (candidate.get("keywords") or [])}
    )
    if shared_keywords:
        score += min(16, shared_keywords * 4)
        reasons.append("similar themes")

    if base.get("original_language") and base.get("original_language") == candidate.get("original_language"):
        score += 4
        reasons.append("same language")

    if base.get("media_type") == candidate.get("media_type"):
        score += 4

    base_year = base.get("release_year")
    candidate_year = candidate.get("release_year")
    if base_year and candidate_year:
        year_diff = abs(int(base_year) - int(candidate_year))
        if year_diff <= 2:
            score += 10
            reasons.append("similar release era")
        elif year_diff <= 5:
            score += 5
            reasons.append("close release window")

    base_pop = float(base.get("popularity") or 0)
    candidate_pop = float(candidate.get("popularity") or 0)
    if base_pop > 1 and candidate_pop > 1:
        pop_ratio = min(base_pop, candidate_pop) / max(base_pop, candidate_pop)
        if pop_ratio >= 0.45:
            score += 6
            reasons.append("similar popularity tier")

    base_vote = float(base.get("vote_average") or 0)
    candidate_vote = float(candidate.get("vote_average") or 0)
    if base_vote and candidate_vote:
        diff = abs(base_vote - candidate_vote)
        if diff <= 0.8:
            score += 6
            reasons.append("similar audience rating")
        elif diff <= 1.5:
            score += 3

    source_bonus = {
        "collection": 28,
        "recommended": 20,
        "similar": 16,
        "director": 18,
        "cast": 12,
        "discover": 6,
        "personal": 10,
        "trending": 2,
    }.get(source, 0)
    if source_bonus:
        score += source_bonus

    if candidate.get("vote_count", 0) >= 500:
        score += 2

    return score, reasons


async def _details_for_candidate(candidate: dict[str, Any]) -> dict[str, Any] | None:
    slug = str(candidate.get("slug") or candidate.get("id") or "")
    if not slug:
        return None
    try:
        return await media_details(slug)
    except Exception:
        return None


async def _load_candidate_details(candidates: list[dict[str, Any]], limit: int = 30) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(6)

    async def _one(candidate: dict[str, Any]) -> dict[str, Any] | None:
        async with sem:
            return await _details_for_candidate(candidate)

    rows = await asyncio.gather(*[_one(item) for item in candidates[:limit]], return_exceptions=True)
    out: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict) and row.get("id"):
            out.append(row)
    return out


async def weighted_similar_media(slug: str, limit: int = 12) -> list[dict[str, Any]]:
    cache_key = f"weighted-similar:{slug}:{limit}"
    cached = recommendation_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    base = await media_details(slug)
    genre_id = (base.get("genre_ids") or [None])[0]
    vote_floor = max(6.0, float(base.get("vote_average") or 0) - 1.2)

    tasks = {
        "recommended": recommended_media(slug),
        "similar": similar_media(slug),
        "collection": collection_media(slug),
    }

    if base.get("media_type") == "movie" and genre_id:
        tasks["discover"] = discover_movies_filtered(
            page=1,
            genre_id=str(genre_id),
            original_language=base.get("original_language"),
            vote_gte=vote_floor,
        )
    elif base.get("media_type") == "tv":
        tasks["discover"] = discover_tv(page=1)

    people_sources: list[tuple[str, str]] = []
    if base.get("director_id"):
        people_sources.append(("director", str(base["director_id"])))
    for person_id in (base.get("cast_ids") or [])[:1]:
        if person_id:
            people_sources.append(("cast", str(person_id)))

    for idx, (_, person_id) in enumerate(people_sources):
        tasks[f"person-{idx}"] = person_combined_credits(person_id)

    gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
    candidate_sources: list[tuple[str, list[dict[str, Any]]]] = []
    for key, value in zip(tasks.keys(), gathered):
        if isinstance(value, Exception):
            continue
        if key == "discover" and isinstance(value, tuple):
            candidate_sources.append((key, list(value[0])))
        elif key.startswith("person-") and isinstance(value, list):
            source = "director" if key == "person-0" and people_sources and people_sources[0][0] == "director" else "cast"
            candidate_sources.append((source, value))
        elif isinstance(value, list):
            candidate_sources.append((key, value))

    unique_candidates: dict[str, tuple[dict[str, Any], set[str]]] = {}
    base_key = str(base.get("slug") or base.get("id"))
    for source, batch in candidate_sources:
        for item in batch:
            key = str(item.get("slug") or item.get("id") or "")
            if not key or key == base_key:
                continue
            if key not in unique_candidates:
                unique_candidates[key] = (item, {source})
            else:
                unique_candidates[key][1].add(source)

    detailed = await _load_candidate_details([item for item, _ in unique_candidates.values()], limit=24)
    detailed_by_key = {str(item.get("slug") or item.get("id")): item for item in detailed}

    scored: list[dict[str, Any]] = []
    for key, (_, sources) in unique_candidates.items():
        candidate = detailed_by_key.get(key)
        if not candidate or not candidate.get("poster_path"):
            continue
        total = 0.0
        reasons: list[str] = []
        for source in sorted(sources):
            delta, why = _score_similarity(base, candidate, source)
            total += delta
            reasons.extend(why)
        if total < MIN_SIMILARITY_SCORE:
            continue
        candidate["recommendation_score"] = round(total, 2)
        candidate["recommendation_reasons"] = list(dict.fromkeys(reasons))[:4]
        scored.append(candidate)

    scored.sort(
        key=lambda item: (
            float(item.get("recommendation_score") or 0),
            float(item.get("vote_average") or 0),
            float(item.get("popularity") or 0),
        ),
        reverse=True,
    )
    result = scored[:limit]
    recommendation_cache.set(cache_key, result, ttl_seconds=900)
    return result


def _extract_runtime_limit(message: str) -> int | None:
    lower = message.lower()
    hour_match = re.search(r"under\s+(\d+(?:\.\d+)?)\s*hours?", lower)
    if hour_match:
        return int(float(hour_match.group(1)) * 60)
    minute_match = re.search(r"under\s+(\d{2,3})\s*(?:min|mins|minutes)", lower)
    if minute_match:
        return int(minute_match.group(1))
    return None


def _extract_decade_range(message: str) -> tuple[int | None, int | None]:
    lower = message.lower()
    match = re.search(r"\b(19\d0|20\d0)s\b", lower)
    if match:
        start = int(match.group(1))
        return start, start + 9
    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", lower)
    if year_match:
        year = int(year_match.group(1))
        return year, year
    return None, None


def _extract_language(message: str) -> str | None:
    lower = message.lower()
    for label, code in LANGUAGE_ALIASES.items():
        if label in lower:
            return code
    return None


def _extract_genre(message: str) -> str | None:
    lower = message.lower()
    for label in GENRE_NAME_TO_ID:
        if label in lower:
            return GENRE_NAME_TO_ID[label]
    return None


def _extract_mood(message: str) -> str | None:
    lower = message.lower()
    for mood in MOOD_TO_GENRE:
        if mood in lower or mood.replace("-", " ") in lower:
            return mood
    if "dark sci-fi" in lower:
        return "dark"
    if "feel good" in lower or "feel-good" in lower:
        return "feel-good"
    return None


def _extract_person_name(message: str) -> tuple[str | None, str | None]:
    patterns = [
        ("director", r"(?:directed by|director)\s+([A-Za-z][A-Za-z .'-]{2,60})"),
        ("actor", r"(?:starring|with|actor|actress)\s+([A-Za-z][A-Za-z .'-]{2,60})"),
    ]
    for role, pattern in patterns:
        match = re.search(pattern, message, re.I)
        if match:
            return role, match.group(1).strip()
    return None, None


def _extract_title_reference(message: str) -> str | None:
    quoted = re.findall(r'"([^"]{2,80})"|\'([^\']{2,80})\'', message)
    if quoted:
        first = quoted[0][0] or quoted[0][1]
        return first.strip()
    like_match = re.search(r"\blike\s+([A-Za-z0-9][\w\s:&'-]{2,60})", message, re.I)
    if like_match:
        return like_match.group(1).strip()
    similar_match = re.search(r"\bsimilar to\s+([A-Za-z0-9][\w\s:&'-]{2,60})", message, re.I)
    if similar_match:
        return similar_match.group(1).strip()
    return None


def is_personalized_request(message: str) -> bool:
    lower = message.lower()
    return any(
        phrase in lower
        for phrase in (
            "for me",
            "my taste",
            "my watch history",
            "my wrapped",
            "personalized",
            "based on my",
        )
    )


async def recommend_for_query(
    message: str,
    *,
    taste: dict[str, Any] | None = None,
    user_id: str | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    cache_scope = user_id or "guest"
    cache_key = f"query-recs:{cache_scope}:{message.strip().lower()[:180]}:{limit}"
    cached = recommendation_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    title_ref = _extract_title_reference(message)
    mood = _extract_mood(message)
    genre_id = _extract_genre(message) or (MOOD_TO_GENRE.get(mood) if mood else None)
    runtime_lte = _extract_runtime_limit(message)
    year_from, year_to = _extract_decade_range(message)
    language = _extract_language(message)
    person_role, person_name = _extract_person_name(message)
    lower = message.lower()

    results: list[dict[str, Any]] = []

    if title_ref:
        resolved = await resolve_movie_titles([title_ref], limit_per=1)
        if resolved:
            results.extend(await weighted_similar_media(str(resolved[0].get("slug") or resolved[0].get("id")), limit=limit + 2))

    if not results and person_name:
        people = await search_person(person_name)
        if people:
            credits = await person_combined_credits(people[0]["id"])
            results.extend(credits[: limit * 2])

    if not results and "anime" in lower:
        anime, _, _, _ = await discover_anime(page=1)
        results.extend(anime)

    if not results and ("tv" in lower or "series" in lower or "show" in lower):
        tv_rows, _, _, _ = await discover_tv(page=1)
        results.extend(tv_rows)

    if not results:
        discover_rows, _, _, _ = await discover_movies_filtered(
            page=1,
            genre_id=genre_id,
            original_language=language,
            vote_gte=6.5,
            runtime_lte=runtime_lte,
            year_from=year_from,
            year_to=year_to,
        )
        results.extend(discover_rows)

    if user_id and taste and is_personalized_request(message):
        personal = await user_recommendations(user_id, limit=limit)
        results = personal + results

    if not results and taste and taste.get("favorite_genres"):
        genre_id = _genre_id(str(taste["favorite_genres"][0]))
        if genre_id:
            discover_rows, _, _, _ = await discover_movies_filtered(page=1, genre_id=genre_id, vote_gte=6.7)
            results.extend(discover_rows)

    if not results:
        results.extend(await trending_movies())

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in results:
        key = str(item.get("slug") or item.get("id") or "")
        if not key or key in seen or not item.get("poster_path"):
            continue
        seen.add(key)
        deduped.append(item)

    if title_ref and deduped:
        # When this is a "similar to X" query, preserve the weighted ordering.
        final = deduped[:limit]
    else:
        final = sorted(
            deduped,
            key=lambda item: (
                float(item.get("vote_average") or 0),
                float(item.get("popularity") or 0),
            ),
            reverse=True,
        )[:limit]

    recommendation_cache.set(cache_key, final, ttl_seconds=600)
    return final


async def user_recommendations(user_id: str, limit: int = 12) -> list[dict[str, Any]]:
    cache_key = f"user-recommendations:{user_id}:{limit}"
    cached = recommendation_cache.get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    reviews = list(reviews_collection.find({"user_id": user_id}))
    watchlist_items = list(watchlist_collection.find({"user_id": user_id}))

    seeds: list[str] = []
    seen_seed_ids: set[str] = set()
    rated_movie_scores: dict[str, float] = {}

    for review in sorted(reviews, key=lambda row: row.get("created_at", ""), reverse=True):
        movie_id = review.get("movie_id")
        if not movie_id:
            continue
        rated_movie_scores[movie_id] = max(rated_movie_scores.get(movie_id, 0), RATING_LABEL_SCORE.get(review.get("rating_label"), 0))
        if review.get("rating_label") not in HIGH_RATINGS:
            continue
        if movie_id in seen_seed_ids:
            continue
        seen_seed_ids.add(movie_id)
        seeds.append(movie_id)
        if len(seeds) >= 4:
            break

    for item in watchlist_items:
        movie_id = item.get("movie_id")
        if not movie_id or movie_id in seen_seed_ids:
            continue
        seen_seed_ids.add(movie_id)
        seeds.append(movie_id)
        if len(seeds) >= 6:
            break

    exclude = {item.get("movie_id") for item in watchlist_items if item.get("movie_id")}
    exclude.update({row.get("movie_id") for row in reviews if row.get("movie_id")})
    favorite_genres = Counter(review.get("primary_genre") for review in reviews if review.get("primary_genre"))

    scored: dict[str, dict[str, Any]] = {}
    for seed in seeds[:3]:
        try:
            candidates = await weighted_similar_media(seed, limit=max(limit, 10))
        except Exception:
            continue
        seed_weight = max(1.0, rated_movie_scores.get(seed, 3.0))
        for movie in candidates:
            key = str(movie.get("slug") or movie.get("id") or "")
            if not key or key in exclude:
                continue
            current = scored.get(key)
            boost = float(movie.get("recommendation_score") or 0) * (seed_weight / 3.0)
            if current is None:
                scored[key] = {**movie, "recommendation_score": boost}
            else:
                current["recommendation_score"] = float(current.get("recommendation_score") or 0) + boost

    favorite_genre = favorite_genres.most_common(1)[0][0] if favorite_genres else None
    genre_id = _genre_id(favorite_genre)
    if genre_id:
        try:
            discovered, _, _, _ = await discover_movies_filtered(page=1, genre_id=genre_id, vote_gte=6.8)
            for movie in discovered:
                key = str(movie.get("slug") or movie.get("id") or "")
                if not key or key in exclude:
                    continue
                current = scored.get(key)
                genre_boost = 12.0
                if current is None:
                    scored[key] = {**movie, "recommendation_score": genre_boost, "recommendation_reasons": ["matches favorite genre"]}
                else:
                    current["recommendation_score"] = float(current.get("recommendation_score") or 0) + genre_boost
        except Exception:
            pass

    if len(scored) < limit:
        try:
            for movie in await trending_movies():
                key = str(movie.get("slug") or movie.get("id") or "")
                if not key or key in exclude or key in scored:
                    continue
                scored[key] = {**movie, "recommendation_score": 4.0, "recommendation_reasons": ["popular now"]}
                if len(scored) >= limit:
                    break
        except Exception:
            pass

    out = list(scored.values())
    out.sort(
        key=lambda movie: (
            float(movie.get("recommendation_score") or 0),
            float(movie.get("vote_average") or 0),
            float(movie.get("popularity") or 0),
        ),
        reverse=True,
    )
    result = out[:limit]
    recommendation_cache.set(cache_key, result, ttl_seconds=900)
    return result
