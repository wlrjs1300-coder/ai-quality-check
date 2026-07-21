from __future__ import annotations

from functools import lru_cache
import os


@lru_cache(maxsize=1)
def get_database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./evalops_dev.db")
