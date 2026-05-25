"""Shared httpx async client (connection pooling)."""

from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(25.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            http2=False,
        )
    return _client


async def aclose_http_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
