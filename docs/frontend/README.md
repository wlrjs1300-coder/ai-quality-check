# Frontend API Contract

이 문서는 EvalOps Web 화면의 API 사용 계약을 정의합니다. Slice 1~7의 조회·실행·Gate 흐름에 이어 Slice 8의 Baseline Comparison 생성·상세·Case Diff 흐름이 구현됐습니다.

## 문서

- [Screen API Contract](SCREEN_API_CONTRACT.md): 화면별 호출·필드·이동·재조회 계약
- [State and Error Contract](STATE_AND_ERROR_CONTRACT.md): 화면 상태, 오류, 표시 규칙
- [Implementation Order](IMPLEMENTATION_ORDER.md): MVP Vertical Slice 순서와 완료 조건
- [Public API Documentation](../api/README.md): Backend 전체 공개 계약

## 책임 경계

- Backend는 상태 전이, 불변 Snapshot, 평가 실행과 오류 코드를 결정합니다.
- Frontend는 Backend 결과를 임의로 재판정하지 않고 Loading·Empty·Success·Error 상태와 사용자 행동으로 변환합니다.
- API Base URL은 `NEXT_PUBLIC_API_BASE_URL`을 사용합니다. 로컬 기본값은 `http://localhost:8000`입니다.
- 인증·인가, 실시간 Push, Offline mutation queue는 현재 계약에 포함하지 않습니다.

## 공통 API Client 개념

실제 Library를 지정하지 않고 다음 경계를 사용합니다.

```ts
request<T>(method, path, options): Promise<T>
getData<T>(path, query): Promise<{ data: T; requestId: string }>
getPaginatedData<T>(path, query): Promise<{ data: T[]; requestId: string; pagination: Pagination }>
downloadCsv(path, query): Promise<{ blob: Blob; filename: string }>
```

`request`는 `NEXT_PUBLIC_API_BASE_URL`과 상대 Path를 결합하고 JSON 성공 응답, 애플리케이션 오류 Envelope, FastAPI `detail[]`, Network 오류, 예상하지 못한 응답을 구분합니다. Health와 CSV는 일반 Envelope 해제 대상이 아닙니다.

## MVP 화면

1. Projects
2. Project Overview
3. Dataset Detail
4. Target Detail
5. Evaluator Detail
6. Experiment Create
7. Experiment Detail
8. History
9. Comparison Detail

Project Overview에 Dashboard와 Summary를, Dataset Detail에 Case와 Version을, 각 Registry Detail에 Version을 통합해 화면 수를 줄입니다.
## Frontend Proxy Runtime Configuration

- `NEXT_PUBLIC_API_BASE_URL=/api/backend`
  - Frontend browser requests use same-origin path `/api/backend/*` and never call `http://localhost:8000` directly.
- `BACKEND_API_BASE_URL=http://localhost:8000`
  - Next.js rewrites this to backend `http://localhost:8000/api/v1/*` in production.
- 구현된 화면에서 사용하는 API route
  - `GET /projects`
  - `GET /projects/{projectId}`
  - `POST /projects`
  - `GET /projects/{projectId}/dashboard-overview`
  - `GET /projects/{projectId}/summary-report`
  - `GET /projects/{projectId}/trend-summary`
  - `GET /projects/{projectId}/experiment-history`
  - `GET /projects/{projectId}/experiment-history.csv`
  - Dataset·Evaluation Case·Dataset Version API
  - Target·Target Version 및 Evaluator·Evaluator Version API
  - Experiment 생성·단건 실행·상태 및 Evaluation Result API
  - Quality Gate Policy 생성·단건 조회, 평가 및 Result 단건 조회 API
  - Baseline Comparison 생성·단건 조회 및 Case Diff 목록 API
- Verify in browser
  - `http://localhost:3000/projects` should call backend through `http://localhost:8000/api/v1/projects`.
  - Project Overview와 History도 같은 proxy를 사용하며 기간·상태·정렬 Query를 Backend에 전달합니다.

## Experiment Scope 제약

- Experiment 단건 응답에는 `project_id`가 없고 Project-scoped 단건 API도 없습니다.
- 상세 화면은 URL의 Project 범위에서 `dataset_version_id`를 찾은 뒤에만 Experiment와 Result를 표시합니다.
- 이 탐색은 잘못 조합된 URL에서 상세 노출을 줄이는 방어적 UX이며 Backend 권한 검사를 대체하지 않습니다.
- Target·Evaluator 메타데이터 복원 실패는 상세 전체를 차단하지 않고 해당 Version ID를 fallback으로 표시합니다.
- History와 Dashboard에서는 Version 이름 복원을 위한 추가 N+1 요청이나 Input·Output Snapshot 조회를 수행하지 않습니다.

## Basic Quality Gate 제약

- 완료된 Experiment에서 Policy를 생성한 뒤 같은 Policy로 즉시 평가하며 PASS·BLOCK은 Backend 결과를 그대로 표시합니다.
- Policy 목록·수정·비활성화·Version API와 Gate Result 목록 API는 없습니다.
- History는 Experiment별 최신 Gate Result만 제공하므로 최신 Result가 있으면 새 평가 UI를 제공하지 않습니다.
- 평가 요청 결과가 불확실하면 History의 최신 Result ID로 Result와 Policy를 복원합니다.
- Policy 생성 Network Error는 생성된 Policy ID를 조회할 방법이 없어 완전 복구할 수 없으며 자동 재시도하지 않습니다.
- Severity 자체를 기준으로 한 Gate Rule은 없고 `required_for_release` Case 실패를 차단 조건으로 사용합니다.
- Frontend의 Project Scope 확인은 방어적 UX이며 Backend 권한 경계를 대체하지 않습니다.

## Baseline Comparison 제약

- 같은 Project와 Dataset Version을 사용하는 완료 Experiment만 후보로 표시하며 Result Case 집합의 완전 일치는 Backend가 최종 검증합니다.
- Comparison 목록 및 Project-scoped 목록 API가 없고 History는 Current Experiment별 최신 Comparison만 제공합니다.
- 중복 오류에는 기존 Comparison ID가 없으므로 History의 최신 Comparison이 선택한 Baseline과 정확히 일치할 때만 복구할 수 있습니다.
- 동일 Current의 과거 Comparison은 완전히 복원할 수 없습니다.
- Dashboard 최근 Experiment에는 Comparison ID가 없으며 Project Overview의 최상위 최신 Comparison만 상세 연결이 가능합니다.
- `total_case_count > 0`은 후보 보조 필터이며 실제 Result 존재를 보장하지 않습니다.
- Frontend의 Project Scope 검사는 방어적 UX이며 Backend 권한 검사를 대체하지 않습니다.
