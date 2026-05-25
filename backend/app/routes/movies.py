import asyncio

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
    top_rated_movies,
    trending_movies,
    trending_mixed,
)
from app.services.watchmode import fetch_watchmode_sources

router = APIRouter(prefix="/api/movies", tags=["movies"])

GENRE_MAP = {
    "kids": "16",
}


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
            "error": (
                "Movie provider unavailable. "
                "Set a valid TMDB_API_KEY in backend/.env. "
                f"Details: {str(e)}"
            ),
        }


@router.get("/trending-mixed")
async def get_trending_mixed():
    try:
        return {"movies": await trending_mixed(), "error": None}
    except Exception as e:
        return {"movies": [], "error": f"Trending unavailable. {str(e)}"}


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
        return {"movies": [], "page": page, "total_pages": 0, "total_results": 0, "error": str(e)}


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
        return {"movies": [], "page": page, "total_pages": 0, "total_results": 0, "error": str(e)}


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
            "error": f"Search unavailable. {str(e)}",
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
            "error": f"Suggestions unavailable. {str(e)}",
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
            "error": f"Discover unavailable. {str(e)}",
        }


@router.get("/{movie_id}")
async def get_movie(movie_id: str):
    try:
        media_type, media_id = parse_media_slug(movie_id)
        movie = await media_details(movie_id)
        year = (movie.get("release_date") or "")[:4] or None

        providers_tmdb, providers_wm = await asyncio.gather(
            media_watch_providers(movie_id),
            fetch_watchmode_sources(movie.get("title") or "", year),
        )

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

        reviews = list(reviews_collection.find({"movie_id": movie_id}))
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
            "similar_movies": await similar_media(movie_id),
            "rating_distribution": dist,
            "rating_distribution_pct": _dist_percentages(dist),
            "total_votes": len(reviews),
            "error": None,
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
            "error": f"Movie details unavailable. {str(e)}",
        }
