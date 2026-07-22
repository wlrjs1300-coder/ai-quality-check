from __future__ import annotations

import asyncio
import sys
from pathlib import PurePath

from sqlalchemy.engine import make_url

from src.application.errors import ErrorCodeError
from src.application.services.demo_seed_service import DemoSeedService
from src.infrastructure.settings import get_database_url


def _database_name_is_allowed(database_url: str) -> bool:
    database = make_url(database_url).database
    if not database:
        return False
    name = PurePath(database).name.lower()
    if "." in name:
        name = name.rsplit(".", 1)[0]
    return name in {"evalops_local", "evalops_test"}


async def _run() -> int:
    database_url = get_database_url()
    if not _database_name_is_allowed(database_url):
        print("DEMO_SEED_DATABASE_NOT_ALLOWED: demo seed requires evalops_local or evalops_test.", file=sys.stderr)
        return 2

    from src.infrastructure.database import SessionLocal

    async with SessionLocal() as session:
        try:
            result = await DemoSeedService(session).seed()
        except ErrorCodeError as exc:
            print(f"{exc.code}: {exc}", file=sys.stderr)
            return 1

    if result.status == "created":
        print("Demo seed created.")
        print(f"project_id: {result.project_id}")
        print(f"dataset_version_id: {result.dataset_version_id}")
        print(f"experiment_count: {result.experiment_count}")
        print(f"quality_gate_result_count: {result.quality_gate_result_count}")
        print(f"baseline_comparison_count: {result.baseline_comparison_count}")
        print(f"latest_readiness: {result.latest_readiness}")
    else:
        print("Demo seed already exists and matches the expected definition.")
        print(f"project_id: {result.project_id}")
        print("status: already_seeded")
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
