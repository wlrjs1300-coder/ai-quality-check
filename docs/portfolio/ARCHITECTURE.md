# EvalOps 아키텍처

## 전체 구조

EvalOps는 Next.js 기반 Frontend, FastAPI 기반 Backend, PostgreSQL을 중심으로 구성됩니다.

```text
사용자
  ↓
Next.js Frontend
  ↓
Same-origin API Proxy
  ↓
FastAPI Backend
  ↓
PostgreSQL
```

로컬 개발 환경에는 Redis와 MinIO도 포함돼 있습니다. 현재 구현된 핵심 흐름은 PostgreSQL을 중심으로 동작하며, Redis와 MinIO는 이후 비동기 작업과 객체 저장 기능 확장을 위한 기반으로 유지합니다.

---

## 구성 요소

### Frontend

경로:

```text
apps/web
```

주요 역할:

- Project, Dataset, Target, Evaluator 관리 화면
- Version Snapshot 조회
- Experiment 생성과 실행
- Quality Gate 판정
- Baseline Comparison
- History 조회와 CSV 다운로드
- Loading, Empty, Refreshing, Error 상태 처리
- 404 복귀와 Project Scope 대조
- 페이지네이션과 요청 경합 제어

Frontend는 Backend의 판정 결과를 다시 계산하지 않습니다. 상태 전이, Gate 판정, Comparison 결과는 Backend 응답을 그대로 사용하고, 화면에서는 이를 사용자 행동과 상태 표시로 변환합니다.

### Backend

경로:

```text
backend
```

주요 역할:

- 공개 HTTP API 제공
- 리소스 상태 전이 검증
- Version Snapshot 생성
- Experiment 실행
- Case별 평가 결과 생성
- Quality Gate 판정
- Baseline Comparison 생성
- History, Trend, Summary, Dashboard 데이터 제공
- CSV 생성
- 오류 코드와 응답 형식 관리

### Database

PostgreSQL은 다음 데이터를 저장합니다.

- Project
- Dataset과 Evaluation Case
- Dataset Version Snapshot
- Target과 Target Version
- Evaluator와 Evaluator Version
- Experiment
- Evaluation Result
- Quality Gate Policy와 Result
- Baseline Comparison
- 실행 이력과 요약 데이터

Version과 결과 데이터는 기존 실행 조건을 다시 확인할 수 있도록 생성 시점 정보를 보존합니다.

---

## 요청 흐름

### 일반 조회

```text
사용자 화면 진입
→ Frontend API Client
→ Next.js Proxy
→ FastAPI Endpoint
→ Service
→ Repository
→ PostgreSQL
→ 응답 Envelope
→ Frontend 상태 반영
```

목록 응답은 다음 Pagination 정보를 포함합니다.

```text
total
page
size
```

Frontend는 `total`과 `size`를 기준으로 전체 페이지 수를 계산합니다.

### Mutation

```text
사용자 Action
→ 중복 제출 차단
→ Backend 요청
→ 상태와 무결성 검증
→ Database 반영
→ 관련 데이터 재조회
→ 화면 갱신
```

생성이나 실행 요청은 자동으로 다시 보내지 않습니다. 네트워크 오류가 발생하면 관련 데이터를 먼저 조회해 실제 반영 여부를 확인한 뒤 사용자가 다시 시도하도록 구성했습니다.

---

## 핵심 도메인 관계

```text
Project
├─ Dataset
│  ├─ Evaluation Case
│  └─ Dataset Version
├─ Target
│  └─ Target Version
├─ Evaluator
│  └─ Evaluator Version
├─ Experiment
│  └─ Evaluation Result
├─ Quality Gate Policy
│  └─ Quality Gate Result
└─ Baseline Comparison
```

Experiment는 다음 세 Version을 참조합니다.

```text
Dataset Version
Target Version
Evaluator Version
```

원본 리소스가 수정되더라도 Experiment가 사용한 Version은 변경되지 않습니다.

---

## Version Snapshot

### Dataset Version

승인된 Evaluation Case만 포함합니다.

보존 정보:

- Case 내용
- Severity
- 필수 통과 여부
- 태그
- 필수 요소
- 금지 요소
- Content Hash

### Target Version

Target 설정을 생성 시점 기준으로 저장합니다.

현재 실행 가능한 조합:

```text
Target Type: MOCK
Response Strategy: FIXED
```

### Evaluator Version

Evaluator Type과 Config를 생성 시점 기준으로 저장합니다.

현재 지원 Type:

```text
CONTAINS
NOT_CONTAINS
REGEX
```

---

## Experiment 실행

```text
Experiment 생성
→ 상태 CREATED
→ 실행 요청
→ 상태 RUNNING
→ Dataset Version의 Case 순회
→ Target Version 실행
→ Evaluator Version 판정
→ Case별 Result 저장
→ 상태 COMPLETED 또는 FAILED
```

Case별 Result에는 다음 정보를 보존합니다.

- 상태
- 실패 코드와 이유
- 입력 Snapshot
- 출력 Snapshot
- 생성 시각

Experiment는 한 번만 실행할 수 있습니다.

---

## Quality Gate

Quality Gate는 완료된 Experiment 결과를 기준으로 배포 가능 여부를 판단합니다.

판정 조건:

- 최소 통과율
- Error 발생 시 차단 여부
- 필수 Case 실패 시 차단 여부

결과:

```text
PASS
BLOCK
```

Frontend는 Backend의 판정 결과를 그대로 표시합니다.

---

## Baseline Comparison

Baseline Comparison은 두 Experiment의 결과를 비교합니다.

비교 조건:

- 같은 Project
- 같은 Dataset Version
- 두 Experiment 모두 완료
- Case 결과 집합 일치

결과:

```text
IMPROVED
UNCHANGED
REGRESSED
```

전체 판정과 Case별 상태 변화를 함께 저장합니다.

---

## 오류 처리

Backend는 오류 코드를 기준으로 응답합니다.

```text
404: 리소스 없음
409: 상태 충돌 또는 중복
422: 입력값 또는 조건 오류
500: 예상하지 못한 서버 오류
```

Frontend 처리 원칙:

- 404는 상위 화면 복귀 경로 제공
- 409는 관련 데이터를 다시 조회
- 422는 입력값 또는 상태 안내
- 네트워크 오류는 기존 데이터를 유지하고 재시도 제공
- 독립적으로 조회하는 화면 영역은 일부 요청이 실패해도 이미 조회한 정상 데이터를 유지

---

## 요청 경합 처리

Frontend는 빠른 화면 이동이나 연속 요청에서 오래된 응답이 최신 상태를 덮지 않도록 다음 방식을 사용합니다.

- `AbortController`로 이전 요청 취소
- 요청 ID 비교
- 현재 Controller와 응답 Controller 일치 확인
- Unmount 시 요청 무효화
- Loading 중 중복 Action 비활성화

페이지 범위를 벗어난 요청은 마지막 유효 페이지로 보정합니다.

---

## 실행 환경

### Docker Compose 서비스

```text
postgres
redis
minio
backend
web
```

### 기본 포트

```text
Frontend: 3000
Backend: 8000
PostgreSQL: 5432
Redis: 6379
MinIO API: 9000
MinIO Console: 9001
```

---

## 검증 구조

### Frontend

- TypeScript Typecheck
- ESLint
- Next.js Production Build
- Playwright Browser Test
- 1440px, 720px, 390px Viewport
- Keyboard 입력
- Overflow와 Focus Clipping
- Console, Page, Network 오류

### Backend

- Ruff
- Pytest
- API 계약 검증
- Migration
- Demo Seed 재실행 검증

### CI

GitHub Actions에서 다음 항목을 확인합니다.

- 저장소 정책
- Git 작성자 정책
- Frontend Typecheck와 Build
- Backend Ruff와 Pytest
- Docker Compose 설정

---

## 현재 한계

- 인증과 권한 없음
- 사용자별 데이터 분리 없음
- 외부 모델 Provider 미연동
- Experiment는 Inline 실행
- 비동기 Worker 없음
- 운영 모니터링과 장애 알림 없음
- Redis와 MinIO는 핵심 공개 흐름에서 아직 사용하지 않음

후속 구현 순서는 [개발 로드맵](ROADMAP.md)을 기준으로 합니다.
