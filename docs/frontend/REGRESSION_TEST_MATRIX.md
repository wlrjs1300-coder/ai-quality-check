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
- `BLOCKED_BY_TIME`: 세션 시간 제약으로 계획했으나 수행하지 못함

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
| R02-1 | Projects | `/projects` | 목록, 생성, 1페이지 Pagination, Network Error/Retry | Project API 실행 | Demo Seed Project + Scope Test Project(2건) | 목록과 생성 Form, 1페이지 Pagination, Error 상태 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | 첫 페이지 표시, Project 생성 후 전체 2건 재조회 및 최신순 표시, Pagination "1 / 1" 및 이전/다음 버튼 비활성, Backend 중단 Network Error·"다시 시도"·재기동 후 복구 확인 |
| R02-2 | Projects | `/projects` | 2페이지 이동, 마지막 페이지 이동 | Project 21건 이상 | Project 21건 이상 | 2페이지 이동과 마지막 페이지에서 다음 버튼 비활성 표시 | NOT_VERIFIED_DATA_LIMIT | Not Tested | - | No Durable Evidence | Browser E2E | Project 2건뿐이어서 미검증. 검증을 위해 21건 이상을 인위적으로 생성하지 않음 |
| R02-3 | Projects | `/projects` | Empty 상태 | Project 0건 | Project 0건 | EmptyState와 생성 유도 문구 표시 | NOT_VERIFIED_DATA_LIMIT | Not Tested | - | No Durable Evidence | Browser E2E | Demo Seed Project와 Scope Test Project(Project B)가 이미 존재하며 검증을 위해 데이터를 삭제하지 않아 Empty 상태를 재현하지 못함 |
| R03 | Project Overview | `/projects/{projectId}` | Dashboard, Summary, Trend, Registry 진입 | 유효 Project | Demo Seed Project | Release 상태와 최근 Experiment 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | 최신 Comparison Link와 오류 복구 일부 확인(2026-07-23). Dataset Registry Pagination은 2026-07-25 세션에서 실제 Browser로 시도했으나 Project A Dataset이 1건뿐이라 2페이지 이동과 Empty 상태는 NOT_VERIFIED_DATA_LIMIT으로 확정됨 |
| R04 | History | `/projects/{projectId}/history` | Filter, CSV, pagination, 상세 이동 | 유효 Project | 네 Demo Experiment | History와 상세 Link, CSV 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | History는 Trend API를 직접 호출하지 않음 |
| R05 | Dataset | `/projects/{projectId}/datasets/{datasetId}` | Case 상태 전이, Version 관리, 404 복귀, Project Scope 대조 | 유효 Project와 Dataset | DRAFT, APPROVED Case | Case와 Dataset Version 표시, 존재하지 않거나 다른 Project 소속인 Dataset은 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | 404(존재하지 않는 UUID, 잘못된 UUID)와 Project Scope 불일치(Project B URL) 모두 "Dataset을 찾을 수 없습니다.", Retry 미노출, 복귀 Link, Breadcrumb 유지, Resource 미노출 확인. `fix/v0.25.5-dataset-array-parser`의 `normalizedStringArray` 적용 후 재검증: 기존 Seed Evaluation Case 5건 정상 표시(Case 카드 5개, 태그·필수 요소·금지 요소 문자열 정상, 파서 오류 미발생), 객체 배열(`{text}`/`{name}`) 형태의 새 DRAFT Case 생성 시 전체 6건으로 정상 반영되고 필수 요소 1·금지 요소 1·태그 1이 정상 표시되며 파싱 오류 없이 string[]으로 정규화됨, 새 Case 수정 Form에서 값이 정상 재입력됨(Case key·Question·Expected Summary 포함). §Dataset 배열 파서 회귀 참고 |
| R06 | Dataset Version | `/projects/{projectId}/datasets/{datasetId}/versions/{version}` | 불변 Snapshot 조회, 404 복귀, Project Scope 대조 | Dataset Version 존재 | Snapshot Case | Hash와 Case Snapshot 표시, 존재하지 않거나 다른 Project 소속인 Version은 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | 404(없는 Version 2, 없는 Dataset UUID), 잘못된 Version(`abc`, `0`), Project Scope 불일치 모두 "Dataset Version을 찾을 수 없습니다."/"잘못된 Version 번호입니다.", Retry 미노출, 복귀 Link, Breadcrumb 유지, Resource 미노출 확인. `fix/v0.25.5-dataset-array-parser`의 `normalizedStringArray` 적용 후 재검증: Version 1 Snapshot Case 5건 정상 표시(Case 카드 5개), Content Hash 정상 표시, 태그·필수 요소·금지 요소 정상 표시, "Snapshot Case 응답 형식이 올바르지 않습니다." 오류 미발생. §Dataset 배열 파서 회귀 참고 |
| R07 | Target | `/projects/{projectId}/targets/{targetId}` | MOCK 설정과 FIXED Version 관리, Project Scope 대조 | 유효 Target | Target Version 1, 2 | 설정과 불변 Version 표시, 다른 Project 소속인 Target은 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | Target 상세 정상 표시 확인. Project B URL로 접근 시 "Target을 찾을 수 없습니다.", Retry 미노출, Project Overview 복귀 Link, Resource 정보 미노출 확인. Backend Authorization 또는 Scope 필터 구현이 아님(Frontend URL Scope 대조) |
| R08 | Target Version | `/projects/{projectId}/targets/{targetId}/versions/{version}` | FIXED Snapshot 조회, 404 복귀, Project Scope 대조, AbortSignal 보강 | Target Version 또는 404 | Target Version 1, 2 | Snapshot 또는 Target 복귀 Action 표시, 다른 Project 소속인 Version은 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | Version 1 정상 표시, Version 1~4 목록·Pagination(전체 4건·1/1) 확인. AbortSignal: 빠른 Route 전환 시 이전 Target·Version 요청이 DevTools Network에서 canceled(전송 크기 0.0 kB), 최신 요청만 200으로 반영, 이전 응답이 최신 화면을 덮지 않음, AbortError UI 미노출(Network 취소·최신 응답 반영은 VERIFIED_MANUAL). React unmounted component Console 경고는 이번 세션에서 독립적으로 전수 확인하지 않음. Project B URL Scope 차단 확인. Invalid Version 처리는 이번 검증 대상 아님 |
| R09 | Evaluator | `/projects/{projectId}/evaluators/{evaluatorId}` | 설정과 Version 관리, Project Scope 대조 | 유효 Evaluator | 세 Evaluator Type | 설정과 불변 Version 표시, 다른 Project 소속인 Evaluator는 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | Evaluator 상세 정상 표시 확인. Project B URL로 접근 시 "Evaluator를 찾을 수 없습니다.", Retry 미노출, Project Overview 복귀 Link, Resource 정보 미노출 확인 |
| R10 | Evaluator Version | `/projects/{projectId}/evaluators/{evaluatorId}/versions/{version}` | Evaluator Snapshot 조회, 404 복귀, Project Scope 대조, AbortSignal 보강 | Evaluator Version 또는 404 | Version 1, 2와 REGEX | Snapshot 또는 Evaluator 복귀 Action 표시, 다른 Project 소속인 Version은 복귀 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-25 | Session Manual Evidence | Browser E2E | Version 1 정상 표시 확인. AbortSignal: 이전 Evaluator·Version 요청이 DevTools Network에서 canceled(전송 크기 0.0 kB), 최신 요청만 200으로 반영, 이전 응답이 최신 화면을 덮지 않음, AbortError UI 미노출(Network 취소·최신 응답 반영은 VERIFIED_MANUAL). React unmounted component Console 경고는 이번 세션에서 독립적으로 전수 확인하지 않음. Project B URL Scope 차단 확인. Invalid Version 처리는 이번 검증 대상 아님 |
| R11 | Experiment Create | `/projects/{projectId}/experiments/new` | Version 선택과 생성 | 세 Version 존재 | Dataset, Target, Evaluator Version | 같은 Project 범위의 Experiment 생성 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | 20건 초과 선택 pagination은 미검증 |
| R12 | Experiment Detail | `/projects/{projectId}/experiments/{experimentId}` | Inline 실행, Result, Gate, Comparison | 유효 Experiment | PASS Result와 Gate 데이터 | 상태, Result, 판정과 복구 Action 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | FAILED 실행과 새 BLOCK 생성은 미검증 |
| R13 | Comparison Detail | `/projects/{projectId}/comparisons/{comparisonId}` | Summary, Case Diff, scope, 404 | 유효 Comparison | REGRESSED와 Case Diff 5건 | 전체 판정과 Case 변화 표시 | VERIFIED_MANUAL | Browser Manual | 2026-07-23 | Session Manual Evidence | Browser E2E | IMPROVED와 UNCHANGED 생성은 미검증 |

## Pagination 구현 상태

| 기능 | 현재 상태 | 검증 유형 | 증거 수준 | 비고 |
|---|---|---|---|---|
| Projects Pagination | VERIFIED_MANUAL | Browser Manual | Session Manual Evidence | 2026-07-25: 1페이지 표시, 생성 후 재조회, 이전/다음 비활성, Network Error/Retry 확인(R02-1). 2페이지 이동은 Project 2건뿐이라 NOT_VERIFIED_DATA_LIMIT(R02-2). Empty 상태는 Demo Seed Project와 Scope Test Project가 이미 존재하고 삭제를 수행하지 않아 재현하지 못함(R02-3) |
| Dataset Registry Pagination | NOT_VERIFIED_DATA_LIMIT | Browser Manual | Session Manual Evidence | 2026-07-25 Browser 세션에서 시도했으나 Project A Dataset이 1건뿐이라 2페이지 이동을 확인하지 못하고, 기존 Dataset이 이미 존재하고 삭제를 수행하지 않아 Empty 상태도 재현하지 못함. 2026-07-23 R03 수동 검증에는 포함되지 않았음 |

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

## 2026-07-25 Phase 0 Browser 회귀 검증

검증 환경: Windows, Chrome, Frontend `http://localhost:3000`, Backend `http://127.0.0.1:8000`, PostgreSQL Docker Container `evalops-postgres`(검증 전용 Volume `evalops_phase0_browser_pgdata`). 증거 수준은 모두 `Session Manual Evidence`이며 Screenshot이나 자동 Report는 저장소에 없으므로 `Repository Evidence`로 표현하지 않습니다.

### VERIFIED_MANUAL

- **Projects**: 첫 페이지 표시, Project 생성 후 전체 2건 재조회 및 최신순 표시, Pagination "1 / 1" 표시, 이전/다음 버튼 비활성, Backend 중단 시 "서버에 연결할 수 없습니다"와 "다시 시도" 표시, Backend 재기동 후 Retry 성공과 기존 Project 2건 복구.
- **Dataset 상세 404**: 존재하지 않는 유효 UUID에서 "Dataset을 찾을 수 없습니다.", Retry 미노출, Project Overview·Project 목록 복귀 Link, Breadcrumb 유지, 실제 Dataset 정보 미노출, 직접 URL 진입 동일.
- **Dataset 상세 잘못된 UUID**: `not-a-uuid` 입력 시 "입력값을 확인해 주세요.", 404로 위장되지 않음, Retry 미노출, Breadcrumb 유지.
- **Dataset Version 404**: 존재하는 Dataset + 없는 Version(2), 없는 Dataset UUID + Version 1 모두 "Dataset Version을 찾을 수 없습니다.", Retry 미노출, Dataset 상세·Project Overview 복귀 Link, Breadcrumb 유지, 실제 Resource 정보 미노출.
- **Dataset Version 잘못된 값**: Version `abc`, Version `0` 모두 "잘못된 Version 번호입니다.", 404로 위장되지 않음, Retry 미노출, Breadcrumb 유지.
- **Dataset 상세 정상 조회(파서 수정 후 재검증)**: 기존 Seed Evaluation Case 5건 정상 표시(Case 카드 5개), 태그 문자열·필수 요소·금지 요소 정상 표시, 파서 오류 미발생.
- **Dataset Version 정상 조회(파서 수정 후 재검증)**: Snapshot Case 5건 정상 표시(Case 카드 5개), Content Hash 정상 표시, 태그·필수 요소·금지 요소 정상 표시, "Snapshot Case 응답 형식이 올바르지 않습니다." 오류 미발생.
- **Dataset 파서 객체 배열 호환성**: `case_key: parser-object-array-check`, `required_elements: [{text:"required-one"}]`, `forbidden_elements: [{text:"forbidden-one"}]`, `tags: [{name:"parser-check"}]` 형태의 새 DRAFT Case 생성 시 전체 Case 수 6건으로 정상 반영, 새 Case 카드 정상 표시(필수 요소 1·금지 요소 1·태그 1), 객체 배열 응답이 파싱 오류 없이 string[]으로 정규화됨.
- **편집 Form 역변환**: 새 DRAFT Case의 수정 Form에서 `required-one`/`forbidden-one`/`parser-check`가 정상 재입력되고 Case key·Question·Expected Summary도 정상 유지됨.
- **Project Scope(6개 Route)**: Dataset 상세, Dataset Version, Target 상세, Target Version, Evaluator 상세, Evaluator Version 전부 Project A Resource를 Project B URL로 접근 시 실제 Resource 이름/설정 미노출, 기존 Not Found UX와 동일한 메시지, Retry 미노출, 복귀 Link 표시. Dataset 계열은 Breadcrumb에 실제 이름 미노출을 확인했고, Target/Evaluator 계열은 오류 화면에 Breadcrumb 자체가 없음(§UI 일관성 관찰사항 참고).
- **Target**: 상세 정상 표시, Version 1 정상 표시, Version 1~4 목록과 Pagination(전체 4건·1/1 페이지) 정상 표시.
- **Target Version AbortSignal**: 빠른 Route 전환 시 이전 Target·Target Version 요청이 DevTools Network에서 canceled(전송 크기 0.0 kB), 최신 요청만 200으로 반영되어 최종 화면에 최신 Version만 표시, 이전 응답이 최신 화면을 덮지 않음, AbortError UI 미노출 — Network 취소와 최신 응답 반영은 VERIFIED_MANUAL. React unmounted component Console 경고는 이번 세션에서 독립적으로 전수 확인하지 않음.
- **Evaluator**: 상세 정상 표시, Version 1 정상 표시.
- **Evaluator Version AbortSignal**: Target Version과 동일하게 이전 요청 canceled(전송 크기 0.0 kB), 최신 Version만 반영, AbortError 미노출 — Network 취소와 최신 응답 반영은 VERIFIED_MANUAL. React unmounted component Console 경고는 이번 세션에서 독립적으로 전수 확인하지 않음.
- **Projects Network Error/Retry**: 위 Projects 항목에 포함(대표 시나리오로 확인).

### Dataset 배열 파서 회귀 — 발견 및 해결 완료

두 항목 모두 같은 공통 Dataset 파서 결함으로 발생했습니다(최초 발견 시점에는 REGRESSION_REQUIRED였으며, 아래 재검증으로 해결됨).

- **A. Dataset 상세 Evaluation Cases(해결됨)**: Backend API는 `data` 5건과 `meta.pagination.total` 5를 정상 반환하지만, 최초 발견 시점 Browser에는 Evaluation Case가 0건으로 표시되고 목록이 아예 나타나지 않았습니다. 원인은 `apps/web/src/lib/api/datasets.ts`의 `parseEvaluationCase`가 `required_elements`/`forbidden_elements`/`tags`(실제 응답은 문자열 배열)를 객체 배열 전용 `objectArray`로 파싱해 실패했기 때문입니다.
- **B. Dataset Version 정상 조회(해결됨)**: 최초 발견 시점에는 Version 1 상세 접근 시 Snapshot Case, Content Hash 등 본문 대신 "Snapshot Case 응답 형식이 올바르지 않습니다." 오류가 표시됐습니다. 원인은 `parseSnapshotCase`가 동일한 배열 필드를 같은 방식으로 잘못 파싱했기 때문입니다.

**수정 내용**: `fix/v0.25.5-dataset-array-parser` 브랜치에서 `parseEvaluationCase`/`parseSnapshotCase`의 `required_elements`/`forbidden_elements`/`tags` 파싱을, 문자열과 기존 객체 배열(`required_elements`/`forbidden_elements`는 `{text}`, `tags`는 `{name}`)을 모두 받아 `string[]`로 정규화하는 `normalizedStringArray` helper로 교체했습니다. Backend는 Case 생성·수정 응답에서 저장된 값을 그대로 반환하고 Dataset Version Snapshot도 원본 Case의 배열 항목 형태를 그대로 복사하므로, Demo Seed로 만든 문자열 배열 Case와 기존 생성 Form으로 만든 객체 배열 Case가 같은 Dataset 안에 공존할 수 있음을 확인해 두 형식을 모두 정규화하도록 구현했습니다.

**Browser 재검증(2026-07-25)**: Dataset 상세에서 기존 Seed Evaluation Case 5건 정상 표시, Dataset Version 1에서 Snapshot Case 5건과 Content Hash 정상 표시를 확인했습니다. 추가로 객체 배열(`{text}`/`{name}`) 형태의 새 DRAFT Case를 생성해 전체 6건 반영과 새 Case 카드 정상 표시를 확인했고, 그 Case의 수정 Form에서 필수 요소·금지 요소·태그 값이 정상적으로 재입력됨을 확인했습니다(위 VERIFIED_MANUAL 목록 참고). R05·R06을 VERIFIED_MANUAL로 갱신했습니다.

### NOT_VERIFIED_DATA_LIMIT

Project 2건, Project A Dataset 1건, Target 1건, Evaluator 1건인 현재 데이터로는 다음을 확인할 수 없습니다.

- Projects Pagination 2페이지 이동, 마지막 페이지 이동(R02-2) — 21건 이상을 인위적으로 생성하지 않음
- Dataset Registry Pagination 2페이지 이동, 마지막 페이지 이동 — Dataset을 21건 이상 인위적으로 생성하지 않음
- Projects Empty 상태(R02-3), Dataset Registry Empty 상태 — Demo Seed Project·Scope Test Project와 기존 Dataset이 이미 존재하며, 검증을 위해 이를 삭제하지 않아 Empty 상태를 재현하지 못함

1페이지 Pagination 표시와 양쪽 버튼 비활성은 위 VERIFIED_MANUAL(R02-1)에 포함됩니다.

### STATIC_ONLY로 유지(대표 시나리오만 확인)

모든 화면의 Network Error/Retry를 각각 반복 확인하지 않았습니다. Projects에서만 대표로 확인했고(VERIFIED_MANUAL), 다음은 공통 `ErrorState`/Retry 구조 재사용에 근거해 기존 정적 증거를 유지합니다 — Dataset Registry, Dataset 상세, Dataset Version, Target Version, Evaluator Version 개별 Network Retry. Dataset 상세와 Dataset Version의 배열 파서 회귀는 해결됐으나(§Dataset 배열 파서 회귀 참고), 이번 세션에서 Network Retry까지 별도로 반복 검증하지는 않았습니다.

### BLOCKED_BY_TIME

Keyboard-only 전수 검증(모든 주요 화면의 Tab 순서, 모든 Link/Button Enter 실행, Focus Visible, 오류 상태 `role="alert"` Browser 확인, Disabled Pagination 버튼의 Keyboard 상태)은 세션 시간 제약으로 중단했습니다. Phase F 접근성 마감 단계로 이관하며, Screen Reader 전수 검증도 이번 Phase 0 범위에 포함하지 않습니다.

### 환경 장애(기능 회귀 아님)

검증 중 `evalops-postgres` Container가 `Exited (255)` 상태가 되어 Backend가 DB 연결을 거부당했고(Target 상세 API 500, Target Version 목록 API 500, `ConnectionRefusedError WinError 1225`), Container 재기동 → `pg_isready` 확인 → Backend 재기동으로 Target 상세·Version 목록이 200으로 정상 복구됐습니다. 이는 일시적인 검증 환경 장애이며 기능 회귀가 아니므로 FAILED 또는 REGRESSION_REQUIRED로 기록하지 않습니다.

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
| U09 | Dataset, Target, Evaluator 전체 Scope 회귀 | VERIFIED_MANUAL | Browser Manual | Session Manual Evidence | 2026-07-25 Project A Resource를 Project B URL로 접근하여 Dataset 상세, Dataset Version, Target 상세, Target Version, Evaluator 상세, Evaluator Version 총 6개 Route에서 실제 Resource 미노출과 Not Found UX를 확인함 |
| U10 | 전체 주요 화면 Keyboard Tab/Focus/Enter 전수 확인 | BLOCKED_BY_TIME | Not Tested | No Durable Evidence | 세션 시간 제약, Phase F 접근성 마감 단계로 이관 |
| U11 | Dataset Registry·Dataset 상세·Dataset Version·Target Version·Evaluator Version 개별 Network Retry 반복 확인 | STATIC_ONLY | Typecheck, Lint, Production Build | Repository Evidence | Projects만 대표로 Browser 확인(2026-07-25). 나머지는 공통 ErrorState/Retry 구조 재사용에 근거해 정적 증거 유지 |

## 자동화 현황

현재 저장소에서 증명 가능한 Frontend 자동 검증은 다음뿐입니다.

- TypeScript typecheck
- ESLint
- Next.js production build

Playwright, Cypress, Vitest, Jest 또는 Browser E2E Runner는 현재 없습니다. Browser 동작은 수동 검증으로만 기록하며 자동 검증 완료로 표현하지 않습니다.

이 문서는 손상 전 Planning 기준을 복구한 것입니다. 2026-07-25 세션에서 Projects/Dataset Registry Pagination, Dataset·Dataset Version 404 복귀, Dataset/Target/Evaluator Project Scope 대조, Target/Evaluator Version AbortSignal에 대한 Browser 수동 회귀 검증을 수행했습니다. 이 과정에서 Dataset Evaluation Case 및 Snapshot Case 배열 파서 회귀가 발견되어 REGRESSION_REQUIRED로 기록했으나, `fix/v0.25.5-dataset-array-parser` 브랜치에서 파서를 수정하고 같은 세션(2026-07-25)에 Dataset 상세·Dataset Version 정상 표시와 객체 배열 호환성·편집 Form 역변환까지 Browser로 재검증해 R05·R06을 VERIFIED_MANUAL로 갱신했습니다. Phase 0의 핵심 기능 공백(Pagination, 404 복귀, Project Scope 대조, AbortSignal, Dataset 배열 파서)은 모두 수정·Browser 재검증을 마쳤습니다. 다만 Pagination 다중 페이지·Empty 상태는 데이터 제한(NOT_VERIFIED_DATA_LIMIT)으로, Keyboard 전수 검증은 세션 시간 제약(BLOCKED_BY_TIME, Phase F 이관)으로, 개별 화면 Network Retry 반복 확인은 STATIC_ONLY로 각각 잔여 검증 상태로 남아 있으며, Phase 0의 모든 가능한 시나리오가 전수 검증됐다고 표현하지 않습니다.
