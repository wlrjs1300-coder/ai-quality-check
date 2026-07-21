from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.api.deps import get_db_session
from src.domain.models import Base


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    with TemporaryDirectory() as temp_dir:
        db_file = Path(temp_dir) / "evalops_test.db"
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_file}"

        engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async def setup_db() -> None:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)

        asyncio.run(setup_db())

        async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
            async with session_factory() as session:
                try:
                    yield session
                finally:
                    await session.close()

        from src.api.main import app

        app.dependency_overrides[get_db_session] = _get_test_db

        with TestClient(app) as test_client:
            yield test_client

        app.dependency_overrides.pop(get_db_session, None)
        asyncio.run(engine.dispose())
