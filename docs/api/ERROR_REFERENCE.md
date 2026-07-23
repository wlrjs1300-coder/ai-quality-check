# Error Reference

## 응답 형식

애플리케이션 오류:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found.",
    "details": null
  }
}
```

현재 애플리케이션 오류에는 성공 응답과 달리 `meta.request_id`가 포함되지 않습니다. 라우팅 404 등 Starlette HTTP 오류는 같은 외형에서 code가 `HTTP_ERROR`입니다.

FastAPI/Pydantic 요청 검증 422는 별도 형식입니다:

```json
{
  "detail": [
    {"type":"literal_error","loc":["body","target_type"],"msg":"...","input":"EXTERNAL"}
  ]
}
```

따라서 HTTP 422라도 `INVALID_HISTORY_DATE_RANGE`, `UNSUPPORTED_TARGET_TYPE` 같은 애플리케이션 오류와 기본 `detail[]` 검증 오류를 구분해야 합니다.

## HTTP 상태별 애플리케이션 오류

### 404 Not Found

| Code | 발생 조건 | 해결 방향 |
|---|---|---|
| PROJECT_NOT_FOUND | Project가 없음 | Project ID 확인 |
| DATASET_NOT_FOUND | Dataset이 없음 | Dataset ID 확인 |
| EVALUATION_CASE_NOT_FOUND | Case가 없음 | Case ID 확인 |
| DATASET_VERSION_NOT_FOUND | Dataset Version이 없음 | Dataset ID와 version 확인 |
| TARGET_NOT_FOUND | Target이 없음 | Target ID 확인 |
| TARGET_VERSION_NOT_FOUND | Target Version이 없음 | Version ID 또는 번호 확인 |
| EVALUATOR_NOT_FOUND | Evaluator가 없음 | Evaluator ID 확인 |
| EVALUATOR_VERSION_NOT_FOUND | Evaluator Version이 없음 | Version ID 또는 번호 확인 |
| EXPERIMENT_NOT_FOUND | Experiment가 없음 | Experiment ID 확인 |
| QUALITY_GATE_POLICY_NOT_FOUND | Gate Policy가 없음 | Policy ID 확인 |
| QUALITY_GATE_RESULT_NOT_FOUND | Gate Result가 없음 | Result ID 확인 |
| BASELINE_EXPERIMENT_NOT_FOUND | 기준 Experiment가 없음 | 기준 ID 확인 |
| CURRENT_EXPERIMENT_NOT_FOUND | 비교 Experiment가 없음 | 현재 ID 확인 |
| BASELINE_COMPARISON_NOT_FOUND | Comparison이 없음 | Comparison ID 확인 |

### 409 Conflict

| Code | 발생 조건 |
|---|---|
| DUPLICATE_SLUG | Project slug 중복 |
| DUPLICATE_DATASET_NAME_IN_PROJECT | 같은 Project의 Dataset name 중복 |
| DUPLICATE_CASE_KEY_IN_DATASET | 같은 Dataset의 case_key 중복 |
| DUPLICATE_DATASET_VERSION | 동일 Dataset Snapshot Hash가 이미 존재 |
| DUPLICATE_TARGET_NAME_IN_PROJECT | 같은 Project의 Target name 중복 |
| DUPLICATE_TARGET_VERSION | 동일 Target Snapshot Hash가 이미 존재 |
| DUPLICATE_EVALUATOR_NAME_IN_PROJECT | 같은 Project의 Evaluator name 중복 |
| DUPLICATE_EVALUATOR_VERSION | 동일 Evaluator Snapshot Hash가 이미 존재 |
| DUPLICATE_QUALITY_GATE_POLICY_NAME_IN_PROJECT | 같은 Project의 Gate Policy name 중복 |
| VERSION_NUMBER_CONFLICT | Version 번호 동시성 또는 무결성 충돌 |
| PROJECT_INACTIVE | 비활성 Project에서 변경 작업 시도 |
| DATASET_INACTIVE | 비활성 Dataset에서 변경 작업 시도 |
| TARGET_INACTIVE | 비활성 Target에서 변경·Version 생성 시도 |
| EVALUATOR_INACTIVE | 비활성 Evaluator에서 변경·Version 생성 시도 |
| QUALITY_GATE_POLICY_INACTIVE | 비활성 Policy 실행 시도 |
| INVALID_STATE_TRANSITION | 허용되지 않은 상태 전이 또는 재실행 |
| RESOURCE_IMMUTABLE | 승인·폐기 Case 내용 수정 시도 |
| NO_APPROVED_CASES | 승인 Case 없이 Dataset Version 생성 |
| EMPTY_DATASET_VERSION | Case가 없는 Version으로 Experiment 생성 |
| INVALID_RESOURCE_SCOPE | Experiment Version들의 Project 범위 불일치 |
| EXPERIMENT_CREATION_FAILED | Experiment 생성 무결성 처리 실패 |
| EXPERIMENT_NOT_COMPLETED | 완료되지 않은 Experiment Gate 평가 |
| EMPTY_EXPERIMENT_RESULTS | Gate 또는 비교 대상 결과가 없음 |
| QUALITY_GATE_PROJECT_MISMATCH | Policy와 Experiment의 Project 불일치 |
| QUALITY_GATE_ALREADY_EVALUATED | 같은 Policy와 Experiment 결과가 이미 존재 |
| BASELINE_COMPARISON_SAME_EXPERIMENT | 같은 Experiment끼리 비교 |
| BASELINE_EXPERIMENT_NOT_COMPLETED | 기준 Experiment 미완료 |
| CURRENT_EXPERIMENT_NOT_COMPLETED | 현재 Experiment 미완료 |
| BASELINE_COMPARISON_PROJECT_MISMATCH | 두 Experiment Project 불일치 |
| BASELINE_DATASET_VERSION_MISMATCH | 두 Experiment Dataset Version 불일치 |
| BASELINE_RESULT_SET_MISMATCH | Case 결과 집합 불일치 |
| BASELINE_COMPARISON_ALREADY_EXISTS | 같은 비교가 이미 존재 |
| INVALID_TARGET_CONFIGURATION | FIXED Target Snapshot 설정 오류 |
| UNSUPPORTED_RESPONSE_STRATEGY | 현재 실행할 수 없는 Target 전략 |
| INVALID_EVALUATOR_CONFIGURATION | Evaluator 설정 오류 |
| UNSUPPORTED_EVALUATOR_TYPE | 현재 실행할 수 없는 Evaluator 유형 |
| CSV_EXPORT_ROW_LIMIT_EXCEEDED | CSV 결과가 10,000행 초과 |

### 422 Unprocessable Entity

| Code 또는 형식 | 발생 조건 |
|---|---|
| `detail[]` | Body, Path, Query의 타입·범위·Literal 검증 실패 |
| INVALID_HISTORY_DATE_RANGE | `created_from`이 `created_to`보다 늦음 |
| UNSUPPORTED_TARGET_TYPE | 서비스 경계에서 지원하지 않는 Target Type 방어 검증 |

실제 HTTP 오류의 `details`는 오류별로 `null` 또는 관련 ID·한계 정보를 담는 객체입니다. 클라이언트는 자유 텍스트 `message`보다 `code`를 분기 기준으로 사용해야 합니다.

## Demo Seed CLI 오류

CLI 오류는 HTTP 응답이 아니라 stderr와 종료 코드로 전달됩니다.

- `DEMO_SEED_DATABASE_NOT_ALLOWED`: DB 이름이 `evalops_local` 또는 `evalops_test`가 아님. 종료 코드 2.
- `DEMO_SEED_CONFLICT`: 결정론적 ID의 기존 데이터가 예상 Seed 정의와 다름. 종료 코드 1.

DB URL이나 Credential 원문은 오류 출력 계약에 포함되지 않습니다.
