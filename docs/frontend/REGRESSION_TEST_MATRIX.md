# Frontend Regression Test Matrix

## 목적

이 문서는 현재 Frontend Route와 핵심 기능의 검증 상태를 기록합니다. 기능이 코드에 존재한다는 사실과 현재 세션에서 동작을 검증했다는 사실을 분리하며, 측정하거나 실행하지 않은 항목을 완료로 표시하지 않습니다.

## 상태와 증거 계약

### 현재 상태

- `VERIFIED_MANUAL`: 날짜가 기록된 개발 세션에서 Browser로 직접 확인
- `STATIC_ONLY`: Typecheck, lint 또는 production build만 확인
- `NOT_VERIFIED_DATA_LIMIT`: 필요한 Demo 데이터가 부족해 시나리오를 실행하지 못함
- `REGRESSION_REQUIRED`: 구현은 존재하지만 현재 기준으로 다시 검증해야 함
- `NOT_IMPLEMENTED`: 화면 또는 기능이 구현되지 않음
- `BLOCKED_BY_BACKEND`: 필요한 Backend 계약이 없어 검증할 수 없음

### 검증 유형

- `Browser Manual`
- `Typecheck`
- `Lint`
- `Production Build`
- `Backend Test`
- `API Smoke`
- `Not Tested`

### 증거 수준

- `Repository Evidence`: 코드, 테스트 또는 build 결과처럼 저장소에서 다시 확인 가능한 증거
- `Session Manual Evidence`: 실제 개발 세션에서 수동 확인했지만 Screenshot 또는 자동 Report가 저장소에 없음
- `No Durable Evidence`: 지속 가능한 검증 증거가 없음

날짜가 없는 수동 확인 항목은 검증 완료로 간주하지 않습니다.

## Route Inventory

| ID | 영역 | Route | 시나리오 | 사전 조건 | 필요한 Demo 데이터 | 예상 결과 | 현재 상태 | 검증 유형 | 마지막 검증일 | 증거 수준 | 자동화 후보 | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | Entry | `/` | 초기 진입 | Web 실행 | 없음 | `/projects`로 이동 | STATIC_ONLY | Production Build | - | Repository Evidence | Route Smoke | Redirect 코드와 build Route 확인 |
| R02 | Projects | `/projects` | 목록, 생성, Pagination, Empty, 오류 | Project API 실행 | Project 21건 이상(2페이지 이동 검증 시) | 목록과 생성 Form, Pagination 이동 또는 Empty, Error 상태 표시 | STATIC_ONLY | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | Pagination 코드 구현 및 정적 검증 완료. Browser 수동 검증 대기. 데이터 20건 이하 환경에서 실제 2페이지 이동은 NOT_VERIFIED_DATA_LIMIT |
| R03 | Project Overview | `/projects/{projectId}` | Dashboard, Summary, Trend, Registry 진입 | 유효 Project | Demo Seed Project | Release 상태와 최근 Experiment 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | 최신 Comparison Link와 오류 복구 일부 확인. Dataset Registry Pagination은 2026-07-23 검증 이후 추가 구현되어 STATIC_ONLY이며 이 날짜의 수동 검증에는 포함되지 않음 |
| R04 | History | `/projects/{projectId}/history` | Filter, CSV, pagination, 상세 이동 | 유효 Project | 네 Demo Experiment | History와 상세 Link, CSV 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | History는 Trend API를 직접 호출하지 않음 |
| R05 | Dataset | `/projects/{projectId}/datasets/{datasetId}` | Case 상태 전이와 Version 관리 | 유효 Project와 Dataset | DRAFT, APPROVED Case | Case와 Dataset Version 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | 404 복귀와 Project Scope 보강 필요 |
| R06 | Dataset Version | `/projects/{projectId}/datasets/{datasetId}/versions/{version}` | 불변 Snapshot 조회 | Dataset Version 존재 | Snapshot Case | Hash와 Case Snapshot 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | 404 복귀와 Project Scope 보강 필요 |
| R07 | Target | `/projects/{projectId}/targets/{targetId}` | MOCK 설정과 FIXED Version 관리 | 유효 Target | Target Version 1, 2 | 설정과 불변 Version 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | URL Project Scope 대조 필요 |
| R08 | Target Version | `/projects/{projectId}/targets/{targetId}/versions/{version}` | FIXED Snapshot 조회와 404 복귀 | Target Version 또는 404 | Target Version 1, 2 | Snapshot 또는 Target 복귀 Action 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | API 요청 AbortSignal 보강 필요 |
| R09 | Evaluator | `/projects/{projectId}/evaluators/{evaluatorId}` | 설정과 Version 관리 | 유효 Evaluator | 세 Evaluator Type | 설정과 불변 Version 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | URL Project Scope 대조 필요 |
| R10 | Evaluator Version | `/projects/{projectId}/evaluators/{evaluatorId}/versions/{version}` | Evaluator Snapshot 조회와 404 복귀 | Evaluator Version 또는 404 | Version 1, 2와 REGEX | Snapshot 또는 Evaluator 복귀 Action 표시 | REGRESSION_REQUIRED | Typecheck, Lint, Production Build | - | Repository Evidence | Browser E2E | API 요청 AbortSignal 보강 필요 |
| R11 | Experiment Create | `/projects/{projectId}/experiments/new` | Version 선택과 생성 | 세 Version 존재 | Dataset, Target, Evaluator Version | 같은 Project 범위의 Experiment 생성 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | 20건 초과 선택 pagination은 미검증 |
| R12 | Experiment Detail | `/projects/{projectId}/experiments/{experimentId}` | Inline 실행, Result, Gate, Comparison | 유효 Experiment | PASS Result와 Gate 데이터 | 상태, Result, 판정과 복구 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | FAILED 실행과 새 BLOCK 생성은 미검증 |
| R13 | Comparison Detail | `/projects/{projectId}/comparisons/{comparisonId}` | Summary, Case Diff, scope, 404 | 유효 Comparison | REGRESSED와 Case Diff 5건 | 전체 판정과 Case 변화 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | IMPROVED와 UNCHANGED 생성은 미검증 |

## Pagination 구현 상태

| 기능 | 현재 상태 | 검증 유형 | 증거 수준 | 비고 |
|---|---|---|---|---|
| Projects Pagination | STATIC_ONLY | Typecheck, Lint, Production Build | Repository Evidence | Browser 수동 검증 전. 데이터 20건 이하이면 실제 2페이지 이동은 NOT_VERIFIED_DATA_LIMIT |
| Dataset Registry Pagination | STATIC_ONLY | Typecheck, Lint, Production Build | Repository Evidence | Browser 수동 검증 전. 2026-07-23 R03 수동 검증에는 포함되지 않음. 데이터 20건 이하이면 실제 2페이지 이동은 NOT_VERIFIED_DATA_LIMIT |

## 2026-07-23 수동 Browser 검증

아래 항목은 모두 `VERIFIED_MANUAL`, `Browser Manual`, `Session Manual Evidence`입니다. 저장소에 Screenshot 또는 자동 Report는 보관되지 않았습니다.

### Experiment

- Dataset, Target, Evaluator Version 선택
- Experiment 생성
- Inline 실행
- `COMPLETED` 상태
- PASS Result
- 새로고침 후 상태와 Result 복원
- Backend 중단 Network 오류와 Retry
- 같은 Experiment 재실행 차단

### History와 Dashboard

- History 목록
- Filter UI
- CSV 다운로드
- Experiment 상세 Link
- Comparison 상세 Link
- Dashboard 최신 Comparison Link
- Project 404 복귀
- 잘못 조합한 Project Scope 차단
- Network 오류와 Retry
- Tab focus와 Enter 이동

### Quality Gate

- `COMPLETED` Experiment의 Gate Form
- 기본값
- 0% 허용
- 101% 입력 차단
- Policy 생성
- PASS 판정
- 읽기 전용 Result
- 새로고침 후 Result 복원
- 기존 BLOCK Result 표시
- Network 복구 후 Result 복원

### Baseline Comparison

- Empty 후보
- 같은 Project와 Dataset Version 후보
- Current Experiment 자신 제외
- Radio 선택
- REGRESSED Comparison 생성
- `-20.00%p`
- Summary
- Case Diff 5건
- 새로고침 복원
- History와 Dashboard Link
- 다른 Project Scope 차단
- Network 오류와 Retry

## 미검증 항목

| ID | 시나리오 | 현재 상태 | 검증 유형 | 증거 수준 | 필요한 조건 |
|---|---|---|---|---|---|
| U01 | FAILED Experiment 상세와 복구 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 실행 실패 Experiment |
| U02 | 새로운 Gate BLOCK 평가 생성 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 필수 Case 실패 Experiment |
| U03 | Gate 중복 평가 복구 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 기존 Gate에 같은 평가 요청 |
| U04 | 새 IMPROVED Comparison 생성 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 개선 Result 쌍 |
| U05 | 새 UNCHANGED Comparison 생성 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 같은 성능 Result 쌍 |
| U06 | Comparison 중복 복구 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 이미 존재하는 비교 쌍 |
| U07 | 20건 초과 페이지 이동 | NOT_VERIFIED_DATA_LIMIT | Not Tested | No Durable Evidence | 21건 이상 목록 |
| U08 | Dashboard 하위 API만 단독 실패 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 선택적 실패 주입 |
| U09 | Dataset, Target, Evaluator 전체 Scope 회귀 | REGRESSION_REQUIRED | Not Tested | No Durable Evidence | 서로 다른 Project 리소스 |

## 자동화 현황

현재 저장소에서 증명 가능한 Frontend 자동 검증은 다음뿐입니다.

- TypeScript typecheck
- ESLint
- Next.js production build

Playwright, Cypress, Vitest, Jest 또는 Browser E2E Runner는 현재 없습니다. Browser 동작은 수동 검증으로만 기록하며 자동 검증 완료로 표현하지 않습니다.

이 문서는 손상 전 Planning 기준을 복구한 것입니다. Projects와 Dataset Registry Pagination 구현 상태는 위 표에 STATIC_ONLY로 반영했으며, Browser 수동 검증은 아직 수행하지 않았습니다.
