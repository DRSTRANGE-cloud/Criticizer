from __future__ import annotations

import json
from typing import Any

import httpx

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


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def media_slug(media_type: str, media_id: str) -> str:
    return f"tv-{media_id}" if media_type == "tv" else media_id


def parse_media_slug(slug: str) -> tuple[str, str]:
    if slug.startswith("tv-"):
        return "tv", slug[3:]
    return "movie", slug


def _year_from_date(value: str | None) -> int | None:
    if not value or len(value) < 4:
        return None
    try:
        return int(value[:4])
    except ValueError:
        return None


def _keyword_names(payload: dict[str, Any] | None) -> list[str]:
    source = payload or {}
    if isinstance(source.get("keywords"), list):
        rows = source.get("keywords") or []
    elif isinstance(source.get("keywords"), dict):
        rows = (source.get("keywords") or {}).get("keywords") or []
    else:
        rows = source.get("results") or []
    out: list[str] = []
    seen: set[str] = set()
    for item in rows:
        name = (item.get("name") or "").strip()
        key = name.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out[:20]


def normalize_movie(m: dict[str, Any], media_type: str = "movie") -> dict[str, Any]:
    mid = str(m.get("id"))
    mt = m.get("media_type") or media_type
    if mt not in ("movie", "tv"):
        mt = "movie"
    release_date = m.get("release_date") or m.get("first_air_date") or ""
    genre_ids = [str(g) for g in (m.get("genre_ids") or []) if g is not None]
    return {
        "id": mid,
        "media_type": mt,
        "slug": media_slug(mt, mid),
        "title": m.get("title") or m.get("name") or "",
        "overview": m.get("overview") or "",
        "poster_path": _img(m.get("poster_path"), "w500"),
        "backdrop_path": _img(m.get("backdrop_path"), "w1280"),
        "release_date": release_date,
        "release_year": _year_from_date(release_date),
        "vote_average": _safe_float(m.get("vote_average")),
        "vote_count": _safe_int(m.get("vote_count")),
        "popularity": _safe_float(m.get("popularity")),
        "genre_ids": genre_ids,
        "original_language": m.get("original_language"),
    }


def _dedupe_media(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in items:
        key = str(item.get("slug") or item.get("id") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _normalize_people(credits: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    cast = [
        {
            "id": str(c.get("id")),
            "name": c.get("name"),
            "character": c.get("character"),
            "profile_path": _img(c.get("profile_path"), "w342"),
        }
        for c in (credits.get("cast") or [])[:12]
        if c.get("id") and c.get("name")
    ]
    crew = [
        {
            "id": str(c.get("id")),
            "name": c.get("name"),
            "job": c.get("job"),
            "department": c.get("department"),
        }
        for c in (credits.get("crew") or [])
        if c.get("id") and c.get("name")
    ]
    return cast, crew


def _normalize_companies(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"name": c.get("name"), "logo_path": _img(c.get("logo_path"), "w92")}
        for c in rows
        if c.get("name")
    ]


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
    response = await client.get(url, params=q)
    response.raise_for_status()
    data = response.json()
    tmdb_cache.set(key, data, ttl_seconds=ttl)
    return data


async def trending_movies() -> list[dict[str, Any]]:
    data = await tmdb_get("/trending/movie/week", ttl=300)
    return [normalize_movie(m) for m in data.get("results", [])]


async def trending_mixed() -> list[dict[str, Any]]:
    data = await tmdb_get("/trending/all/week", ttl=300)
    out = []
    for m in data.get("results", []):
        mt = m.get("media_type")
        if mt not in ("movie", "tv"):
            continue
        out.append(normalize_movie(m, media_type=mt))
    return out


async def discover_movies(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/discover/movie",
        params={"sort_by": "popularity.desc", "page": str(page), "include_adult": "false"},
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def discover_movies_filtered(
    page: int = 1,
    *,
    genre_id: str | None = None,
    original_language: str | None = None,
    without_original_language: str | None = None,
    origin_country: str | None = None,
    vote_gte: float | None = None,
    runtime_lte: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    with_keywords: str | None = None,
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
    if without_original_language:
        params["without_original_language"] = without_original_language
    if origin_country:
        params["with_origin_country"] = origin_country
    if vote_gte is not None:
        params["vote_average.gte"] = str(vote_gte)
        params["vote_count.gte"] = "200"
    if runtime_lte is not None:
        params["with_runtime.lte"] = str(runtime_lte)
    if year_from is not None:
        params["primary_release_date.gte"] = f"{year_from}-01-01"
    if year_to is not None:
        params["primary_release_date.lte"] = f"{year_to}-12-31"
    if with_keywords:
        params["with_keywords"] = with_keywords

    data = await tmdb_get("/discover/movie", params=params)
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def discover_tv(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/discover/tv",
        params={"sort_by": "popularity.desc", "page": str(page), "include_adult": "false"},
    )
    movies = [normalize_movie(m, media_type="tv") for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def discover_anime(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    tv_data = await tmdb_get(
        "/discover/tv",
        params={
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
            "include_null_first_air_dates": "false",
            "with_origin_country": "JP",
            "with_genres": "16",
        },
        ttl=600,
    )
    movie_data = await tmdb_get(
        "/discover/movie",
        params={
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
            "with_original_language": "ja",
            "with_genres": "16",
            "vote_count.gte": "20",
        },
        ttl=600,
    )

    seen: set[str] = set()
    movies: list[dict[str, Any]] = []
    for item, media_type in [
        *[(m, "tv") for m in tv_data.get("results", [])],
        *[(m, "movie") for m in movie_data.get("results", [])],
    ]:
        normalized = normalize_movie(item, media_type=media_type)
        key = normalized.get("slug") or normalized.get("id")
        if not key or key in seen or not normalized.get("poster_path"):
            continue
        seen.add(key)
        movies.append(normalized)

    movies.sort(key=lambda movie: movie.get("popularity") or 0, reverse=True)
    return (
        movies,
        page,
        max(_safe_int(tv_data.get("total_pages"), 1), _safe_int(movie_data.get("total_pages"), 1)),
        _safe_int(tv_data.get("total_results")) + _safe_int(movie_data.get("total_results")),
    )


async def top_rated_movies(page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get("/movie/top_rated", params={"page": str(page)}, ttl=600)
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def now_playing_movies(region: str = "US", page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/movie/now_playing",
        params={"page": str(page), "region": region.upper()[:2]},
        ttl=900,
    )
    movies = [normalize_movie(m, media_type="movie") for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def upcoming_movies(region: str = "US", page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/movie/upcoming",
        params={"page": str(page), "region": region.upper()[:2]},
        ttl=900,
    )
    movies = [normalize_movie(m, media_type="movie") for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def search_movies(query: str, page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/search/movie",
        params={"query": query, "include_adult": "false", "page": str(page)},
        ttl=120,
    )
    movies = [normalize_movie(m) for m in data.get("results", [])]
    return movies, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def search_multi(query: str, page: int = 1) -> tuple[list[dict[str, Any]], int, int, int]:
    data = await tmdb_get(
        "/search/multi",
        params={"query": query, "include_adult": "false", "page": str(page)},
        ttl=120,
    )
    results: list[dict[str, Any]] = []
    for item in data.get("results", []):
        media_type = item.get("media_type")
        if media_type not in {"movie", "tv"}:
            continue
        results.append(normalize_movie(item, media_type=media_type))
    return results, _safe_int(data.get("page"), page), _safe_int(data.get("total_pages"), 1), _safe_int(
        data.get("total_results")
    )


async def search_person(query: str, page: int = 1) -> list[dict[str, Any]]:
    data = await tmdb_get(
        "/search/person",
        params={"query": query, "page": str(page), "include_adult": "false"},
        ttl=600,
    )
    return [
        {
            "id": str(person.get("id")),
            "name": person.get("name"),
            "known_for_department": person.get("known_for_department"),
            "profile_path": _img(person.get("profile_path"), "w185"),
        }
        for person in data.get("results", [])[:8]
        if person.get("id") and person.get("name")
    ]


async def person_movie_credits(person_id: str) -> list[dict[str, Any]]:
    data = await tmdb_get(f"/person/{person_id}/movie_credits", ttl=600)
    cast = data.get("cast") or []
    cast.sort(key=lambda item: item.get("popularity") or 0, reverse=True)
    return [normalize_movie(movie, media_type="movie") for movie in cast[:12]]


async def person_combined_credits(person_id: str) -> list[dict[str, Any]]:
    data = await tmdb_get(f"/person/{person_id}/combined_credits", ttl=600)
    rows = []
    for item in data.get("cast") or []:
        media_type = item.get("media_type")
        if media_type not in {"movie", "tv"}:
            continue
        rows.append(normalize_movie(item, media_type=media_type))
    rows.sort(key=lambda item: item.get("popularity") or 0, reverse=True)
    return _dedupe_media(rows)[:20]


async def resolve_movie_titles(titles: list[str], limit_per: int = 1) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for title in titles[:10]:
        clean = (title or "").strip()
        if not clean or len(clean) < 2:
            continue
        try:
            movies, _, _, _ = await search_multi(clean, page=1)
        except Exception:
            continue
        for movie in movies[:limit_per]:
            key = str(movie.get("slug") or movie.get("id") or "")
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(movie)
    return out


async def _movie_extra_details(movie_id: str) -> dict[str, Any]:
    return await tmdb_get(
        f"/movie/{movie_id}",
        params={"append_to_response": "videos,credits,keywords,recommendations,similar,release_dates"},
        ttl=600,
    )


async def _tv_extra_details(tv_id: str) -> dict[str, Any]:
    return await tmdb_get(
        f"/tv/{tv_id}",
        params={"append_to_response": "videos,credits,keywords,recommendations,similar,content_ratings"},
        ttl=600,
    )


def _details_common(details: dict[str, Any], *, media_type: str) -> dict[str, Any]:
    normalized = normalize_movie(details, media_type=media_type)
    credits = details.get("credits") or {}
    cast, crew = _normalize_people(credits)
    genres = details.get("genres") or []
    genre_ids = [str(g.get("id")) for g in genres if g.get("id") is not None]
    genre_names = [g.get("name") for g in genres if g.get("name")]
    keywords = _keyword_names(details.get("keywords"))
    production_rows = details.get("production_companies") or []
    collection = details.get("belongs_to_collection") or None

    out = {
        **normalized,
        "genres": genre_names,
        "genre_ids": genre_ids,
        "keywords": keywords,
        "cast": cast,
        "cast_ids": [person["id"] for person in cast[:5] if person.get("id")],
        "cast_names": [person["name"] for person in cast[:5] if person.get("name")],
        "production_company": production_rows[0].get("name") if production_rows else None,
        "production_companies": _normalize_companies(production_rows),
        "production_countries": [c.get("iso_3166_1") for c in (details.get("production_countries") or []) if c.get("iso_3166_1")],
        "spoken_languages": [c.get("english_name") or c.get("name") for c in (details.get("spoken_languages") or []) if c.get("english_name") or c.get("name")],
        "collection": {"id": str(collection.get("id")), "name": collection.get("name")} if collection and collection.get("id") else None,
        "vote_count": _safe_int(details.get("vote_count")),
        "status": details.get("status"),
        "crew": crew,
    }
    if details.get("poster_path"):
        out["poster_path"] = _img(details.get("poster_path"), "w780")
    if details.get("backdrop_path"):
        out["backdrop_path"] = _img(details.get("backdrop_path"), "original")
        out["backdrop_preview"] = _img(details.get("backdrop_path"), "w300")
    return out


def _trailer_key(details: dict[str, Any]) -> str | None:
    for video in (details.get("videos") or {}).get("results", []):
        if video.get("site") == "YouTube" and video.get("type") in ("Trailer", "Teaser"):
            return video.get("key")
    return None


async def tv_details(tv_id: str) -> dict[str, Any]:
    key = f"tv-details:{tv_id}"
    hit = tmdb_cache.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    details = await _tv_extra_details(tv_id)
    common = _details_common(details, media_type="tv")

    creators = details.get("created_by") or []
    creator = creators[0] if creators else None
    recommendation_rows = (details.get("recommendations") or {}).get("results") or []
    similar_rows = (details.get("similar") or {}).get("results") or []

    out = {
        **common,
        "runtime": _safe_int((details.get("episode_run_time") or [0])[0] if details.get("episode_run_time") else 0),
        "trailer_key": _trailer_key(details),
        "director": creator.get("name") if creator else None,
        "director_id": str(creator.get("id")) if creator and creator.get("id") else None,
        "creator_names": [person.get("name") for person in creators if person.get("name")][:3],
        "tmdb_recommendations": [normalize_movie(item, media_type="tv") for item in recommendation_rows[:18]],
        "tmdb_similar": [normalize_movie(item, media_type="tv") for item in similar_rows[:18]],
    }
    tmdb_cache.set(key, out, ttl_seconds=600)
    return out


async def movie_details(movie_id: str) -> dict[str, Any]:
    key = f"movie-details:{movie_id}"
    hit = tmdb_cache.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    details = await _movie_extra_details(movie_id)
    common = _details_common(details, media_type="movie")
    crew = common.get("crew") or []
    directors = [person for person in crew if person.get("job") == "Director"]
    director = directors[0] if directors else None
    recommendation_rows = (details.get("recommendations") or {}).get("results") or []
    similar_rows = (details.get("similar") or {}).get("results") or []

    out = {
        **common,
        "runtime": _safe_int(details.get("runtime")),
        "trailer_key": _trailer_key(details),
        "director": director.get("name") if director else None,
        "director_id": director.get("id") if director else None,
        "budget": _safe_int(details.get("budget")),
        "revenue": _safe_int(details.get("revenue")),
        "tmdb_recommendations": [normalize_movie(item, media_type="movie") for item in recommendation_rows[:18]],
        "tmdb_similar": [normalize_movie(item, media_type="movie") for item in similar_rows[:18]],
    }
    tmdb_cache.set(key, out, ttl_seconds=600)
    return out


async def movie_watch_providers(movie_id: str, region: str = "US") -> list[dict[str, Any]]:
    data = await tmdb_get(f"/movie/{movie_id}/watch/providers", ttl=900)
    by_region = (data.get("results") or {}).get(region) or {}
    providers: list[dict[str, Any]] = []
    for key in ("flatrate", "rent", "buy"):
        for provider in by_region.get(key) or []:
            providers.append(
                {
                    "provider_id": provider.get("provider_id"),
                    "provider_name": provider.get("provider_name"),
                    "logo_path": _img(provider.get("logo_path"), "w92"),
                    "type": key,
                    "source": "tmdb",
                }
            )
    seen: set[tuple[int | None, str]] = set()
    out: list[dict[str, Any]] = []
    for provider in providers:
        cache_key = (provider.get("provider_id"), str(provider.get("type")))
        if cache_key in seen:
            continue
        seen.add(cache_key)
        out.append(provider)
    return out


async def tv_watch_providers(tv_id: str, region: str = "US") -> list[dict[str, Any]]:
    data = await tmdb_get(f"/tv/{tv_id}/watch/providers", ttl=900)
    by_region = (data.get("results") or {}).get(region) or {}
    providers: list[dict[str, Any]] = []
    for key in ("flatrate", "rent", "buy"):
        for provider in by_region.get(key) or []:
            providers.append(
                {
                    "provider_id": provider.get("provider_id"),
                    "provider_name": provider.get("provider_name"),
                    "logo_path": _img(provider.get("logo_path"), "w92"),
                    "type": key,
                    "source": "tmdb",
                }
            )
    seen: set[tuple[int | None, str]] = set()
    out: list[dict[str, Any]] = []
    for provider in providers:
        cache_key = (provider.get("provider_id"), str(provider.get("type")))
        if cache_key in seen:
            continue
        seen.add(cache_key)
        out.append(provider)
    return out


async def media_details(slug: str) -> dict[str, Any]:
    media_type, media_id = parse_media_slug(slug)
    if media_type == "tv":
        return await tv_details(media_id)
    try:
        return await movie_details(media_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 404:
            raise
        return await tv_details(media_id)


async def media_watch_providers(slug: str, region: str = "US") -> list[dict[str, Any]]:
    media_type, media_id = parse_media_slug(slug)
    if media_type == "tv":
        return await tv_watch_providers(media_id, region=region)
    return await movie_watch_providers(media_id, region=region)


async def recommended_media(slug: str) -> list[dict[str, Any]]:
    details = await media_details(slug)
    return list(details.get("tmdb_recommendations") or [])


async def collection_media(slug: str) -> list[dict[str, Any]]:
    media_type, _ = parse_media_slug(slug)
    if media_type == "tv":
        return []
    details = await media_details(slug)
    collection = details.get("collection") or {}
    collection_id = collection.get("id")
    if not collection_id:
        return []
    data = await tmdb_get(f"/collection/{collection_id}", ttl=900)
    rows = [normalize_movie(item, media_type="movie") for item in data.get("parts", [])]
    return _dedupe_media(rows)


async def similar_media(slug: str) -> list[dict[str, Any]]:
    details = await media_details(slug)
    return list(details.get("tmdb_similar") or [])


async def similar_movies(movie_id: str) -> list[dict[str, Any]]:
    details = await movie_details(movie_id)
    return list(details.get("tmdb_similar") or [])


async def trending_anime() -> list[dict[str, Any]]:
    movies, _, _, _ = await discover_anime(page=1)
    return movies[:12]
