import asyncio
import re

from fastapi import APIRouter

from app.db import reviews_collection, users_collection
from app.services.ratings import RATING_LABELS, empty_distribution
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
    similar_media,
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
}


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
        safe_region = (region or "US").strip().upper()[:2] or "US"
        now_data, upcoming_data = await asyncio.gather(
            now_playing_movies(region=safe_region, page=page),
            upcoming_movies(region=safe_region, page=page),
        )
        now_movies, cur_page, now_total_pages, now_total_results = now_data
        upcoming, _, upcoming_total_pages, upcoming_total_results = upcoming_data
        return {
            "now_playing": now_movies,
            "upcoming": upcoming,
            "page": cur_page,
            "total_pages": max(now_total_pages, upcoming_total_pages),
            "total_results": now_total_results + upcoming_total_results,
            "region": safe_region,
            "error": None,
        }
    except Exception as e:
        return {
            "now_playing": [],
            "upcoming": [],
            "page": page,
            "total_pages": 0,
            "total_results": 0,
            "region": (region or "US").strip().upper()[:2] or "US",
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
        elif cat == "kids":
            movies, cur_page, total_pages, total_results = await discover_movies_filtered(
                page=page, genre_id=GENRE_MAP["kids"]
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

        try:
            providers_tmdb, providers_wm = await asyncio.gather(
                media_watch_providers(str(canonical_id)),
                fetch_watchmode_sources(movie.get("title") or "", year),
            )
        except Exception as e:
            providers_tmdb, providers_wm = [], []
            partial_error = _safe_provider_error("Watch providers unavailable.", e)

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

        try:
            similar = await similar_media(str(canonical_id))
        except Exception as e:
            similar = []
            partial_error = partial_error or _safe_provider_error("Similar titles unavailable.", e)

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
