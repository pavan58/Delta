"""Async database access (SQLAlchemy Core over asyncpg).

Geo-heavy queries are written as explicit PostGIS SQL; this keeps the spatial
logic readable and reviewable rather than hidden behind an ORM.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from .config import get_settings

_engine: AsyncEngine | None = None


def engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, pool_pre_ping=True, pool_size=10)
    return _engine


async def dispose() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_conn() -> AsyncIterator[AsyncConnection]:
    """FastAPI dependency: one transaction per request."""
    async with engine().begin() as conn:
        yield conn


async def fetch_all(conn: AsyncConnection, sql: str, **params: Any) -> list[dict[str, Any]]:
    res = await conn.execute(text(sql), params)
    return [dict(r._mapping) for r in res]


async def fetch_one(conn: AsyncConnection, sql: str, **params: Any) -> dict[str, Any] | None:
    res = await conn.execute(text(sql), params)
    row = res.first()
    return dict(row._mapping) if row else None


async def execute(conn: AsyncConnection, sql: str, **params: Any) -> int:
    res = await conn.execute(text(sql), params)
    return res.rowcount
