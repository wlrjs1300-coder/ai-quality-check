# Screen API Contract

아래 Route는 현재 구현된 Frontend 화면의 계약입니다. API Path Parameter는 Public API와 같은 snake_case 표기를 사용합니다. 구현 상태와 수동 검증 수준은 [Regression Test Matrix](REGRESSION_TEST_MATRIX.md)에서 별도로 관리합니다.

## Frontend Endpoint Inventory

이 표는 화면 계약과 Public API Reference의 정합성 검증 기준입니다. 같은 Endpoint가 여러 화면에서 재사용되더라도 주된 소유 화면에 한 번만 기록합니다.

| Screen | Action | Method | Path |
|---|---|---|---|
| Projects | Initial load | GET | `/api/v1/projects` |
| Projects | Create project | POST | `/api/v1/projects` |
| Project Overview | Load project | GET | `/api/v1/projects/{project_id}` |
| Project Overview | Update project | PATCH | `/api/v1/projects/{project_id}` |
| Project Overview | Load dashboard | GET | `/api/v1/projects/{project_id}/dashboard-overview` |
| Project Overview | Load summary | GET | `/api/v1/projects/{project_id}/summary-report` |
| Project Overview | Load datasets | GET | `/api/v1/projects/{project_id}/datasets` |
| Project Overview | Create dataset | POST | `/api/v1/projects/{project_id}/datasets` |
| Project Overview | Load targets | GET | `/api/v1/projects/{project_id}/targets` |
| Project Overview | Create target | POST | `/api/v1/projects/{project_id}/targets` |
| Project Overview | Load evaluators | GET | `/api/v1/projects/{project_id}/evaluators` |
| Project Overview | Create evaluator | POST | `/api/v1/projects/{project_id}/evaluators` |
| Dataset Detail | Load dataset | GET | `/api/v1/datasets/{dataset_id}` |
| Dataset Detail | Update dataset | PATCH | `/api/v1/datasets/{dataset_id}` |
| Dataset Detail | Load cases | GET | `/api/v1/datasets/{dataset_id}/evaluation-cases` |
| Dataset Detail | Create case | POST | `/api/v1/datasets/{dataset_id}/evaluation-cases` |
| Dataset Detail | Load case | GET | `/api/v1/evaluation-cases/{case_id}` |
| Dataset Detail | Update case | PATCH | `/api/v1/evaluation-cases/{case_id}` |
| Dataset Detail | Approve case | POST | `/api/v1/evaluation-cases/{case_id}/approve` |
| Dataset Detail | Deprecate case | POST | `/api/v1/evaluation-cases/{case_id}/deprecate` |
| Dataset Detail | Load versions | GET | `/api/v1/datasets/{dataset_id}/versions` |
| Dataset Detail | Create version | POST | `/api/v1/datasets/{dataset_id}/versions` |
| Dataset Detail | Load version detail | GET | `/api/v1/datasets/{dataset_id}/versions/{version}` |
| Target Detail | Load target | GET | `/api/v1/targets/{target_id}` |
| Target Detail | Update target | PATCH | `/api/v1/targets/{target_id}` |
| Target Detail | Load versions | GET | `/api/v1/targets/{target_id}/versions` |
| Target Detail | Create version | POST | `/api/v1/targets/{target_id}/versions` |
| Target Detail | Load numbered version | GET | `/api/v1/targets/{target_id}/versions/{version}` |
| Experiment Detail | Load target version by ID | GET | `/api/v1/target-versions/{version_id}` |
| Evaluator Detail | Load evaluator | GET | `/api/v1/evaluators/{evaluator_id}` |
| Evaluator Detail | Update evaluator | PATCH | `/api/v1/evaluators/{evaluator_id}` |
| Evaluator Detail | Load versions | GET | `/api/v1/evaluators/{evaluator_id}/versions` |
| Evaluator Detail | Create version | POST | `/api/v1/evaluators/{evaluator_id}/versions` |
| Evaluator Detail | Load numbered version | GET | `/api/v1/evaluators/{evaluator_id}/versions/{version}` |
| Experiment Detail | Load evaluator version by ID | GET | `/api/v1/evaluator-versions/{version_id}` |
| Experiment Create | Create experiment | POST | `/api/v1/experiments` |
| Experiment Detail | Load experiment | GET | `/api/v1/experiments/{experiment_id}` |
| Experiment Detail | Run experiment | POST | `/api/v1/experiments/{experiment_id}/run` |
| Experiment Detail | Load results | GET | `/api/v1/experiments/{experiment_id}/results` |
| Experiment Detail | Create gate policy | POST | `/api/v1/projects/{project_id}/quality-gate-policies` |
| Experiment Detail | Load gate policy | GET | `/api/v1/quality-gate-policies/{policy_id}` |
| Experiment Detail | Evaluate gate | POST | `/api/v1/quality-gate-policies/{policy_id}/evaluate` |
| Experiment Detail | Load gate result | GET | `/api/v1/quality-gate-results/{result_id}` |
| Experiment Detail | Create comparison | POST | `/api/v1/baseline-comparisons` |
| Comparison Detail | Load comparison | GET | `/api/v1/baseline-comparisons/{comparison_id}` |
| Comparison Detail | Load case comparisons | GET | `/api/v1/baseline-comparisons/{comparison_id}/cases` |
| History | Load history | GET | `/api/v1/projects/{project_id}/experiment-history` |
| History | Export CSV | GET | `/api/v1/projects/{project_id}/experiment-history.csv` |

Raw Target/Evaluator execute Endpoint는 Experiment Inline 실행 내부에서 사용되므로 MVP 화면이 직접 호출하지 않습니다. `/health`도 사용자 화면 데이터 계약에서 제외합니다.

## Projects

목적: Project 목록을 조회하고 새 Project를 생성합니다.

Route: `/projects`

초기 API 호출: `GET /api/v1/projects?page=1&size=20`

사용자 동작:

| 사용자 동작 | Request | 성공 후 처리 | 재조회 |
|---|---|---|---|
| 페이지 이동 | `GET` with `page`, `size` | 목록 교체 | 없음 |
| Project 생성 | `POST` body `slug`, `name`, `description?` | 생성 Project로 이동 가능 | `projects` |

사용 필드: `id`, `slug`, `name`, `description`, `is_active`, `meta.pagination`. `id`를 Project Overview Route로 전달합니다.

화면 상태: Initial, Loading, Empty, Success, Error, Refreshing, Submitting. 중복 slug는 Form 오류로 표시합니다.

MVP 제외: 검색, 서버 정렬, 삭제, 복구.

## Project Overview

목적: Project 기본 정보, Dashboard, Summary와 Dataset·Target·Evaluator 진입점을 한 화면의 Tab으로 제공합니다.

Route: `/projects/{projectId}`. 진입 조건은 `projectId`입니다.

초기 API 호출은 Project 단건을 먼저 조회한 뒤 활성 Tab에 해당하는 Dashboard 또는 Registry 목록을 호출합니다. Dashboard와 Summary는 동일한 `createdFrom`, `createdTo` Filter State를 공유합니다.

사용자 동작:

| 사용자 동작 | Request | 성공 후 처리 | 재조회 |
|---|---|---|---|
| 기본 정보 수정·비활성화 | `PATCH` `name?`, `description?`, `is_active?` | 최신 active 상태 반영 | `project`, `projects` |
| Dataset 생성 | `POST` `name`, `description?` | Dataset Detail 이동 | `datasets` |
| Target 생성 | `POST` `name`, `target_type=MOCK`, `config` | Target Detail 이동 | `targets` |
| Evaluator 생성 | `POST` `name`, `evaluator_type`, `config` | Evaluator Detail 이동 | `evaluators` |

사용 필드: Project의 `id`, `slug`, `name`, `description`, `is_active`; Dashboard의 `readiness`, `kpis`, `recent_experiments`, `trend`, `warning_codes`; Summary의 `summary`, `metrics`, 최신 Gate·Comparison. 비활성 Project에서는 mutation Action을 Disabled로 처리합니다.

화면 상태: Initial, Loading, Empty(Tab 목록별), Success, Error, Refreshing, Submitting, Disabled.

오류 대응: `PROJECT_NOT_FOUND`는 Projects 이동, `PROJECT_INACTIVE`와 `INVALID_STATE_TRANSITION`은 최신 단건을 재조회합니다.

## Dataset Detail

목적: Dataset 정보, Evaluation Case 검토와 불변 Dataset Version을 관리합니다.

Route: `/projects/{projectId}/datasets/{datasetId}`. API 호출에는 `datasetId`를 사용하고 `projectId`는 navigation context입니다.

초기 API 호출: Dataset 단건 후 활성 Tab의 Case 목록 또는 Version 목록을 호출합니다.

Mutation 계약:

| 동작 | Request 핵심 필드 | 성공 후 재조회 |
|---|---|---|
| Dataset 수정 | `name?`, `description?`, `is_active?` | `dataset`, 상위 `datasets` |
| Case 생성 | `case_key`, `question`, 평가 필드 | `evaluation-cases` |
| DRAFT 수정 | 변경 가능한 평가 필드 | Case 단건과 목록 |
| 승인·폐기 | Body 없음 | Case 단건과 목록 |
| Version 생성 | Body 없음 | `dataset-versions`, Case 목록 |

사용 필드: Case의 `status`, `severity`, `required_for_release`, 평가 입력 필드; Version의 `id`, `version`, `content_hash`, `case_count`, `created_at`, 상세 `cases`. 목록은 각각 독립적인 `page`, `size`를 가집니다.

화면 상태: Initial, Loading, Empty, Success, Error, Refreshing, Submitting, Disabled. `DRAFT`만 수정·승인 가능하며 `DEPRECATED`는 조회 전용입니다.

오류 대응: `NO_APPROVED_CASES`는 승인 안내, `DUPLICATE_DATASET_VERSION`은 Version 목록 재조회, `RESOURCE_IMMUTABLE`은 Case 재조회, inactive 오류는 mutation을 비활성화합니다.

## Target Detail

목적: MOCK Target 설정을 관리하고 FIXED Version Snapshot을 생성합니다.

Route: `/projects/{projectId}/targets/{targetId}`.

초기 API 호출: Target 단건과 Version 목록. Version 상세는 사용자가 행을 선택할 때 조회합니다.

사용 필드: `name`, `target_type`, `config`, `is_active`; Version의 `id`, `version`, `content_hash`, `config_snapshot`, `response_strategy`, `latency_ms`, `failure_rate`, `created_at`.

Mutation 성공 후 Target 수정은 `target`과 상위 `targets`, Version 생성은 `target-versions`를 재조회합니다. inactive Target은 조회만 허용합니다.

화면 상태: Initial, Loading, Empty, Success, Error, Refreshing, Submitting, Disabled. `DUPLICATE_TARGET_VERSION`은 기존 목록으로 안내합니다.

## Evaluator Detail

목적: 결정론적 Evaluator 설정과 Version Snapshot을 관리합니다.

Route: `/projects/{projectId}/evaluators/{evaluatorId}`.

초기 API 호출: Evaluator 단건과 Version 목록. Version 상세는 행 선택 시 조회합니다.

사용 필드: `name`, `evaluator_type`, `config`, `is_active`; Version의 `id`, `version`, `content_hash`, `evaluator_type_snapshot`, `config_snapshot`, `created_at`.

Mutation 성공 후 Evaluator 수정은 `evaluator`와 상위 `evaluators`, Version 생성은 `evaluator-versions`를 재조회합니다. 지원 Type은 `CONTAINS`, `NOT_CONTAINS`, `REGEX`입니다.

화면 상태: Initial, Loading, Empty, Success, Error, Refreshing, Submitting, Disabled. inactive 및 duplicate 오류는 최신 상태를 재조회합니다.

## Experiment Create

목적: 단일 Dataset·Target·Evaluator Version을 선택해 Experiment를 생성합니다.

Route: `/projects/{projectId}/experiments/new`.

진입 조건: 세 Version 선택 목록은 각 Registry의 목록 API를 사용하며 반드시 같은 Project 범위여야 합니다.

Request Body는 `dataset_version_id`, `target_version_id`, `evaluator_version_id`입니다. 성공하면 `/projects/{projectId}/experiments/{experimentId}`로 이동합니다.

화면 상태: Initial, Loading, Empty(선택 가능한 Version 없음), Success, Error, Submitting, Disabled. `INVALID_RESOURCE_SCOPE`는 선택 조합 오류로 표시합니다.

## Experiment Detail

목적: Experiment 상태와 Version Snapshot, Case별 Result, Gate 판정과 비교 생성을 확인합니다.

Route: `/projects/{projectId}/experiments/{experimentId}`.

초기 API 호출: Experiment 단건 후 URL Project 범위의 Dataset·Version 목록에서 `dataset_version_id`를 확인합니다. Scope 확인이 끝난 뒤 연결된 Target·Evaluator Version을 ID로 조회하고, 상태가 `COMPLETED|FAILED`이면 Result 목록을 조회합니다. Gate/Comparison ID는 History·Dashboard navigation에서 전달받거나 생성 응답으로 보존합니다.

Experiment 단건 응답에는 `project_id`가 없으므로 Dataset Version 탐색은 방어적 UX로만 사용합니다. Scope 확인 전에는 Experiment와 Result를 표시하지 않으며, Target·Evaluator 메타데이터 실패는 해당 Version ID fallback으로 격리합니다. 실제 권한 경계는 향후 Backend의 Project-scoped 조회에서 보강해야 합니다.

사용자 동작:

| 동작 | Request | 성공 후 재조회 |
|---|---|---|
| Inline 실행 | Run Endpoint, Body 없음 | `experiment`, `experiment-results`, `history`, `dashboard`, `summary` |
| Gate Policy 생성 | `name`, `minimum_pass_rate`, 차단 옵션 | 생성된 Policy ID 보존 후 Gate 평가 |
| Gate 평가 | `experiment_id` | Gate Result 표시, 실패 시 최신 `history`에서 복원 |
| Baseline 비교 | `baseline_experiment_id`, `current_experiment_id` | 응답 Scope 확인 후 Comparison 상세 이동 |

Result 사용 필드는 `status`, `reason_code`, `reason`, `input_snapshot`, `output_snapshot`, `created_at`입니다. 목록은 `page`, `size`를 사용합니다.

화면 상태: Initial, Loading, Empty(Result 없음), Success, Error, Refreshing, Submitting, Disabled. 실행은 `CREATED`에서 한 번만 가능하고 중복 제출을 막습니다.

Basic Quality Gate는 `COMPLETED`에서만 활성화합니다. Policy 생성과 평가는 별도 mutation 상태이며, Policy 생성 후 평가가 실패하면 같은 Policy ID로만 재시도합니다. 새로고침 및 불확실한 평가 응답은 Project History를 최대 100건씩 페이지 순회해 현재 Experiment의 최신 Result ID를 찾고 Result와 Policy 단건을 복원합니다. Gate 영역 오류는 Experiment와 Case Result를 초기화하지 않습니다.

Policy 목록·수정·비활성화·Version API와 Gate Result 목록 API가 없으므로 최신 Result가 있으면 새 평가 Form을 숨깁니다. Policy 생성 Network Error는 생성 여부를 확정할 수 없고, 같은 이름으로 수동 재시도하면 중복 오류가 발생할 수 있습니다. Severity 기반 Rule은 지원하지 않으며 필수 Case 차단은 `required_for_release`를 사용합니다.

Baseline 후보는 Project History를 `experiment_status=COMPLETED`, `sort=created_at_desc`, `size=100`으로 전체 페이지 순회해 구성합니다. Current 자신, 다른 Dataset Version, Case 수가 0인 항목은 제외하며 실제 Result 존재와 Case 집합 일치는 Backend가 최종 판정합니다. 생성 Network 오류 또는 중복 오류에서는 Current의 최신 History Comparison을 조회하고 Project·Baseline·Current ID가 모두 일치할 때만 상세로 복구합니다.

## History

목적: Project 실행 이력과 같은 필터의 CSV를 제공합니다. Trend는 Project Overview가 조회하며 History 화면은 직접 조회하지 않습니다.

Route: `/projects/{projectId}/history`.

초기 API 호출: History를 현재 Filter와 pagination으로 조회합니다.

Query는 `experiment_status`, `gate_status`, `comparison_status`, `created_from`, `created_to`, `sort`; History에만 `page`, `size`가 있습니다. CSV 다운로드는 현재 필터와 정렬을 그대로 전달합니다.

사용 필드: Experiment 상태와 counts, `pass_rate`, Gate·Comparison 요약. Experiment ID는 상세 navigation에 전달합니다. 카드에서는 Input·Output Snapshot을 조회하거나 표시하지 않으며 Version은 API가 제공하는 ID만 표시합니다.

화면 상태: Initial, Loading, Empty, Success, Error, Refreshing, Submitting(다운로드). 날짜 역전은 요청 전에 차단합니다.

## Comparison Detail

목적: 전체 회귀 판정과 Case별 변화 이유를 확인합니다.

Route: `/projects/{projectId}/comparisons/{comparisonId}`.

초기 API 호출: Comparison 단건과 Case 목록 `page=1&size=20`.

사용 필드: 전체 `status`, Case counts, baseline/current pass counts, `pass_rate_delta`, `reason_codes`, `reason_summary`; Case의 `case_key`, 이전·현재 status, `change_status`, `reason_code`.

화면 상태: Initial, Loading, Empty(Case 없음), Success, Error, Refreshing. `BASELINE_COMPARISON_NOT_FOUND`는 History로 이동합니다.

Comparison 단건의 `project_id`와 URL Project가 일치한 뒤에만 Summary와 Case Diff를 표시합니다. Summary와 Case 목록 오류는 분리하며 Case 재조회 중에도 기존 Summary와 Case를 유지합니다. History 카드에는 최신 Comparison ID가 있을 때만 상세 링크를 표시하고, Dashboard 최근 Experiment에는 ID가 없으므로 링크를 만들지 않습니다. Project Overview 최상위 최신 Comparison에는 ID가 있어 상세 연결을 제공합니다.

Comparison 목록 및 Project-scoped 목록 API는 없습니다. History는 Current별 최신 Comparison 하나만 제공하므로 동일 Current의 과거 Comparison과 최신이 아닌 중복 쌍은 완전히 복원할 수 없습니다.

## 개념적 Query Key

```text
["projects", page, size]
["project", projectId]
["dashboard", projectId, createdFrom, createdTo]
["summary", projectId, createdFrom, createdTo]
["datasets", projectId, page, size]
["dataset", datasetId]
["evaluation-cases", datasetId, page, size]
["dataset-versions", datasetId, page, size]
["target", targetId]
["target-versions", targetId, page, size]
["evaluator", evaluatorId]
["evaluator-versions", evaluatorId, page, size]
["experiment", experimentId]
["experiment-results", experimentId, page, size]
["quality-gate-policy", policyId]
["quality-gate-result", resultId]
["history", projectId, filters]
["trend", projectId, createdFrom, createdTo]
["comparison", comparisonId]
["comparison-cases", comparisonId, page, size]
```

이는 Library 독립적인 식별 규칙입니다. Filter 객체는 안정적인 필드 순서로 직렬화하며 mutation 성공 후 위에 명시한 Key만 무효화합니다.
