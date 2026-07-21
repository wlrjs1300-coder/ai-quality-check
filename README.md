# EvalOps Monorepo (v0.1.0 Foundation)

이 저장소는 v0.1.0 Local Infrastructure 범위의 최소 실행 기반을 제공합니다.

## Scope (v0.1.0 Local Infrastructure)

- Next.js App Router 기반 Web 애플리케이션 초기화
- FastAPI 기반 Backend API 초기화
- PostgreSQL, Redis, MinIO를 포함한 Docker Compose 구성
- Alembic 마이그레이션 기본 구조 구성
- Frontend 및 Backend Health 확인 경로 구성
- 기본 빌드·테스트 및 저장소 정책 점검

## 실행 경로

- `apps/web`
- `backend`
- `compose.yml`

## Next.js Web 실행 방법

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

## CI Quality Checks (Repository Quality Checks)

GitHub Actions는 `Repository Quality Checks` 워크플로우에서 다음 검증을 실행합니다.

- Repository policy check
- Git author policy check
- Frontend dependency install (`npm ci`)
- Frontend typecheck
- Frontend build
- Backend dependency sync (`uv sync --all-groups`)
- Backend ruff check
- Backend pytest
- Docker Compose config validation

실행 방법:

```powershell
git checkout feat/v0.1.1-quality-checks
git pull

# PR 또는 develop 브랜치 push 시 자동 실행
```
