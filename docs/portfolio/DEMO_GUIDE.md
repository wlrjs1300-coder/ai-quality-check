# EvalOps 시연 가이드

이 문서는 EvalOps의 핵심 흐름을 짧고 안정적으로 시연하기 위한 순서를 정리합니다. 면접에서는 기능을 많이 보여주기보다, 평가 조건을 고정하고 결과를 비교하는 구조를 중심으로 설명합니다.

## 시연 목표

시연에서 전달할 핵심은 다음 세 가지입니다.

1. Dataset, Target, Evaluator를 각각 버전으로 고정한다.
2. 세 Version을 조합해 Experiment를 실행한다.
3. Quality Gate와 Baseline Comparison으로 결과를 판단한다.

권장 시연 시간은 3분 안팎입니다.

---

## 1. 실행 환경 준비

### Docker Desktop 실행

Docker Desktop을 실행한 뒤 다음 명령으로 상태를 확인합니다.

```powershell
docker version
docker ps
```

### 인프라 실행

저장소 루트에서 실행합니다.

```powershell
cd <저장소 경로>

docker compose up -d postgres redis minio
```

PostgreSQL 준비 상태 확인:

```powershell
docker exec evalops-postgres pg_isready
```

정상 기준:

```text
accepting connections
```

---

## 2. Backend 준비

새 PowerShell 창에서 실행합니다.

```powershell
cd <저장소 경로>\backend

uv sync --locked --all-groups
uv run --locked alembic upgrade head
uv run --locked python -m src.scripts.seed_demo
uv run --locked uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

Backend 창은 시연이 끝날 때까지 닫지 않습니다.

상태 확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Project API 확인:

```powershell
Invoke-RestMethod `
  "http://127.0.0.1:8000/api/v1/projects?page=1&size=20"
```

---

## 3. Frontend 준비

새 PowerShell 창에서 실행합니다.

```powershell
cd <저장소 경로>\apps\web

npm ci
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000/projects
```

---

## 4. Projects 화면

보여줄 내용:

- Project 목록
- Project 생성 진입점
- 페이지네이션
- Project 상세 이동

설명 예시:

> 평가 데이터와 실행 설정을 Project 단위로 관리합니다. 하나의 Project 안에서 Dataset, Target, Evaluator, Experiment 이력을 함께 조회할 수 있습니다.

---

## 5. Project Overview

보여줄 내용:

- Release Readiness
- Dashboard 지표
- 최근 Experiment
- Dataset, Target, Evaluator 진입점

설명 예시:

> 이 화면은 최근 평가 결과와 배포 가능 여부를 먼저 확인하는 화면입니다. Dataset, Target, Evaluator는 서로 다른 변경 주기를 가지기 때문에 각각 분리해 관리합니다.

---

## 6. Dataset과 Version

보여줄 내용:

- Evaluation Case 목록
- Case 상태
- Severity
- 필수 통과 여부
- Dataset Version
- Content Hash

설명 예시:

> Evaluation Case는 작성 중, 승인, 폐기 상태로 관리합니다. 승인된 Case만 Dataset Version에 포함되고, Experiment는 원본 Dataset이 아니라 생성 시점의 Version을 참조합니다.

---

## 7. Target과 Evaluator

### Target

보여줄 내용:

- MOCK Target
- FIXED 응답
- Target Version

설명 예시:

> 현재는 전체 평가 흐름을 검증하기 위해 고정 응답 Target을 사용합니다. 실제 서비스 단계에서는 동일한 Version 계약을 유지하면서 외부 모델 Provider를 연결할 예정입니다.

### Evaluator

보여줄 내용:

- Evaluator Type
- Config
- Evaluator Version

설명 예시:

> Evaluator는 응답을 어떤 기준으로 판정할지 정의합니다. 현재는 CONTAINS, NOT_CONTAINS, REGEX를 지원합니다.

---

## 8. Experiment 생성

보여줄 내용:

- Dataset Version 선택
- Target Version 선택
- Evaluator Version 선택
- 같은 Project 범위 검증

설명 예시:

> Experiment는 세 원본 리소스가 아니라 세 Version의 조합으로 생성됩니다. 이 구조를 통해 어떤 조건에서 실행됐는지 이후에도 정확히 확인할 수 있습니다.

---

## 9. Experiment 실행과 Result

보여줄 내용:

- Experiment 상태
- 실행 버튼
- Case별 PASS, FAIL, ERROR
- 실패 이유
- 입력·출력 Snapshot

설명 예시:

> Experiment는 한 번만 실행할 수 있습니다. 각 Case 결과와 실패 이유, 입력과 출력 Snapshot을 함께 보존합니다.

---

## 10. Quality Gate

보여줄 내용:

- 최소 통과율
- Error 차단 여부
- 필수 Case 실패 차단 여부
- PASS 또는 BLOCK 결과

설명 예시:

> Quality Gate는 현재 Experiment가 정해진 절대 기준을 통과했는지 판단합니다. 통과율뿐 아니라 Error와 필수 Case 실패 여부도 함께 확인합니다.

---

## 11. Baseline Comparison

보여줄 내용:

- Baseline Experiment 선택
- IMPROVED, UNCHANGED, REGRESSED
- Pass Rate Delta
- Case별 변화

설명 예시:

> Baseline Comparison은 이전 결과와 비교해 개선됐는지 회귀했는지 판단합니다. Quality Gate는 절대 기준이고, Comparison은 상대 기준이라 두 기능을 분리했습니다.

---

## 12. History와 CSV

보여줄 내용:

- Experiment 상태 필터
- Gate 상태 필터
- Comparison 상태 필터
- 기간 필터
- CSV 내보내기
- 상세 화면 이동

설명 예시:

> 모든 실행 결과는 History에서 다시 확인할 수 있습니다. 같은 필터 조건으로 CSV를 내려받아 외부 분석에도 사용할 수 있습니다.

---

## 권장 시연 순서

```text
Projects
→ Project Overview
→ Dataset Version
→ Target Version
→ Evaluator Version
→ Experiment
→ Quality Gate
→ Baseline Comparison
→ History
```

각 화면에서 핵심 한 가지씩만 보여줍니다.

---

## 면접에서 강조할 부분

### 단순 CRUD가 아닌 이유

- 변경 가능한 원본과 불변 Version 분리
- Experiment가 Version ID를 참조
- Case별 결과와 Snapshot 보존
- Gate와 Comparison을 별도 판단으로 구성

### 신뢰성을 위해 적용한 처리

- 상태 전이 제한
- 중복 실행 차단
- Mutation 자동 재시도 제한
- 요청 취소와 최신 응답 보호
- 범위 초과 페이지 보정
- 404와 부분 오류 복구

### 현재 한계

- 인증과 권한은 아직 없음
- 외부 모델 Provider 미연동
- Experiment는 현재 Inline 실행
- 운영 모니터링과 비동기 Worker는 후속 단계

### 다음 개발 계획

- 사용자와 Workspace
- Backend 권한 검증
- 비동기 Worker와 Queue
- 외부 모델 Provider
- 운영 모니터링과 자동 배포

---

## 시연 중 문제 발생 시 복구

### Backend 연결 오류

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

응답이 없으면 Backend 창을 확인하고 다시 실행합니다.

### Database 연결 오류

```powershell
docker ps
docker start evalops-postgres
docker exec evalops-postgres pg_isready
```

그다음 Backend를 다시 실행합니다.

### Demo 데이터 오류

```powershell
cd <저장소 경로>\backend

uv run --locked alembic upgrade head
uv run --locked python -m src.scripts.seed_demo
```

### Frontend 연결 오류

```powershell
cd <저장소 경로>\apps\web

npm run dev
```

---

## 시연 전 최종 확인표

- Docker Desktop 실행
- PostgreSQL 상태 정상
- Backend Health 정상
- Project API 정상
- Demo Seed 정상
- Frontend 접속 정상
- Demo Project 확인
- 완료된 Experiment 확인
- Gate 결과 확인
- Comparison 결과 확인
- History와 CSV 확인
- 브라우저 개발자 도구 오류 확인
