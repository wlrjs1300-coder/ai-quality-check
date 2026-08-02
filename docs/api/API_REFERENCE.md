# API Reference

## 전체 Endpoint Inventory

아래 표의 Method와 Path는 OpenAPI 계약과 자동 대조됩니다.

| Method | Path | 설명 | 성공 Status | 주요 오류 |
|---|---|---|---:|---|
| GET | `/health` | API 상태 확인 | 200 | - |
| POST | `/api/v1/projects` | Project 생성 | 201 | DUPLICATE_SLUG |
| GET | `/api/v1/projects` | Project 목록 | 200 | 422 validation |
| GET | `/api/v1/projects/{project_id}` | Project 단건 조회 | 200 | PROJECT_NOT_FOUND |
| PATCH | `/api/v1/projects/{project_id}` | Project 수정·비활성화 | 200 | PROJECT_NOT_FOUND, PROJECT_INACTIVE, INVALID_STATE_TRANSITION |
| POST | `/api/v1/projects/{project_id}/datasets` | Dataset 생성 | 201 | PROJECT_NOT_FOUND, PROJECT_INACTIVE, DUPLICATE_DATASET_NAME_IN_PROJECT |
| GET | `/api/v1/projects/{project_id}/datasets` | Dataset 목록 | 200 | PROJECT_NOT_FOUND |
| GET | `/api/v1/datasets/{dataset_id}` | Dataset 단건 조회 | 200 | DATASET_NOT_FOUND |
| PATCH | `/api/v1/datasets/{dataset_id}` | Dataset 수정·비활성화 | 200 | DATASET_NOT_FOUND, PROJECT_INACTIVE, DATASET_INACTIVE |
| POST | `/api/v1/datasets/{dataset_id}/evaluation-cases` | Evaluation Case 생성 | 201 | DATASET_NOT_FOUND, PROJECT_INACTIVE, DATASET_INACTIVE |
| GET | `/api/v1/datasets/{dataset_id}/evaluation-cases` | Evaluation Case 목록 | 200 | DATASET_NOT_FOUND |
| GET | `/api/v1/evaluation-cases/{case_id}` | Evaluation Case 단건 조회 | 200 | EVALUATION_CASE_NOT_FOUND |
| PATCH | `/api/v1/evaluation-cases/{case_id}` | DRAFT Case 수정 | 200 | EVALUATION_CASE_NOT_FOUND, RESOURCE_IMMUTABLE |
| POST | `/api/v1/evaluation-cases/{case_id}/approve` | Case 승인 | 200 | EVALUATION_CASE_NOT_FOUND, INVALID_STATE_TRANSITION |
| POST | `/api/v1/evaluation-cases/{case_id}/deprecate` | Case 폐기 | 200 | EVALUATION_CASE_NOT_FOUND, INVALID_STATE_TRANSITION |
| POST | `/api/v1/datasets/{dataset_id}/versions` | 승인 Case Snapshot 생성 | 201 | NO_APPROVED_CASES, DUPLICATE_DATASET_VERSION |
| GET | `/api/v1/datasets/{dataset_id}/versions` | Dataset Version 목록 | 200 | DATASET_NOT_FOUND |
| GET | `/api/v1/datasets/{dataset_id}/versions/{version}` | Dataset Version 상세·Case Snapshot 조회 | 200 | DATASET_VERSION_NOT_FOUND |
| POST | `/api/v1/projects/{project_id}/evaluators` | Evaluator 생성 | 201 | PROJECT_NOT_FOUND, DUPLICATE_EVALUATOR_NAME_IN_PROJECT |
| GET | `/api/v1/projects/{project_id}/evaluators` | Evaluator 목록 | 200 | PROJECT_NOT_FOUND |
| GET | `/api/v1/evaluators/{evaluator_id}` | Evaluator 단건 조회 | 200 | EVALUATOR_NOT_FOUND |
| PATCH | `/api/v1/evaluators/{evaluator_id}` | Evaluator 수정·비활성화 | 200 | EVALUATOR_NOT_FOUND, EVALUATOR_INACTIVE |
| POST | `/api/v1/evaluators/{evaluator_id}/versions` | Evaluator Version 생성 | 201 | EVALUATOR_INACTIVE, DUPLICATE_EVALUATOR_VERSION |
| GET | `/api/v1/evaluators/{evaluator_id}/versions` | Evaluator Version 목록 | 200 | EVALUATOR_NOT_FOUND |
| GET | `/api/v1/evaluators/{evaluator_id}/versions/{version}` | 번호로 Evaluator Version 조회 | 200 | EVALUATOR_VERSION_NOT_FOUND |
| GET | `/api/v1/evaluator-versions/{version_id}` | ID로 Evaluator Version 조회 | 200 | EVALUATOR_VERSION_NOT_FOUND |
| POST | `/api/v1/evaluator-versions/{version_id}/execute` | 결정론적 Evaluator 실행 | 200 | INVALID_EVALUATOR_CONFIGURATION, UNSUPPORTED_EVALUATOR_TYPE |
| POST | `/api/v1/projects/{project_id}/targets` | MOCK Target 생성 | 201 | PROJECT_NOT_FOUND, DUPLICATE_TARGET_NAME_IN_PROJECT |
| GET | `/api/v1/projects/{project_id}/targets` | Target 목록 | 200 | PROJECT_NOT_FOUND |
| GET | `/api/v1/targets/{target_id}` | Target 단건 조회 | 200 | TARGET_NOT_FOUND |
| PATCH | `/api/v1/targets/{target_id}` | Target 수정·비활성화 | 200 | TARGET_NOT_FOUND, TARGET_INACTIVE |
| POST | `/api/v1/targets/{target_id}/versions` | FIXED Target Version 생성 | 201 | TARGET_INACTIVE, DUPLICATE_TARGET_VERSION |
| GET | `/api/v1/targets/{target_id}/versions` | Target Version 목록 | 200 | TARGET_NOT_FOUND |
| GET | `/api/v1/targets/{target_id}/versions/{version}` | 번호로 Target Version 조회 | 200 | TARGET_VERSION_NOT_FOUND |
| GET | `/api/v1/target-versions/{version_id}` | ID로 Target Version 조회 | 200 | TARGET_VERSION_NOT_FOUND |
| POST | `/api/v1/target-versions/{version_id}/execute` | FIXED Mock 응답 실행 | 200 | INVALID_TARGET_CONFIGURATION, UNSUPPORTED_RESPONSE_STRATEGY |
| POST | `/api/v1/experiments` | Experiment 생성 | 201 | INVALID_RESOURCE_SCOPE, EMPTY_DATASET_VERSION |
| POST | `/api/v1/experiments/{experiment_id}/run` | Experiment Inline 실행 | 200 | EXPERIMENT_NOT_FOUND, INVALID_STATE_TRANSITION |
| GET | `/api/v1/experiments/{experiment_id}` | Experiment 조회 | 200 | EXPERIMENT_NOT_FOUND |
| GET | `/api/v1/experiments/{experiment_id}/results` | Case별 Evaluation Result 목록 | 200 | EXPERIMENT_NOT_FOUND |
| POST | `/api/v1/projects/{project_id}/quality-gate-policies` | Quality Gate Policy 생성 | 201 | PROJECT_NOT_FOUND, DUPLICATE_QUALITY_GATE_POLICY_NAME_IN_PROJECT |
| GET | `/api/v1/quality-gate-policies/{policy_id}` | Quality Gate Policy 조회 | 200 | QUALITY_GATE_POLICY_NOT_FOUND |
| POST | `/api/v1/quality-gate-policies/{policy_id}/evaluate` | 완료 Experiment Gate 판정 | 200 | EXPERIMENT_NOT_COMPLETED, QUALITY_GATE_ALREADY_EVALUATED |
| GET | `/api/v1/quality-gate-results/{result_id}` | Quality Gate Result 조회 | 200 | QUALITY_GATE_RESULT_NOT_FOUND |
| POST | `/api/v1/baseline-comparisons` | 두 Experiment 비교 생성 | 201 | BASELINE_COMPARISON_ALREADY_EXISTS, BASELINE_RESULT_SET_MISMATCH |
| GET | `/api/v1/baseline-comparisons/{comparison_id}` | 비교 결과 조회 | 200 | BASELINE_COMPARISON_NOT_FOUND |
| GET | `/api/v1/baseline-comparisons/{comparison_id}/cases` | Case별 비교 목록 | 200 | BASELINE_COMPARISON_NOT_FOUND |
| GET | `/api/v1/projects/{project_id}/experiment-history.csv` | History CSV Export | 200 | PROJECT_NOT_FOUND, INVALID_HISTORY_DATE_RANGE, CSV_EXPORT_ROW_LIMIT_EXCEEDED |
| GET | `/api/v1/projects/{project_id}/experiment-history` | Experiment History | 200 | PROJECT_NOT_FOUND, INVALID_HISTORY_DATE_RANGE |
| GET | `/api/v1/projects/{project_id}/trend-summary` | 기간별 Trend Summary | 200 | PROJECT_NOT_FOUND, INVALID_HISTORY_DATE_RANGE |
| GET | `/api/v1/projects/{project_id}/summary-report` | Project Summary Report | 200 | PROJECT_NOT_FOUND, INVALID_HISTORY_DATE_RANGE |
| GET | `/api/v1/projects/{project_id}/dashboard-overview` | Dashboard Overview | 200 | PROJECT_NOT_FOUND, INVALID_HISTORY_DATE_RANGE |

## 공통 응답과 타입

일반 단건 응답:

```json
{
  "data": {"id": "11111111-1111-4111-8111-111111111111"},
  "meta": {"request_id": "example-request-id"}
}
```

목록 응답:

```json
{
  "data": [],
  "meta": {
    "request_id": "example-request-id",
    "pagination": {"total": 0, "page": 1, "size": 20}
  }
}
```

`Decimal` 기반 비율과 변화량은 JSON 문자열(예: `"0.8"`, `"-0.2"`)입니다. datetime은 timezone 정보를 포함할 수 있는 ISO 8601 문자열입니다. 기간 필터는 `created_from <= created_to`이며 양 끝을 포함합니다.

목록 API는 기본 `page=1`, `size=20`이고 `page >= 1`, `1 <= size <= 100`입니다. 범위를 벗어난 값은 HTTP 422를 반환합니다. `total_pages`, `has_next`, `has_previous`는 응답하지 않습니다.

## 핵심 생성 흐름

### Project와 Dataset

`POST /api/v1/projects`:

```json
{"slug":"support-rag-demo","name":"한국어 고객지원 평가","description":"공개 합성 사례 데모"}
```

`POST /api/v1/projects/{project_id}/datasets`:

```json
{"name":"refund-policy","description":"환불 정책 회귀 평가셋"}
```

Project와 Dataset은 `is_active=false`로 비활성화할 수 있지만 재활성화할 수 없습니다. 비활성 리소스는 조회만 가능합니다.

### Evaluation Case와 Dataset Version

`POST /api/v1/datasets/{dataset_id}/evaluation-cases`:

```json
{
  "case_key":"refund-period-001",
  "question":"결제 후 열흘이 지났습니다. 환불 가능한가요?",
  "expected_summary":"환불 기간과 사용 조건을 안내한다.",
  "evidence":[{"source_id":"policy-example","content":"결제 후 7일 이내이며 사용 이력이 없어야 합니다."}],
  "required_elements":[{"text":"7일 이내"},{"text":"사용 이력 없음"}],
  "forbidden_elements":[{"text":"무조건 환불 가능"}],
  "tags":[{"name":"refund"}],
  "severity":"HIGH",
  "required_for_release":true
}
```

새 Case는 `DRAFT`이며 approve Endpoint로 `APPROVED`가 된 Case만 Dataset Version에 포함됩니다. Dataset Version 생성은 Body가 없고, 상세 조회는 생성 당시 Case Snapshot을 `cases`로 포함합니다. Version과 `content_hash`는 같은 Snapshot을 식별하며 수정·삭제 API가 없습니다.

### Target와 Evaluator Version

`POST /api/v1/projects/{project_id}/targets`:

```json
{"name":"prompt-v1","target_type":"MOCK","config":{"output":{"text":"환불은 7일 이내 가능합니다."}}}
```

현재 실행 가능한 Target 계약은 `MOCK` + `FIXED`입니다. `CASE_BASED`, `SCENARIO_BASED`는 Version 응답의 예약 값이지만 실행은 지원하지 않습니다. Target Version 생성은 Body가 없습니다.

`POST /api/v1/projects/{project_id}/evaluators`:

```json
{"name":"required-refund-period","evaluator_type":"CONTAINS","config":{"expected":"7일","case_sensitive":false}}
```

지원 Evaluator Type은 `CONTAINS`, `NOT_CONTAINS`, `REGEX`입니다. Version 생성은 Body가 없으며 설정 Snapshot과 Hash를 고정합니다. 실행 요청은 `{"output":{"text":"..."}}`, 응답 status는 `PASS|FAIL`입니다.

### Experiment와 Evaluation Result

`POST /api/v1/experiments`:

```json
{
  "dataset_version_id":"22222222-2222-4222-8222-222222222222",
  "target_version_id":"33333333-3333-4333-8333-333333333333",
  "evaluator_version_id":"44444444-4444-4444-8444-444444444444"
}
```

생성 상태는 `CREATED`입니다. `POST /api/v1/experiments/{experiment_id}/run`은 Body 없이 Inline 실행하며 재실행은 차단합니다. 상태는 `CREATED`, `RUNNING`, `COMPLETED`, `FAILED`; Case 결과는 `PASS`, `FAIL`, `ERROR`이고 `reason_code`, `reason` 및 입력·출력 Snapshot을 보존합니다.

### Quality Gate와 Baseline Comparison

Policy 생성 예시:

```json
{"name":"release-gate","minimum_pass_rate":"0.8","block_on_error":true,"block_on_required_case_failure":true}
```

Gate 평가는 `{"experiment_id":"..."}`를 받으며 결과는 `PASS|BLOCK`입니다. `minimum_pass_rate`, `pass_rate`는 JSON 문자열입니다.

Baseline Comparison 생성:

```json
{"baseline_experiment_id":"55555555-5555-4555-8555-555555555555","current_experiment_id":"66666666-6666-4666-8666-666666666666"}
```

두 Experiment는 모두 완료 상태이고 같은 Project 및 Dataset Version을 사용해야 합니다. 결과는 `IMPROVED`, `UNCHANGED`, `REGRESSED`이며 Case별 변화도 조회할 수 있습니다.

## 조회·필터 계약

History와 CSV는 다음 Query를 지원합니다.

- `experiment_status`: `CREATED|RUNNING|COMPLETED|FAILED`
- `gate_status`: `PASS|BLOCK`
- `comparison_status`: `IMPROVED|UNCHANGED|REGRESSED`
- `created_from`, `created_to`: ISO 8601 datetime, 포함 경계
- `sort`: `created_at_desc`(기본) 또는 `created_at_asc`
- History만 `page`, `size` 지원

Trend, Summary Report, Dashboard Overview는 `created_from`, `created_to`만 지원합니다. 날짜 형식 자체가 잘못되면 FastAPI 기본 422, 역전된 범위는 `INVALID_HISTORY_DATE_RANGE` 애플리케이션 422입니다.

Release Readiness는 `READY|NOT_READY|UNKNOWN`, Dashboard Trend 방향은 `IMPROVING|STABLE|DECLINING|UNKNOWN`입니다.

## 공개 상태값과 Enum

| 구분 | 값 | 비고 |
|---|---|---|
| Evaluation Case status | `DRAFT`, `APPROVED`, `DEPRECATED` | 내용 수정은 DRAFT에서만 가능 |
| Case severity | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` | 기본값 MEDIUM |
| Target type | `MOCK` | 현재 유일한 지원 유형 |
| Target response strategy | `FIXED`, `CASE_BASED`, `SCENARIO_BASED` | 현재 실행은 FIXED만 지원 |
| Evaluator type | `CONTAINS`, `NOT_CONTAINS`, `REGEX` | 결정론적 문자열 평가기 |
| Experiment status | `CREATED`, `RUNNING`, `COMPLETED`, `FAILED` | Inline 실행 상태 |
| Evaluation Result status | `PASS`, `FAIL`, `ERROR` | Case별 결과 |
| Quality Gate status | `PASS`, `BLOCK` | 배포 판정 |
| Baseline Comparison status | `IMPROVED`, `UNCHANGED`, `REGRESSED` | 전체 및 Case별 변화 |
| Release Readiness | `READY`, `NOT_READY`, `UNKNOWN` | Summary와 Dashboard |
| Dashboard Trend | `IMPROVING`, `STABLE`, `DECLINING`, `UNKNOWN` | 기간별 pass rate 방향 |

## CSV Export

`GET /api/v1/projects/{project_id}/experiment-history.csv`는 `text/csv; charset=utf-8`과 attachment `Content-Disposition`을 반환합니다. UTF-8 BOM 뒤에 고정된 25개 열을 제공합니다:

```text
experiment_id,dataset_version_id,target_version_id,evaluator_version_id,experiment_status,total_case_count,passed_case_count,failed_case_count,error_case_count,pass_rate,created_at,started_at,completed_at,quality_gate_result_id,quality_gate_policy_id,quality_gate_status,quality_gate_pass_rate,quality_gate_reason_codes,quality_gate_created_at,baseline_comparison_id,baseline_experiment_id,baseline_comparison_status,baseline_pass_rate_delta,baseline_reason_codes,baseline_comparison_created_at
```

빈 결과도 Header를 반환합니다. 최대 10,000행이며 초과 시 `CSV_EXPORT_ROW_LIMIT_EXCEEDED`입니다. 스프레드시트 수식으로 해석될 수 있는 텍스트는 방어적으로 escape됩니다.
