import asyncio
import re

from fastapi import APIRouter

from app.db import reviews_collection, users_collection
from app.services.ratings import RATING_LABELS, empty_distribution
from app.services.recommendations import weighted_similar_media
from app.services.tmdb import (
    discover_movies,
    discover_movies_filtered,
    discover_anime,
    discover_tv,
    media_details,
    media_watch_providers,
    parse_media_slug,
    search_movies,
    search_multi,
    now_playing_movies,
    top_rated_movies,
    trending_movies,
    trending_mixed,
    upcoming_movies,
)
from app.services.watchmode import fetch_watchmode_sources

router = APIRouter(prefix="/api/movies", tags=["movies"])

GENRE_MAP = {
    "kids": "16",
    "action": "28",
    "comedy": "35",
}

REGION_PROFILES = {
    "US": {"label": "United States", "languages": {"en"}},
    "IN": {"label": "India", "languages": {"hi", "ta", "te", "ml", "kn", "bn", "mr"}},
    "JP": {"label": "Japan", "languages": {"ja"}},
    "KR": {"label": "South Korea", "languages": {"ko"}},
    "GB": {"label": "United Kingdom", "languages": {"en"}},
    "CA": {"label": "Canada", "languages": {"en", "fr"}},
}


def _region_profile(region: str) -> tuple[str, dict]:
    normalized = (region or "US").strip().upper()
    if normalized in {"GLOBAL", "INTL", "INTERNATIONAL", "WORLD"}:
        return "GLOBAL", {"label": "International", "languages": set()}
    safe_region = normalized[:2] or "US"
    return safe_region, REGION_PROFILES.get(safe_region, {"label": safe_region, "languages": set()})


def _apply_region_language_filter(movies: list[dict], region: str, profile: dict) -> list[dict]:
    languages = profile.get("languages") or set()
    if region == "GLOBAL" or not languages:
        return movies
    filtered = [m for m in movies if (m.get("original_language") or "").lower() in languages]
    return filtered or movies


def _safe_provider_error(message: str, exc: Exception) -> str:
    detail = re.sub(r"api_key=[^&\s']+", "api_key=***", str(exc))
    return f"{message} {detail}"


def _dist_percentages(dist: dict[str, int]) -> dict[str, float]:
    total = sum(dist.values()) or 1
    return {k: round(100.0 * dist[k] / total, 1) for k in RATING_LABELS}


@router.get("/trending")
async def get_trending_movies():
    try:
        movies = await trending_movies()
        return {"movies": movies, "error": None}
    except Exception as e:
        return {
            "movies": [],
            "error": _safe_provider_error(
                "Movie provider unavailable. Set a valid TMDB_API_KEY in backend/.env. Details:",
                e,
            ),
        }


@router.get("/trending-mixed")
async def get_trending_mixed():
    try:
        return {"movies": await trending_mixed(), "error": None}
    except Exception as e:
        return {"movies": [], "error": _safe_provider_error("Trending unavailable.", e)}


@router.get("/top-rated")
async def get_top_rated_movies(page: int = 1):
    try:
        movies, cur_page, total_pages, total_results = await top_rated_movies(page=page)
        return {
            "movies": movies,
            "page": cur_page,
            "total_pages": total_pages,
            "total_results": total_results,
            "error": None,
        }
    except Exception as e:
        return {
            "movies": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "error": _safe_provider_error("Top rated unavailable.", e),
        }


@router.get("/theaters")
async def get_theater_movies(region: str = "US", page: int = 1):
    try:
        safe_region, profile = _region_profile(region)
        tmdb_region = "US" if safe_region == "GLOBAL" else safe_region
        now_data, upcoming_data = await asyncio.gather(
            now_playing_movies(region=tmdb_region, page=page),
            upcoming_movies(region=tmdb_region, page=page),
        )
        now_movies, cur_page, now_total_pages, now_total_results = now_data
        upcoming, _, upcoming_total_pages, upcoming_total_results = upcoming_data
        now_movies = _apply_region_language_filter(now_movies, safe_region, profile)
        upcoming = _apply_region_language_filter(upcoming, safe_region, profile)
        return {
            "now_playing": now_movies,
            "upcoming": upcoming,
            "page": cur_page,
            "total_pages": max(now_total_pages, upcoming_total_pages),
            "total_results": now_total_results + upcoming_total_results,
            "region": safe_region,
            "region_label": profile["label"],
            "release_status": "Now playing" if now_movies else "Upcoming",
            "availability": "Theatrical release data from TMDB",
            "error": None,
        }
    except Exception as e:
        safe_region, profile = _region_profile(region)
        return {
            "now_playing": [],
            "upcoming": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "region": safe_region,
            "region_label": profile["label"],
            "release_status": None,
            "availability": None,
            "error": _safe_provider_error("Theater releases unavailable.", e),
        }


@router.get("/category/{category}")
async def get_movies_by_category(category: str, page: int = 1):
    cat = category.strip().lower()
    try:
        if cat == "tv":
            movies, cur_page, total_pages, total_results = await discover_tv(page=page)
        elif cat == "bollywood":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, original_language="hi"
            )
        elif cat == "hollywood":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, original_language="en"
            )
        elif cat == "anime":
            movies, cur_page, total_pages, total_results = await discover_anime(page=page)
        elif cat == "international":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, without_original_language="en|hi", vote_gte=6.0
            )
        elif cat == "kids":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, genre_id=GENRE_MAP["kids"]
            )
        elif cat == "action":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, genre_id=GENRE_MAP["action"], vote_gte=5.8
            )
        elif cat == "feelgood":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, genre_id=GENRE_MAP["comedy"], vote_gte=6.2
            )
        else:
            movies, cur_page, total_pages, total_results = await discover_movies(page=page)
        return {
            "movies": movies,
            "page": cur_page,
            "total_pages": total_pages,
            "total_results": total_results,
            "error": None,
        }
    except Exception as e:
        return {
            "movies": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "error": _safe_provider_error("Category unavailable.", e),
        }


@router.get("/search")
async def search(query: str, page: int = 1):
    try:
        movies, cur_page, total_pages, total_results = await search_movies(query=query, page=page)
        return {
            "movies": movies,
            "page": cur_page,
            "total_pages": total_pages,
            "total_results": total_results,
            "error": None,
        }
    except Exception as e:
        return {
            "movies": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "error": _safe_provider_error("Search unavailable.", e),
        }


@router.get("/suggest")
async def suggest(query: str, page: int = 1):
    try:
        movies, cur_page, total_pages, total_results = await search_multi(query=query, page=page)
        return {
            "movies": movies,
            "page": cur_page,
            "total_pages": total_pages,
            "total_results": total_results,
            "error": None,
        }
    except Exception as e:
        return {
            "movies": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "error": _safe_provider_error("Suggestions unavailable.", e),
        }


@router.get("/discover")
async def discover(page: int = 1):
    try:
        movies, cur_page, total_pages, total_results = await discover_movies(page=page)
        return {
            "movies": movies,
            "page": cur_page,
            "total_pages": total_pages,
            "total_results": total_results,
            "error": None,
        }
    except Exception as e:
        return {
            "movies": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "error": _safe_provider_error("Discover unavailable.", e),
        }


@router.get("/{movie_id}")
async def get_movie(movie_id: str):
    try:
        movie = await media_details(movie_id)
        canonical_id = movie.get("slug") or movie_id
        media_type, media_id = parse_media_slug(str(canonical_id))
        year = (movie.get("release_date") or "")[:4] or None
        partial_error = None

        providers_tmdb = []
        providers_wm = []
        similar = []
        related_tasks = await asyncio.gather(
            media_watch_providers(str(canonical_id)),
            fetch_watchmode_sources(movie.get("title") or "", year),
            weighted_similar_media(str(canonical_id)),
            return_exceptions=True,
        )

        if isinstance(related_tasks[0], Exception) or isinstance(related_tasks[1], Exception):
            failing = related_tasks[0] if isinstance(related_tasks[0], Exception) else related_tasks[1]
            partial_error = _safe_provider_error("Watch providers unavailable.", failing)
        else:
            providers_tmdb, providers_wm = related_tasks[0], related_tasks[1]

        if isinstance(related_tasks[2], Exception):
            partial_error = partial_error or _safe_provider_error("Similar titles unavailable.", related_tasks[2])
        else:
            similar = related_tasks[2]

        where: list[dict] = []
        seen_names: set[str] = set()
        for p in providers_tmdb + providers_wm:
            name = (p.get("provider_name") or "").lower()
            if name and name in seen_names:
                continue
            if name:
                seen_names.add(name)
            entry = {**p}
            if not entry.get("web_url") and entry.get("source") == "tmdb":
                if media_type == "tv":
                    entry["web_url"] = f"https://www.themoviedb.org/tv/{media_id}/watch"
                else:
                    entry["web_url"] = f"https://www.themoviedb.org/movie/{media_id}/watch"
            where.append(entry)

        review_ids = [movie_id]
        if canonical_id != movie_id:
            review_ids.append(str(canonical_id))
        reviews = list(reviews_collection.find({"movie_id": {"$in": review_ids}}))
        dist = empty_distribution()
        for review in reviews:
            review["_id"] = str(review["_id"])
            user = users_collection.find_one({"user_id": review["user_id"]})
            if user:
                review["username"] = user["username"]
                review["avatar"] = user.get("avatar", "")
            label = review.get("rating_label")
            if label in dist:
                dist[label] += 1

        top_review = None
        if reviews:
            top_review = sorted(
                reviews,
                key=lambda r: (r.get("likes", 0), r.get("created_at", "")),
                reverse=True,
            )[0]

        return {
            "movie": movie,
            "where_to_watch": where,
            "reviews": reviews,
            "top_review": top_review,
            "similar_movies": similar,
            "rating_distribution": dist,
            "rating_distribution_pct": _dist_percentages(dist),
            "total_votes": len(reviews),
            "error": partial_error,
        }
    except Exception as e:
        return {
            "movie": None,
            "where_to_watch": [],
            "reviews": [],
            "top_review": None,
            "similar_movies": [],
            "rating_distribution": empty_distribution(),
            "rating_distribution_pct": _dist_percentages(empty_distribution()),
            "total_votes": 0,
            "error": _safe_provider_error("Title details unavailable.", e),
        }
