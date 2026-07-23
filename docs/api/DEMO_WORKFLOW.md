# Demo Workflow

이 절차는 공개 합성 데이터로 Project → Dataset Version → Mock Target/Evaluator Version → Experiment Result → Quality Gate → Baseline Comparison 조회 흐름을 재현합니다.

## 1. 로컬 Database 준비

Demo Seed는 안전을 위해 DB 이름이 정확히 `evalops_local` 또는 `evalops_test`인 경우에만 실행됩니다. `.env.example`을 참고해 로컬 환경변수를 준비하되 Placeholder를 실제 로컬 값으로 교체하고 해당 파일 자체를 수정하거나 실제 Credential을 저장소에 추가하지 마세요.

형식 예시:

```text
postgresql+asyncpg://evalops_user:<password>@localhost:5432/evalops_local
```

`<password>`는 실제 값이 아닌 Placeholder입니다.

## 2. Migration 적용

```powershell
cd backend
uv sync --locked --all-groups
uv run --locked alembic upgrade head
```

## 3. Demo Seed 실행

```powershell
uv run --locked python -m src.scripts.seed_demo
```

최초 실행은 `Demo seed created.`와 함께 `project_id`, `dataset_version_id`, Experiment/Gate/Comparison 수와 최신 readiness를 출력합니다. API 호출에는 출력된 `project_id`를 사용하세요. 고정 UUID를 문서에 복제하지 않습니다.

Seed는 네 Experiment 시나리오를 구성합니다. Baseline 실패, 개선, 안정, 회귀를 통해 Gate의 `PASS|BLOCK`과 Comparison의 `IMPROVED|UNCHANGED|REGRESSED`를 조회할 수 있습니다.

## 4. API 확인 순서

Backend 실행:

```powershell
uv run --locked uvicorn src.api.main:app --reload
```

브라우저에서는 `http://localhost:8000/docs`를 열어 아래 순서로 호출할 수 있습니다.

1. `GET /api/v1/projects/{project_id}` — Seed Project 확인
2. `GET /api/v1/projects/{project_id}/dashboard-overview` — KPI, readiness, 최근 Experiment 확인
3. `GET /api/v1/projects/{project_id}/summary-report` — 기간 요약과 경고 확인
4. `GET /api/v1/projects/{project_id}/experiment-history` — 실행별 Gate와 비교 결과 확인
5. `GET /api/v1/projects/{project_id}/trend-summary` — 첫/최신 pass rate와 방향 확인
6. `GET /api/v1/projects/{project_id}/experiment-history.csv` — 같은 필터의 CSV 확인

기간 예시:

```text
?created_from=2026-07-01T00:00:00Z&created_to=2026-07-31T23:59:59Z
```

History와 CSV에는 필요하면 `experiment_status`, `gate_status`, `comparison_status`, `sort`를 추가합니다. CSV는 pagination 대신 최대 10,000행 제한을 적용합니다.

## 5. 재실행 확인

동일 명령을 다시 실행하면 기존 데이터가 Seed 정의와 같은지 검증하고 새 Row를 만들지 않습니다. 정상 응답은 다음 의미입니다.

```text
Demo seed already exists and matches the expected definition.
status: already_seeded
```

기존 결정론적 ID의 데이터가 기대 정의와 다르면 덮어쓰거나 삭제하지 않고 `DEMO_SEED_CONFLICT`로 종료합니다.
