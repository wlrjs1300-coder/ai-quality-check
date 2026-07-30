# EvalOps Monorepo (v0.1.0 Foundation)

이 저장소는 v0.1.0 Local Infrastructure 범위의 최소 실행 기반을 제공합니다.

공개 HTTP API의 Endpoint와 오류·데모 흐름은 [Public API Documentation](docs/api/README.md)에서 확인할 수 있습니다.

향후 Web 화면의 API 사용 계약은 [Frontend API Contract](docs/frontend/README.md)에서 확인할 수 있습니다.

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

## Playwright Browser Smoke Test

Frontend Browser 검증 기반은 `apps/web`의 Playwright Test를 사용합니다.

현재 Foundation 범위는 Test 전용 `/runtime-validation` Route에서 실제 Keyboard Focus 이동을 확인하는 Smoke Test입니다.

검증 순서:

```text
Tab → 첫 번째 다시 시도 Button
Tab → 두 번째 다시 시도 Button
Shift+Tab → 첫 번째 다시 시도 Button
```

Playwright는 개발 Dependency로만 설치되며 기존 Google Chrome Channel을 사용합니다. 별도의 Playwright Browser Binary는 설치하지 않습니다.

Headless 실행:

```powershell
cd apps/web
npm.cmd run test:browser:smoke
```

Headed 실행:

```powershell
cd apps/web
npm.cmd run test:browser:smoke:headed
```

전체 Browser Test 실행:

```powershell
cd apps/web
npm.cmd run test:browser
```

Playwright의 Test 전용 Web Server에만 `RUNTIME_VALIDATION_ENABLED=true`가 전달됩니다. 일반 실행과 Production 환경에서는 `/runtime-validation` Route가 계속 `HTTP 404`로 차단됩니다.

생성 Artifact:

```text
apps/web/test-results/
apps/web/playwright-report/
apps/web/blob-report/
```

위 Artifact는 Git 추적 대상이 아닙니다.

이번 Foundation은 Runtime Validation Route의 Keyboard Focus Smoke Test만 포함합니다. 제품 7개 Route × 3 Viewport 검증과 Phase A3 최종 판정은 후속 작업에서 수행합니다.

CI와 GitHub Actions에는 아직 Playwright를 추가하지 않습니다.
