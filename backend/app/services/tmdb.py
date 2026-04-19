from __future__ import annotations

import json
from typing import Any

from app.config import settings
from app.services.cache import tmdb_cache
from app.services.http_client import get_http_client


def _img(path: str | None, size: str) -> str | None:
    if not path:
        return None
    return f"{settings.tmdb_image_base_url}/{size}{path}"


def _cache_key(path: str, params: dict[str, Any]) -> str:
    stable = json.dumps({"p": path, "q": sorted(params.items())}, sort_keys=True)
    return f"tmdb:{hash(stable)}"


def normalize_movie(m: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(m.get("id")),
        "title": m.get("title") or m.get("name") or "",
        "overview": m.get("overview") or "",
        "poster_path": _img(m.get("poster_path"), "w500"),
        "backdrop_path": _img(m.get("backdrop_path"), "original"),
        "release_date": m.get("release_date") or m.get("first_air_date") or "",
        "vote_average": m.get("vote_average") or 0,
    }


async def tmdb_get(path: str, params: dict[str, Any] | None = None, ttl: int = 600) -> dict[str, Any]:
    if not settings.tmdb_api_key:
        raise RuntimeError("TMDB_API_KEY is not set")

    q = dict(params or {})
    q["api_key"] = settings.tmdb_api_key
    key = _cache_key(path, q)
    hit = tmdb_cache.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    url = f"{settings.tmdb_base_url}{path}"
    client = get_http_client()
    r = await client.get(url, params=q)
    r.raise_for_status()
    data = r.json()
    tmdb_cache.set(key, data, ttl_seconds=ttl)
    return data


async def trending_movies() -> list[dict[str, Any]]:
    data = await tmdb_get("/trending/movie/week", ttl=300)
    return [normalize_movie(m) for m in data.get("results", [])]


async def trending_mixed() -> list[dict[str, Any]]:
    data = await tmdb_get("/trending/all/week", ttl=300)
    return [normalize_movie(m) for m in data.get("results", [])]


async def discover_movies(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/discover/movie",
        params={
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
        },
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def discover_movies_filtered(
    page: int = 1,
    *,
    genre_id: str | None = None,
    original_language: str | None = None,
    origin_country: str | None = None,
    vote_gte: float | None = None,
) -> tuple[list[dict[str, Any]], int, int, int]:
    params: dict[str, str] = {
        "sort_by": "popularity.desc",
        "page": str(page),
        "include_adult": "false",
    }
    if genre_id:
        params["with_genres"] = genre_id
    if original_language:
        params["with_original_language"] = original_language
    if origin_country:
        params["with_origin_country"] = origin_country
    if vote_gte is not None:
        params["vote_average.gte"] = str(vote_gte)
        params["vote_count.gte"] = "200"

    data = await tmdb_get(
        "/discover/movie",
        params=params,
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def discover_tv(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/discover/tv",
        params={
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
        },
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def discover_anime(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/discover/tv",
        params={
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
            "with_origin_country": "JP",
            "with_genres": "16",
        },
        ttl=600,
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def top_rated_movies(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get("/movie/top_rated", params={"page": str(page)}, ttl=600)
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def search_movies(query: str, page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/search/movie",
        params={"query": query, "include_adult": "false", "page": str(page)},
        ttl=120,
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return (
        movies,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def search_multi(query: str, page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/search/multi",
        params={"query": query, "include_adult": "false", "page": str(page)},
        ttl=120,
    )
    results = []
    for item in data.get("results", []):
        media_type = item.get("media_type")
        if media_type not in {"movie", "tv"}:
            continue
        normalized = normalize_movie(item)
        normalized["media_type"] = media_type
        results.append(normalized)
    return (
        results,
        int(data.get("page") or page),
        int(data.get("total_pages") or 1),
        int(data.get("total_results") or 0),
    )


async def movie_details(movie_id: str) -> dict[str, Any]:
    key = f"details:{movie_id}"
    hit = tmdb_cache.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    details = await tmdb_get(
        f"/movie/{movie_id}",
        params={"append_to_response": "videos,credits"},
        ttl=600,
    )

    trailer_key = None
    for v in (details.get("videos") or {}).get("results", []):
        if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser"):
            trailer_key = v.get("key")
            if v.get("type") == "Trailer":
                break

    credits = details.get("credits") or {}
    cast = [
        {
            "id": str(c.get("id")),
            "name": c.get("name"),
            "character": c.get("character"),
            "profile_path": _img(c.get("profile_path"), "w185"),
        }
        for c in (credits.get("cast") or [])[:10]
    ]
    crew = credits.get("crew") or []
    directors = [p.get("name") for p in crew if p.get("job") == "Director" and p.get("name")]
    director = directors[0] if directors else None

    companies = details.get("production_companies") or []
    production_companies = [
        {"name": c.get("name"), "logo_path": _img(c.get("logo_path"), "w92")}
        for c in companies
        if c.get("name")
    ]
    production_company = companies[0].get("name") if companies else None

    out = {
        **normalize_movie(details),
        "runtime": details.get("runtime") or 0,
        "genres": [g.get("name") for g in (details.get("genres") or []) if g.get("name")],
        "trailer_key": trailer_key,
        "cast": cast,
        "director": director,
        "production_company": production_company,
        "production_companies": production_companies,
    }
    tmdb_cache.set(key, out, ttl_seconds=600)
    return out


async def movie_watch_providers(movie_id: str, region: str = "US") -> list[dict[str, Any]]:
    data = await tmdb_get(f"/movie/{movie_id}/watch/providers", ttl=900)
    by_region = (data.get("results") or {}).get(region) or {}

    providers = []
    for key in ("flatrate", "rent", "buy"):
        for p in by_region.get(key) or []:
            providers.append(
                {
                    "provider_id": p.get("provider_id"),
                    "provider_name": p.get("provider_name"),
                    "logo_path": _img(p.get("logo_path"), "w92"),
                    "type": key,
                    "source": "tmdb",
                }
            )
    seen: set[tuple[int | None, str]] = set()
    out = []
    for p in providers:
        k = (p.get("provider_id"), p.get("type"))
        if k in seen:
            continue
        seen.add(k)
        out.append(p)
    return out


async def similar_movies(movie_id: str) -> list[dict[str, Any]]:
    data = await tmdb_get(f"/movie/{movie_id}/similar", params={"page": "1"}, ttl=600)
    return [normalize_movie(m) for m in data.get("results", [])[:12]]
