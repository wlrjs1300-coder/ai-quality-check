from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def test_alembic_upgrade_head(tmp_path):
    db_file = Path(tmp_path) / "migrate_test.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_file}"

    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=Path(__file__).resolve().parent.parent,
        capture_output=True,
        text=True,
        env=env,
    )
    assert completed.returncode == 0, completed.stderr
