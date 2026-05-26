"""In-memory sliding-window rate limiter per actor key."""

from __future__ import annotations

import threading
import time
from collections import deque

from app.config import settings

_lock = threading.Lock()
_windows: dict[str, deque[float]] = {}


def check_rate_limit(actor_key: str) -> tuple[bool, int]:
    """
    Returns (allowed, retry_after_seconds).
  """
    limit = settings.ai_chat_rate_limit
    window = settings.ai_chat_rate_window_seconds
    now = time.monotonic()
    cutoff = now - window

    with _lock:
        bucket = _windows.setdefault(actor_key, deque())
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry = int(window - (now - bucket[0])) + 1
            return False, max(retry, 1)
        bucket.append(now)
        return True, 0
