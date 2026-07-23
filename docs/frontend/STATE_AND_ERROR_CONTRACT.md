# State and Error Contract

## 공통 화면 상태

- Initial: 요청 시작 전이며 데이터 존재 여부를 판단하지 않습니다.
- Loading: 최초 요청 중이고 표시할 기존 데이터가 없습니다.
- Refreshing: 기존 데이터를 유지한 채 재조회합니다.
- Empty: 요청이 성공했지만 목록이 비어 있습니다.
- Success: 응답 데이터로 화면을 렌더링할 수 있습니다.
- Submitting: mutation 또는 CSV 다운로드 중이며 같은 요청을 중복 실행하지 않습니다.
- Error: 요청이 실패했습니다. 기존 데이터가 있으면 보존합니다.
- Disabled: inactive·immutable·상태 정책으로 Action이 허용되지 않습니다.

Loading과 Empty는 반드시 구분합니다. 여러 Tab이나 Panel은 서로 독립된 상태를 가질 수 있습니다.

## 오류 형태와 처리

Application Error는 `error.code`, `error.message`, `error.details`로 분기합니다. FastAPI Validation은 `detail[]`의 각 `loc` 마지막 요소를 Form field에 연결합니다. Network 오류는 HTTP 응답 없음, Unexpected Response는 예상 Envelope 불일치로 구분합니다.

| Error Code | 사용자 메시지 | UI 처리 |
|---|---|---|
| PROJECT_NOT_FOUND | 프로젝트를 찾을 수 없습니다. | Projects로 이동 |
| DATASET_NOT_FOUND | 데이터셋을 찾을 수 없습니다. | Project Overview로 이동 |
| EVALUATION_CASE_NOT_FOUND | 평가 사례를 찾을 수 없습니다. | Case 목록 재조회 |
| TARGET_NOT_FOUND | Target을 찾을 수 없습니다. | Project Overview로 이동 |
| EVALUATOR_NOT_FOUND | Evaluator를 찾을 수 없습니다. | Project Overview로 이동 |
| EXPERIMENT_NOT_FOUND | Experiment를 찾을 수 없습니다. | History로 이동 |
| BASELINE_COMPARISON_NOT_FOUND | 비교 결과를 찾을 수 없습니다. | History로 이동 |
| DUPLICATE_SLUG | 이미 사용 중인 slug입니다. | slug Form 오류 |
| DUPLICATE_DATASET_VERSION | 동일한 Snapshot Version이 존재합니다. | Version 목록 재조회 |
| DUPLICATE_TARGET_VERSION | 동일한 Target Version이 존재합니다. | Version 목록 재조회 |
| DUPLICATE_EVALUATOR_VERSION | 동일한 Evaluator Version이 존재합니다. | Version 목록 재조회 |
| INVALID_STATE_TRANSITION | 현재 상태에서는 수행할 수 없습니다. | 상세 재조회 후 Action 갱신 |
| RESOURCE_IMMUTABLE | 승인되거나 폐기된 사례는 수정할 수 없습니다. | Case 재조회·Form 잠금 |
| PROJECT_INACTIVE | 비활성 프로젝트는 변경할 수 없습니다. | Project 재조회·mutation 비활성화 |
| DATASET_INACTIVE | 비활성 데이터셋은 변경할 수 없습니다. | Dataset 재조회·mutation 비활성화 |
| TARGET_INACTIVE | 비활성 Target은 변경할 수 없습니다. | Target 재조회·mutation 비활성화 |
| EVALUATOR_INACTIVE | 비활성 Evaluator는 변경할 수 없습니다. | Evaluator 재조회·mutation 비활성화 |
| NO_APPROVED_CASES | 승인된 평가 사례가 필요합니다. | Case Tab으로 이동 |
| INVALID_RESOURCE_SCOPE | 선택한 Version의 Project 범위가 다릅니다. | Version 선택 초기화 |
| QUALITY_GATE_ALREADY_EVALUATED | 이미 Gate 판정이 존재합니다. | History와 상세 재조회 |
| BASELINE_COMPARISON_ALREADY_EXISTS | 이미 같은 비교 결과가 존재합니다. | Comparison 조회 유도 |
| INVALID_HISTORY_DATE_RANGE | 시작 시각은 종료 시각보다 늦을 수 없습니다. | 기간 Form 오류 |
| CSV_EXPORT_ROW_LIMIT_EXCEEDED | 다운로드 결과가 10,000행을 초과했습니다. | 기간·필터 축소 안내 |

나머지 실제 오류 코드는 [Error Reference](../api/ERROR_REFERENCE.md)를 따릅니다. 404는 상위 목록 이동, 409는 최신 상태 재조회, 애플리케이션 422는 code별 안내, 기본 422는 field 오류를 원칙으로 합니다. 500 또는 예상하지 못한 오류에서는 성공 응답에만 존재하는 `request_id`가 있다고 가정하지 않습니다.

## 재시도와 중복 방지

- GET Network 오류는 사용자가 재시도할 수 있습니다. 기존 성공 데이터가 있으면 유지합니다.
- 생성·실행 mutation은 자동 재시도하지 않습니다. 결과를 먼저 재조회한 후 사용자가 다시 실행합니다.
- Submitting 동안 같은 Action을 비활성화합니다.
- 409 응답은 blind retry하지 않고 관련 Query를 무효화합니다.
- CSV는 실패 응답의 Content-Type을 확인해 JSON 오류와 파일 응답을 구분합니다.

## Decimal 표시

API의 `Decimal`은 원본 문자열로 보존합니다. `"0.8"` pass rate는 화면 표시 시 `80.00%`, `"-0.4"` pass rate delta는 `-40.00%p`로 표시합니다. Delta는 0~1 비율의 차이이므로 percentage point 의미를 사용합니다. 표시를 위해 변환한 부동소수 값을 요청값이나 Cache 원본에 덮어쓰지 않습니다.

## Datetime과 기간 필터

- API ISO 8601 문자열을 원본으로 유지하고 렌더링 시 사용자 Local Time으로 변환합니다.
- 상세 Tooltip에는 원본 timezone 포함 값을 제공할 수 있습니다.
- 날짜 필터는 Local Date의 시작·끝을 명시적인 timezone 포함 ISO 8601로 변환합니다.
- `created_from`, `created_to` 경계는 포함됩니다.
- 시작이 종료보다 늦으면 Client에서 차단합니다.
- Dashboard, Summary, History, Trend, CSV가 같은 기간 Filter State를 공유합니다.
- Filter 초기화는 두 값과 상태 필터를 제거하고 page를 1로 되돌립니다.

## Pagination과 정렬

- `page`는 1부터 시작하고 `size` 변경 시 page를 1로 설정합니다.
- 일반 목록은 `1 <= size <= 100`입니다.
- Dataset Version 목록은 현재 Backend OpenAPI에 범위 제약이 없지만 UI는 일관성을 위해 20을 기본값으로 사용합니다.
- `total=0`이면 Empty입니다. API는 `total_pages`를 주지 않으므로 `ceil(total/size)`로 표시용 값을 계산합니다.
- 서버 삭제 API가 없으므로 삭제 후 page 보정은 현재 필요하지 않습니다.
- 서버 정렬은 History와 CSV의 `created_at_desc`(최신순), `created_at_asc`(오래된순)만 지원합니다.

## CSV 다운로드

현재 Project ID, 기간, 상태 필터와 History 정렬값을 그대로 전달합니다. 응답을 JSON으로 파싱하지 않고 Blob으로 처리하며 `Content-Disposition`의 파일명을 우선 사용합니다. Header가 없으면 `experiment-history.csv`를 안전한 fallback으로 사용합니다. UTF-8 BOM은 그대로 보존하고 빈 결과도 Header가 있는 CSV로 다운로드합니다.

## Badge 매핑

| Domain | Value | Label | Semantic | Action |
|---|---|---|---|---|
| Case | DRAFT | 작성 중 | neutral | 수정·승인·폐기 가능 |
| Case | APPROVED | 승인됨 | success | 조회·폐기 가능 |
| Case | DEPRECATED | 폐기됨 | neutral | 조회만 가능 |
| Active | true | 활성 | success | 상태별 mutation 가능 |
| Active | false | 비활성 | neutral | 조회만 가능 |
| Experiment | CREATED | 생성됨 | neutral | 실행 가능 |
| Experiment | RUNNING | 실행 중 | progress | 중복 실행 불가 |
| Experiment | COMPLETED | 완료 | success | Result·Gate 확인 |
| Experiment | FAILED | 실패 | danger | 오류 확인 |
| Result | PASS | 통과 | success | - |
| Result | FAIL | 실패 | warning | 이유 확인 |
| Result | ERROR | 오류 | danger | 오류 확인 |
| Gate | PASS | 통과 | success | - |
| Gate | BLOCK | 차단 | danger | 실패 사례 확인 |
| Comparison | IMPROVED | 개선 | success | - |
| Comparison | UNCHANGED | 변화 없음 | neutral | - |
| Comparison | REGRESSED | 회귀 | danger | Case 변화 확인 |
| Readiness | READY | 준비됨 | success | - |
| Readiness | NOT_READY | 준비되지 않음 | danger | 경고 확인 |
| Readiness | UNKNOWN | 확인 필요 | neutral | 데이터 확인 |
| Trend | IMPROVING | 개선 추세 | success | - |
| Trend | STABLE | 안정 | neutral | - |
| Trend | DECLINING | 하락 추세 | danger | 최근 실패 확인 |
| Trend | UNKNOWN | 확인 필요 | neutral | 데이터 확인 |

색상 구현은 디자인 시스템에 맡기며 문서는 semantic 의미만 고정합니다.
