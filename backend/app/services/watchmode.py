"""Watchmode API — where to watch (complements TMDB providers)."""

from __future__ import annotations

import json
from typing import Any

from app.config import settings
from app.services.cache import watchmode_cache
from app.services.http_client import get_http_client


def _wm_cache_key(parts: dict[str, Any]) -> str:
    return "wm:" + str(hash(json.dumps(parts, sort_keys=True)))


async def fetch_watchmode_sources(title: str, year: str | None = None) -> list[dict[str, Any]]:
    if not settings.watchmode_api_key:
        return []

    cache_key = _wm_cache_key({"t": title, "y": year or ""})
    hit = watchmode_cache.get(cache_key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    client = get_http_client()
    base = settings.watchmode_base_url.rstrip("/")
    params: dict[str, str | int] = {
        "apiKey": settings.watchmode_api_key,
        "search_field": "name",
        "search_value": title,
    }
    r = await client.get(f"{base}/search/", params=params)
    if r.status_code != 200:
        watchmode_cache.set(cache_key, [], ttl_seconds=300)
        return []

    data = r.json()
    results = data if isinstance(data, list) else data.get("title_results") or data.get("results") or []
    if not results:
        watchmode_cache.set(cache_key, [], ttl_seconds=300)
        return []

    best = results[0]
    if year and len(results) > 1:
        for item in results:
            if str(item.get("year") or "") == str(year):
                best = item
                break

    wid = best.get("id") or best.get("title_id")
    if not wid:
        watchmode_cache.set(cache_key, [], ttl_seconds=300)
        return []

    r2 = await client.get(
        f"{base}/title/{wid}/sources/",
        params={"apiKey": settings.watchmode_api_key},
    )
    if r2.status_code != 200:
        watchmode_cache.set(cache_key, [], ttl_seconds=300)
        return []

    sources_raw = r2.json()
    sources_list = sources_raw if isinstance(sources_raw, list) else sources_raw.get("sources") or []

    out: list[dict[str, Any]] = []
    for s in sources_list:
        name = s.get("name") or s.get("source") or "Provider"
        web = s.get("web_url") or s.get("url") or s.get("link")
        out.append(
            {
                "provider_name": name,
                "logo_path": None,
                "type": (s.get("type") or "subscription").lower(),
                "web_url": web,
                "source": "watchmode",
            }
        )

    watchmode_cache.set(cache_key, out, ttl_seconds=900)
    return out
