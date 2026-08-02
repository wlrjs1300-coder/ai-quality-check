# EvalOps

EvalOps는 모델과 프롬프트의 평가 조건을 버전으로 고정하고, 동일한 기준으로 실행 결과를 비교할 수 있도록 만든 품질 검증 도구입니다.

Dataset, Target, Evaluator를 각각 관리하고 버전으로 저장한 뒤, 세 버전을 조합해 Experiment를 실행합니다. 실행 결과는 Case 단위로 확인할 수 있으며, Quality Gate와 Baseline Comparison을 통해 배포 가능 여부와 성능 변화를 판단합니다.

---

## 해결하려는 문제

모델이나 프롬프트를 수정한 뒤 결과가 좋아졌는지 확인하려면 평가 조건이 계속 같아야 합니다. 하지만 평가 데이터, 실행 대상, 판정 기준이 함께 바뀌면 이전 결과와 현재 결과를 정확히 비교하기 어렵습니다.

EvalOps는 다음 세 요소를 별도로 관리하고 각 상태를 버전으로 고정합니다.

- **Dataset**: 평가 질문과 기대 조건
- **Target**: 평가할 응답 대상
- **Evaluator**: 통과 여부를 판단하는 규칙

이 구조를 통해 같은 Dataset Version을 기준으로 여러 Experiment를 비교하고, 결과가 개선됐는지 회귀했는지 확인할 수 있습니다.

---

## 핵심 흐름

```text
Project 생성
→ Dataset·Target·Evaluator 등록
→ 각 리소스의 Version 생성
→ Version 조합으로 Experiment 생성
→ Experiment 실행
→ Case별 결과 확인
→ Quality Gate 판정
→ Baseline Comparison
→ History와 CSV로 이력 확인
```

---

## 주요 기능

### Project 관리

- Project 생성, 조회, 수정, 비활성화
- Dashboard Overview와 Summary Report 제공
- 기간별 Trend 확인
- Dataset, Target, Evaluator 진입점 제공

### Dataset과 Evaluation Case

- Evaluation Case 생성 및 수정
- `DRAFT`, `APPROVED`, `DEPRECATED` 상태 관리
- Severity와 필수 통과 여부 설정
- 승인된 Case만 포함한 Dataset Version 생성
- 생성 시점의 Case Snapshot과 Content Hash 보존

### Target과 Evaluator

- MOCK Target과 FIXED 응답 설정
- `CONTAINS`, `NOT_CONTAINS`, `REGEX` Evaluator 지원
- Target/Evaluator 설정을 Version Snapshot으로 저장
- 생성된 Version은 수정하거나 삭제하지 않음

### Experiment

- Dataset Version, Target Version, Evaluator Version 조합
- Experiment 실행
- `CREATED`, `RUNNING`, `COMPLETED`, `FAILED` 상태 관리
- Case별 `PASS`, `FAIL`, `ERROR` 결과 확인
- 입력·출력 Snapshot과 실패 이유 보존

### Quality Gate

- 최소 통과율 설정
- Error 발생 시 차단 여부 설정
- 필수 Case 실패 시 차단 여부 설정
- 최종 결과를 `PASS` 또는 `BLOCK`으로 판정

### Baseline Comparison

- 같은 Project와 Dataset Version을 사용하는 Experiment 비교
- 전체 결과를 `IMPROVED`, `UNCHANGED`, `REGRESSED`로 구분
- Case별 상태 변화와 회귀 이유 확인

### History와 CSV

- Experiment, Gate, Comparison 상태 필터
- 기간과 정렬 조건 유지
- 같은 조건으로 CSV 내보내기
- 최대 10,000행 제한과 스프레드시트 수식 해석 방지 처리

---

## 핵심 설계

### Version Snapshot

Dataset, Target, Evaluator는 변경 가능한 원본과 변경할 수 없는 Version을 분리했습니다.

Experiment는 원본이 아니라 Version ID를 참조합니다. 따라서 원본 설정이 이후에 바뀌더라도 기존 Experiment가 어떤 조건으로 실행됐는지 확인할 수 있습니다.

### 상태 전이 제한

평가 결과의 신뢰성을 유지하기 위해 다음 규칙을 적용했습니다.

- 승인되거나 폐기된 Evaluation Case는 수정할 수 없음
- 비활성화된 리소스는 조회만 가능
- Experiment는 한 번만 실행 가능
- 이미 평가된 Quality Gate는 중복 실행 차단
- 같은 Baseline·Current Experiment 쌍의 비교 결과 중복 생성 차단

### 오류 처리

Frontend는 Backend의 오류 코드를 기준으로 상태를 구분합니다.

- 404: 상위 화면으로 돌아갈 수 있는 경로 제공
- 409: 최신 상태를 다시 조회한 뒤 화면 갱신
- 422: 입력값과 상태 조건에 맞는 안내 표시
- 네트워크 오류: 기존 데이터가 있으면 유지한 채 재시도 제공

Loading, Empty, Refreshing, Error 상태를 분리해 최초 로딩과 부분 갱신을 같은 화면으로 처리하지 않도록 구성했습니다.

### 요청 경합 방지

목록이나 상세 화면에서 새로운 요청이 시작되면 이전 요청을 취소하고, 마지막 요청의 응답만 반영합니다.

Pagination 이동 중에는 이전·다음 버튼을 비활성화해 중복 요청을 막고, 범위를 벗어난 페이지는 마지막 유효 페이지로 보정합니다.

---

## 기술 구성

| 구분 | 기술 |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 16 |
| 캐시·작업 대기열 | Redis 7 |
| 객체 저장소 | MinIO |
| 브라우저 테스트 | Playwright |
| 컨테이너 | Docker, Docker Compose |
| CI | GitHub Actions |

Redis와 MinIO는 로컬 인프라에 포함돼 있지만, 현재 구현된 핵심 흐름은 PostgreSQL을 중심으로 동작합니다.

---

## 프로젝트 구조

```text
ai-quality-check/
├─ apps/
│  └─ web/                 # Next.js Frontend
├─ backend/                # FastAPI Backend
├─ docs/
│  ├─ api/                 # API, 오류 코드, Demo 흐름
│  ├─ frontend/            # 화면 계약, 상태 계약, 회귀 기준
│  └─ portfolio/           # 아키텍처, 설계 결정, 시연, 개발 계획
├─ scripts/                # 저장소 점검 스크립트
├─ compose.yml             # 로컬 실행 환경
└─ README.md
```

---

## 로컬 실행

### 1. 환경변수 준비

```powershell
Copy-Item .env.example .env
```

`.env`의 Database, MinIO 관련 값을 로컬 환경에 맞게 수정합니다. 실제 비밀번호나 접근 키는 저장소에 커밋하지 않습니다.

### 2. 인프라 실행

```powershell
docker compose up -d postgres redis minio
```

### 3. Backend 준비

```powershell
cd backend

uv sync --locked --all-groups
uv run --locked alembic upgrade head
uv run --locked python -m src.scripts.seed_demo
uv run --locked uvicorn src.api.main:app --reload
```

Backend 기본 주소:

```text
http://localhost:8000
```

Swagger UI:

```text
http://localhost:8000/docs
```

### 4. Frontend 실행

새 PowerShell 창에서 실행합니다.

```powershell
cd apps/web

npm ci
npm run dev
```

Frontend 기본 주소:

```text
http://localhost:3000
```

---

## Demo 데이터

Demo Seed는 공개 합성 데이터로 다음 흐름을 구성합니다.

- Project와 평가 리소스
- Dataset Version
- Target Version
- Evaluator Version
- 네 가지 Experiment 시나리오
- Quality Gate의 `PASS`, `BLOCK`
- Baseline Comparison의 `IMPROVED`, `UNCHANGED`, `REGRESSED`

동일한 Seed를 다시 실행하면 기존 데이터가 정의와 같은지 확인하고 중복 데이터를 생성하지 않습니다.

자세한 실행 순서는 [Demo Workflow](docs/api/DEMO_WORKFLOW.md)를 참고하세요.

---

## 검증

### Frontend

```powershell
cd apps/web

npm run typecheck
npm run lint
npm run build
```

주요 Browser 회귀 테스트:

```powershell
npm run test:browser:product-focus
npm run test:browser:b1
npm run test:browser:b2-0
npm run test:browser:b2-1
npm run test:browser:b2-2a
```

Headed 실행은 각 명령 뒤에 `:headed`가 붙은 Script를 사용합니다.

현재 자동 Browser 검증 범위에는 다음 항목이 포함됩니다.

- 주요 제품 Route
- Breadcrumb와 PageHeader
- 공통 Pagination
- 첫·중간·마지막 페이지
- Empty 상태
- 범위 초과 페이지 보정
- Loading 중 중복 요청 차단
- Tab, Shift+Tab, Enter, Space
- 1440px, 720px, 390px 화면
- 가로 Overflow와 Focus Clipping
- Console, Page, 네트워크 오류

### Backend

```powershell
cd backend

uv run ruff check .
uv run pytest
```

### CI

Pull Request와 `develop` 브랜치 Push 시 GitHub Actions에서 다음 항목을 확인합니다.

- 저장소 정책
- Git 작성자 정책
- Frontend Typecheck
- Frontend 프로덕션 빌드
- Backend Ruff
- Backend Pytest
- Docker Compose 설정 검사

---

## 현재 구현 범위

현재 버전은 로컬 환경에서 평가 조건을 만들고, Experiment를 실행한 뒤 결과를 비교하는 전체 흐름에 초점을 맞추고 있습니다.

포함된 범위:

- Project와 평가 리소스 관리
- Version Snapshot
- Experiment 실행
- Quality Gate
- Baseline Comparison
- History와 CSV
- 주요 오류와 복구 화면
- 반응형 화면과 Keyboard 회귀 검증

현재 포함하지 않는 범위:

- 회원가입과 로그인
- 사용자별 데이터 분리
- Workspace와 역할 기반 권한
- 외부 모델 Provider 연결
- 비동기 Worker와 작업 Queue
- 운영 모니터링과 장애 알림
- 결제와 사용량 관리

---

## 향후 개발 계획

### 1. 사용자와 권한

- 회원가입과 로그인
- 사용자별 Project 분리
- Workspace와 초대
- 역할 기반 권한 관리
- Backend Project Scope 검증

### 2. 실행 구조 개선

- Experiment 비동기 실행
- Worker와 Queue 도입
- 재시도, Timeout, 중복 실행 방지
- 작업 취소와 실행 상태 복구

### 3. 운영 환경

- Staging과 Production 분리
- CI/CD 자동 배포
- 로그와 오류 수집
- 상태 지표와 장애 알림
- Database Backup과 복구 절차
- 부하 테스트와 운영 문서

### 4. 평가 기능 확장

- 외부 모델 Provider 연결
- Evaluator 유형 확장
- Dataset Import
- 비교 이력 조회 개선
- 대규모 결과 탐색과 필터 강화

---

## 문서

- [API 문서](docs/api/README.md)
- [전체 API 명세](docs/api/API_REFERENCE.md)
- [오류 코드](docs/api/ERROR_REFERENCE.md)
- [Demo Workflow](docs/api/DEMO_WORKFLOW.md)
- [Frontend API Contract](docs/frontend/README.md)
- [Frontend 화면 계약](docs/frontend/SCREEN_API_CONTRACT.md)
- [Frontend 상태와 오류 계약](docs/frontend/STATE_AND_ERROR_CONTRACT.md)
- [회귀 테스트 기준](docs/frontend/REGRESSION_TEST_MATRIX.md)
- [UI/UX 개선 계획](docs/frontend/UI_UX_ROADMAP.md)
- [아키텍처](docs/portfolio/ARCHITECTURE.md)
- [주요 설계 결정](docs/portfolio/DESIGN_DECISIONS.md)
- [시연 가이드](docs/portfolio/DEMO_GUIDE.md)
- [개발 로드맵](docs/portfolio/ROADMAP.md)
