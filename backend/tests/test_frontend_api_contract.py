from __future__ import annotations

import re
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DOCS = REPOSITORY_ROOT / "docs" / "frontend"
SCREEN_CONTRACT = FRONTEND_DOCS / "SCREEN_API_CONTRACT.md"
API_REFERENCE = REPOSITORY_ROOT / "docs" / "api" / "API_REFERENCE.md"
ERROR_REFERENCE = REPOSITORY_ROOT / "docs" / "api" / "ERROR_REFERENCE.md"
HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
FRONTEND_ROW = re.compile(
    r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|$",
)
PUBLIC_ROW = re.compile(
    r"^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|",
)
ERROR_ROW = re.compile(r"^\|\s*([A-Z][A-Z0-9_]+)\s*\|")


def _frontend_endpoints() -> list[tuple[str, str, str, str]]:
    rows = []
    for line in SCREEN_CONTRACT.read_text(encoding="utf-8").splitlines():
        match = FRONTEND_ROW.match(line)
        if match:
            rows.append(tuple(match.groups()))
    return rows


def _public_endpoints() -> set[tuple[str, str]]:
    endpoints = set()
    for line in API_REFERENCE.read_text(encoding="utf-8").splitlines():
        match = PUBLIC_ROW.match(line)
        if match:
            endpoints.add((match.group(1), match.group(2)))
    return endpoints


def test_frontend_endpoints_are_unique_public_api_subset() -> None:
    rows = _frontend_endpoints()
    endpoints = {(method, path) for _, _, method, path in rows}

    assert rows
    assert len(endpoints) == len(rows)
    assert endpoints < _public_endpoints()
    assert all(method in HTTP_METHODS for method, _ in endpoints)
    assert all(path.startswith("/api/v1/") for _, path in endpoints)
    assert all(screen and action for screen, action, _, _ in rows)


def test_frontend_contract_structure_and_links() -> None:
    expected_files = {
        FRONTEND_DOCS / "README.md",
        SCREEN_CONTRACT,
        FRONTEND_DOCS / "STATE_AND_ERROR_CONTRACT.md",
        FRONTEND_DOCS / "IMPLEMENTATION_ORDER.md",
    }
    assert all(path.is_file() for path in expected_files)
    assert "[Frontend API Contract](docs/frontend/README.md)" in (
        REPOSITORY_ROOT / "README.md"
    ).read_text(encoding="utf-8")
    assert "[Frontend API Contract](../frontend/README.md)" in (
        REPOSITORY_ROOT / "docs" / "api" / "README.md"
    ).read_text(encoding="utf-8")

    screen_content = SCREEN_CONTRACT.read_text(encoding="utf-8")
    for screen in (
        "Projects",
        "Project Overview",
        "Dataset Detail",
        "Target Detail",
        "Evaluator Detail",
        "Experiment Create",
        "Experiment Detail",
        "History",
        "Comparison Detail",
    ):
        assert f"## {screen}" in screen_content
    for state in ("Loading", "Empty", "Success", "Error"):
        assert state in screen_content


def test_frontend_error_codes_exist_in_public_error_reference() -> None:
    state_contract = (FRONTEND_DOCS / "STATE_AND_ERROR_CONTRACT.md").read_text(encoding="utf-8")
    public_errors = ERROR_REFERENCE.read_text(encoding="utf-8")
    codes = {
        match.group(1)
        for line in state_contract.splitlines()
        if (match := ERROR_ROW.match(line))
    }

    assert codes
    assert all(code in public_errors for code in codes)


def test_frontend_contract_has_no_production_url_or_local_tooling_traces() -> None:
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
    for path in FRONTEND_DOCS.glob("*.md"):
        content = path.read_text(encoding="utf-8")
        assert "https://" not in content
        assert not any(value in content for value in forbidden)
