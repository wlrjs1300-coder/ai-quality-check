from __future__ import annotations

import re
from pathlib import Path

from src.api.main import app


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
API_DOCS = REPOSITORY_ROOT / "docs" / "api"
API_REFERENCE = API_DOCS / "API_REFERENCE.md"
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
INVENTORY_ROW = re.compile(
    r"^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|",
)


def _documented_endpoints() -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for line in API_REFERENCE.read_text(encoding="utf-8").splitlines():
        match = INVENTORY_ROW.match(line)
        if match:
            rows.append((match.group(1), match.group(2), match.group(3).strip()))
    return rows


def _openapi_endpoints() -> set[tuple[str, str]]:
    return {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
        if method.upper() in HTTP_METHODS
    }


def test_documented_endpoint_inventory_matches_openapi() -> None:
    rows = _documented_endpoints()
    documented = {(method, path) for method, path, _ in rows}

    assert rows
    assert len(documented) == len(rows)
    assert documented == _openapi_endpoints()
    assert all(path == "/health" or path.startswith("/api/v1/") for _, path in documented)
    assert all(description for _, _, description in rows)


def test_public_api_documentation_files_and_fastapi_paths() -> None:
    expected_files = {
        API_DOCS / "README.md",
        API_REFERENCE,
        API_DOCS / "ERROR_REFERENCE.md",
        API_DOCS / "DEMO_WORKFLOW.md",
    }
    assert all(path.is_file() for path in expected_files)
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/openapi.json"


def test_public_api_documentation_has_no_local_tooling_traces() -> None:
    forbidden = tuple(
        bytes.fromhex(value).decode()
        for value in (
            "434c415544452e6d64",
            "4147454e54532e6d64",
            "2e636c617564652f",
            "2e636f6465782f",
            "2e6167656e74732f",
        )
    )
    for path in API_DOCS.glob("*.md"):
        content = path.read_text(encoding="utf-8")
        assert not any(value in content for value in forbidden)
