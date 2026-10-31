"""Простой ограничитель частоты запросов в памяти процесса (скользящее окно)."""
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional


class RateLimiter:
    def __init__(self, limit: int, window_s: float = 60.0):
        self.limit = limit
        self.window_s = window_s
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: Optional[float] = None) -> bool:
        now = time.monotonic() if now is None else now
        q = self._hits[key]
        while q and now - q[0] >= self.window_s:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        if len(self._hits) > 10_000:  # не даём словарю расти бесконечно
            for k in [k for k, v in self._hits.items() if not v]:
                del self._hits[k]
        return True
