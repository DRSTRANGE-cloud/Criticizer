"""Simple thread-safe TTL cache for API responses."""

from __future__ import annotations

import threading
import time
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, default_ttl_seconds: int = 600) -> None:
        self._ttl = default_ttl_seconds
        self._data: dict[str, tuple[float, T]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        now = time.monotonic()
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            expires_at, value = item
            if now >= expires_at:
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: T, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._ttl
        with self._lock:
            self._data[key] = (time.monotonic() + ttl, value)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


tmdb_cache: TTLCache[Any] = TTLCache(600)  # 10 min
watchmode_cache: TTLCache[Any] = TTLCache(900)  # 15 min
ai_response_cache: TTLCache[Any] = TTLCache(300)  # 5 min repeated chat prompts
recommendation_cache: TTLCache[Any] = TTLCache(900)  # 15 min
wrapped_cache: TTLCache[Any] = TTLCache(900)  # 15 min
