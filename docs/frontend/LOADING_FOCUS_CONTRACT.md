# Loading Focus 계약

상태: Phase A3 조사·문서 계약

기준 커밋: `51e6dde799906c259dc2ffe0944a69cd4225c140`

구현 상태: `NOT_VERIFIED`

## 1. 목적과 범위

이 문서는 비동기 작업이 시작될 때 native `disabled`로 전환되는 control을 저장소 코드에서 추적하고, keyboard focus와 상태 전달의 후속 구현 계약을 정한다. 이번 변경은 조사와 계약 결정만 포함한다. React, CSS, 테스트, API Client, Backend는 변경하지 않으며 Phase B를 시작하지 않는다.

Phase A3 대표 Browser 검증에서 focus를 가진 control이 native disabled로 전환되면 `document.activeElement`가 `body`로 이동할 수 있음이 관찰됐다. 이는 아래 개별 흐름의 실측 결과가 아니다.

상태 표기는 다음 의미로 사용한다.

- `PASS`: 저장소 코드 또는 기존 Browser 기록으로 확인했다.
- `BLOCKED`: 선행 조건이 없어 진행할 수 없다.
- `FAIL`: 기대 계약과 다른 동작을 확인했다.
- `NOT_VERIFIED`: 코드에서 계약을 확인할 수 없고 Browser 검증도 하지 않았다.
- `NOT_PRESENT`: 저장소에 해당 구현이 없다.
- `NOT_VERIFIED_TOOL_LIMIT`: 사용한 Browser 도구로 재현하지 못했다.

## 2. 조사 범위와 공통 사실

조사 Route와 흐름은 `/projects`, Project 생성, Project Overview, Dataset Registry·Detail, Target Registry·Detail, Evaluator Registry·Detail, Experiment Create·Detail, Quality Gate, Baseline Comparison, History, Comparison Detail이다.

확인된 사실:

- `PASS`: 모든 대상은 native `button`, `input`, `select`, `textarea`, checkbox 또는 disabled `fieldset` 하위 control이다.
- `PASS`: `submitting`, `saving`, `versioning`, `creatingVersion`, `actionId`, `running`, `busy`, `downloading`, `refreshing` 계열 상태가 `disabled` 조건에 직접 참여한다.
- `PASS`: 각 mutation handler는 상태 guard 또는 native disabled를 사용해 같은 handler의 중복 실행을 막는다.
- `NOT_PRESENT`: `document.activeElement`, `.focus()`, `autoFocus`, focus 복원 ref가 없다.
- `NOT_PRESENT`: `aria-disabled`가 없다.
- `PASS`: 공통 `LoadingState`는 `aria-live="polite"`와 `aria-busy="true"`를 사용한다. Dataset Registry, Project Overview, History의 일부 refreshing 문구에도 `aria-live="polite"`가 있다.
- `NOT_PRESENT`: 모든 mutation의 완료를 일관되게 알리는 공통 status message는 없다.
- `NOT_VERIFIED_TOOL_LIMIT`: 기존 기록상 일반 Button·Link의 Enter·Space activation은 Browser 도구로 재현하지 못했다.
- `NOT_VERIFIED`: 아래 개별 control의 Loading 직전·직후·완료 후 `document.activeElement`는 Browser에서 아직 측정하지 않았다.

공통 코드 흐름은 `activation → 비동기 상태 true → native disabled → await → 성공 UI 갱신 또는 오류 렌더링 → finally에서 상태 false`다. React 상태 반영 직후 focus가 `body`로 이동할 가능성은 기존 Browser 결과에 근거한 추론이며, 개별 흐름의 실측 결과로 기록하지 않는다.

## 3. Loading 중 disabled control 전체 목록

표의 “control”은 같은 상태와 완료 목적지를 공유하는 묶음이다. 정적 비활성 조건만 있는 option이나 페이지 경계 조건은 Loading 조건과 함께 쓰일 때만 포함했다.

| Route·흐름 | 파일과 함수·컴포넌트 | control 종류와 목록 | Loading을 결정하는 실제 조건 |
|---|---|---|---|
| `/projects` 목록 Pagination | `apps/web/src/app/projects/projects-page-client.tsx`, `ProjectsPageClient.load`·`movePage` | 이전·다음 `button` | `page <= 1 || refreshing`, `page >= totalPages || refreshing`; `load(..., true)`가 `refreshing` 설정 |
| Project 생성 | `apps/web/src/components/ProjectCreateForm.tsx`, `ProjectCreateForm.handleSubmit` | 닫기·생성 `button`, 이름·slug `input`, 설명 `textarea` | 모두 `submitting`; handler의 `if (submitting) return`도 중복 제출 차단 |
| Project Overview 기간 조회 | `apps/web/src/app/projects/[projectId]/project-detail-client.tsx`, `ProjectDetailClient.load`; `apps/web/src/components/DateRangeFilter.tsx` | 시작일·종료일 `input`, 적용·초기화 `button` | `DateRangeFilter disabled={refreshing}`가 네 control에 전달됨 |
| Dataset Registry 생성 | `apps/web/src/components/DatasetRegistry.tsx`, `DatasetRegistry.submit` | 이름·설명 `input`, 생성 `button` | `!projectActive || submitting`; 생성 Button은 `!name.trim()`도 포함; handler guard 포함 |
| Dataset Registry Pagination | 같은 파일, `load`·`movePage` | 이전·다음 `button` | `page <= 1 || refreshing`, `page >= totalPages || refreshing` |
| Dataset Case 생성·수정 | `apps/web/src/app/projects/[projectId]/datasets/[datasetId]/dataset-detail-client.tsx`, `submitCase` | case key·evidence source `input`, severity `select`, 질문·요약·evidence·필수·금지·태그 `textarea`, release 필수 checkbox, 취소·저장 `button` | `submitting`이 각 조건에 포함됨; handler의 `if (... || submitting) return` |
| Dataset Case 승인·폐기 | 같은 파일, `transition` | 각 행의 수정·승인·폐기 `button` | 세 Button 모두 `Boolean(actionId)`; handler의 `if (actionId) return` |
| Dataset Version 생성 | 같은 파일, `createVersion` | Version 생성 `button` | `inactive || approvedKnownAbsent || creatingVersion`; handler guard 포함 |
| Target Registry 생성 | `apps/web/src/components/TargetRegistry.tsx`, `TargetRegistry.submit` | 이름 `input`, 고정 응답 `textarea`, 생성 `button` | `!projectActive || submitting`; Button은 빈 값 조건도 포함; handler guard 포함 |
| Target Registry Pagination | 같은 파일, `load`·`goTo` | 이전·다음 `button` | `page <= 1 || refreshing`, `totalPages === 0 || page >= totalPages || refreshing` |
| Target 설정 저장·비활성화 | `apps/web/src/app/projects/[projectId]/targets/[targetId]/target-detail-client.tsx`, `save`·`deactivate` | 이름 `input`, 고정 응답 `textarea`, 비활성화·설정 저장 `button` | 모두 `saving`과 `!target.isActive`; 저장 Button은 빈 값 조건도 포함; 두 handler guard 포함 |
| Target Version 생성 | 같은 파일, `snapshot` | Version 생성 `button` | `!target.isActive || versioning`; handler guard 포함 |
| Target Version Pagination | 같은 파일, `loadVersions`·`loadVersionPage` | 이전·다음 `button` | `versionPage <= 1 || versionRefreshing`, `totalPages === 0 || versionPage >= totalPages || versionRefreshing` |
| Evaluator Registry 생성 | `apps/web/src/components/EvaluatorRegistry.tsx`, `EvaluatorRegistry.submit` | 이름·검사값 `input`, type `select`, 생성 `button` | 세 control에 `submitting`; handler guard 포함. regex flag·case-sensitive checkbox에는 disabled 조건이 없어 이 목록에서 제외 |
| Evaluator Registry Pagination | 같은 파일, `load`·`goTo` | 이전·다음 `button` | `page <= 1 || refreshing`, `totalPages === 0 || page >= totalPages || refreshing` |
| Evaluator 설정 저장·비활성화 | `apps/web/src/app/projects/[projectId]/evaluators/[evaluatorId]/evaluator-detail-client.tsx`, `save`·`deactivate` | 이름·검사값 `input`, flag·case-sensitive checkbox, 비활성화·저장 `button` | 모두 `saving`과 `!item.isActive`; 저장 Button은 빈 값 조건도 포함; 두 handler guard 포함 |
| Evaluator Version 생성 | 같은 파일, `snapshot` | Version 생성 `button` | `!item.isActive || versioning`; handler guard 포함 |
| Evaluator Version Pagination | 같은 파일, `loadVersions`·`loadVersionPage` | 이전·다음 `button` | `versionPage <= 1 || versionRefreshing`, `totalPages === 0 || versionPage >= totalPages || versionRefreshing` |
| Experiment 생성 | `apps/web/src/app/projects/[projectId]/experiments/new/experiment-create-client.tsx`, `ExperimentCreateClient.submit`; `PaginatedSelector` | Dataset·Dataset Version·Target·Target Version·Evaluator·Evaluator Version `select`, 각 selector 이전·다음 `button`, 생성 `button` | select는 `submitting` 또는 `resource.loading`; pagination은 `resource.refreshing`; 생성 Button의 `canSubmit`은 `!submitting`을 요구; submit guard 포함 |
| Experiment 새로고침·실행 | `apps/web/src/app/projects/[projectId]/experiments/[experimentId]/experiment-detail-client.tsx`, `loadExperiment`·`execute` | 새로고침·실행 `button`, 결과 이전·다음 `button` | `refreshing`; 실행 Button의 `canRun`은 `!running`을 포함; 결과 Pagination은 `resultRefreshing`; `execute`의 running guard 포함 |
| Basic Quality Gate | `apps/web/src/app/projects/[projectId]/experiments/[experimentId]/quality-gate-panel.tsx`, policy 생성·평가 handler | 임계값 `input` 4개, Policy 생성·Gate 평가 `button` | 입력은 `busy || experimentStatus !== "COMPLETED" || policy !== null`; 생성은 `busy`; 평가는 `busy || experimentStatus !== "COMPLETED"`; busy는 policy mutation 상태의 합성값 |
| Baseline Comparison | `apps/web/src/app/projects/[projectId]/experiments/[experimentId]/baseline-comparison-panel.tsx`, `submit`·`loadCandidates` | 후보 radio를 포함한 `fieldset`, 생성·후보 새로고침 `button` | fieldset `disabled={busy}`; 생성은 `!selectedId || busy || loadingCandidates`; 새로고침은 `busy || loadingCandidates || refreshingCandidates`; mutation request guard 포함 |
| History 필터·Pagination | `apps/web/src/app/projects/[projectId]/history/project-history-client.tsx`, `load`·`applyFilters`·`resetFilters`·`movePage` | 적용·초기화·이전·다음 `button` | 모두 `refreshing`이 조건에 포함됨 |
| History CSV | 같은 파일, `exportCsv` | CSV 다운로드 `button` | `downloading || loading`; handler의 `if (downloading) return` |
| Comparison Case Pagination | `apps/web/src/app/projects/[projectId]/comparisons/[comparisonId]/comparison-detail-client.tsx`, case load 함수 | 이전·다음 `button` | `casePage <= 1 || caseRefreshing`, `casePage >= totalPages || caseRefreshing` |

## 4. Focus와 상태 전달 계약

### 4.1 공통 시작 계약

후속 구현은 activation handler가 실행되기 직전의 `document.activeElement`가 해당 흐름 안의 focusable control인지 기록해야 한다. mouse activation 뒤 `:focus-visible`을 강제로 만들지 않도록 복원은 keyboard와 mouse를 CSS로 구분하지 않고 DOM focus만 수행하며, 표시 여부는 기존 `:focus-visible`에 맡긴다.

native disabled 전환과 handler guard를 유지한다. Enter로 form을 제출하면 submit Button이 아니라 입력 control이 시작 focus일 수 있고, Space는 native Button activation에만 적용된다. 후속 테스트는 click, Enter, Button Space를 각각 확인한다.

복원 대상이 unmount됐거나 성공 결과로 영구 disabled가 됐거나 현재 Route 밖으로 이동했다면 그 control에 focus하지 않는다. 임의의 `tabIndex`나 `role`을 추가하지 않는다.

### 4.2 흐름별 후속 검증 후보

아래 성공·실패 Focus 목적지와 분류는 Browser 실측 전의 계약 후보다. 개별 흐름의 activeElement 전이는 모두 `NOT_VERIFIED`이며, native disabled 전환 시 `body`로 이동할 가능성은 Phase A3 대표 관찰과 native disabled 의미에 따른 공통 추론이다. 후보 목적지는 Browser 검증 전까지 구현 대상으로 확정하지 않는다.

| 흐름 | Loading 전 focus | Loading 직후 | 성공 계약 | 실패 계약 | 분류 | status·aria-live |
|---|---|---|---|---|---|---|
| 목록·Version·Case 결과 Pagination | 클릭한 이전·다음 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | Button이 계속 활성 가능한 경우 동일 Button 복원을 우선 검증한다. 새 경계의 반대쪽 활성 Button 또는 목록 제목은 후보일 뿐이며 Browser 비교 전에는 확정하지 않는다. | 동일 Button 복원 후보를 검증한다. | B 후보; 경계 목적지는 E | 기존 전달이 충분한지 Browser와 Screen Reader로 확인하고, 불충분한 경우에만 polite status를 검토한다. |
| Project Overview·History 필터 | 적용·초기화 Button; Enter 제출은 없음 | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 동일 Button 복원을 우선 검증하고 결과 영역으로의 이동 필요성도 함께 확인한다. | 동일 Button 복원 후보와 기존 field/partial error 전달을 검증한다. | B 후보 / E | 기존 refreshing `aria-live`와 오류 alert의 전달이 충분한지, 중복 낭독되지 않는지 검증한다. |
| Registry 생성 폼 | submit Button 또는 Enter를 누른 입력 | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 폼이 남고 시작 control이 유효한 경우 복원이 필요한지 Browser에서 검증한다. | 시작 control 복원 후보와 field 오류 연결을 검증한다. | B 후보 / E | 기존 상태 전달이 불충분한 경우에만 polite status를 검토하며 form error와 중복되지 않아야 한다. |
| Project 생성 | submit Button 또는 Enter를 누른 입력; 닫기는 별도 activation | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | form이 닫히므로 동일 control 복원은 불가능하다. modal trigger 복원은 후보이며 실제 opener 코드와 Browser 검증 전에는 확정하지 않는다. | 시작 control 복원 후보와 오류 전달을 검증한다. | E | 기존 `role="alert"`와 목록 갱신이 충분한지 검증하고, 불충분한 경우에만 최소 status를 검토한다. |
| Dataset Case 생성·수정 | submit Button 또는 form 입력 | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | case key 입력, 갱신된 Case 행 상태 또는 수정 trigger는 후보이며 Browser 비교 전에는 확정하지 않는다. | 시작 control 복원 후보와 form error 전달을 검증한다. | E | 기존 오류와 성공 상태 전달을 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Case 승인·폐기 | 해당 행 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 해당 Case 행의 상태 Text 또는 다음 사용 가능한 행 Action은 후보이며 Browser 비교 전에는 확정하지 않는다. | 동일 Button 복원 후보를 검증한다. | C 후보 / E | 기존 Case 상태와 오류 전달이 충분한지 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Detail 설정 저장 | submit Button 또는 form 입력 | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 유효한 시작 control 복원이 필요한지 검증하며 결과 영역 이동은 자동으로 채택하지 않는다. | 동일 control 복원 후보를 검증한다. | B 후보 / E | 기존 오류 영역과 저장 상태 전달을 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Target·Evaluator 비활성화 | 비활성화 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 상태 Badge 또는 상세 제목은 후보이며 Browser 비교 전에는 확정하지 않는다. | 비활성화 Button 복원 후보를 검증한다. | C 후보 / E | 기존 상태 변경 전달이 충분한지 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Dataset·Target·Evaluator Version 생성 | Version 생성 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | Button이 계속 활성인 경우 동일 Button 복원이 필요한지 검증한다. | 동일 Button 복원 후보를 검증한다. | B 후보 / E | 기존 Version 목록과 오류 전달을 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Experiment 생성 | submit Button 또는 Enter를 누른 select | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 상세 Route의 `h1` 또는 main 시작점은 후보이며 Navigation 전역 계약과 Browser 검증 전에는 확정하지 않는다. | 시작 control 복원 후보를 검증한다. | E | form error와 Route 전환 전달을 검증하고, 전역 Navigation 계약 없이 status를 확정하지 않는다. |
| Experiment 실행 | 실행 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | Experiment 상태 제목 또는 결과 요약은 후보이며 Browser 비교 전에는 확정하지 않는다. | 실행 Button 복원 후보를 검증한다. | C 후보 / E | 실행 중·완료·실패의 기존 전달을 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Experiment·후보 새로고침 | 새로고침 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 동일 Button 복원이 필요한지 검증한다. | 동일 Button 복원 후보를 검증한다. | B 후보 / E | 기존 상태 Text가 충분한지 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Quality Gate Policy 생성·평가 | 생성 또는 평가 Button; policy 입력도 Enter 제출 가능 | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 평가 Button, Gate 결과 제목 또는 판정은 후보이며 Browser 비교 전에는 확정하지 않는다. | 시작 control 복원 후보를 검증한다. | C 후보 / E | 기존 alert와 결과 표현의 전달을 검증하고, 불충분한 경우에만 polite status를 검토한다. |
| Baseline Comparison | radio 또는 생성 Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | Comparison Detail Route의 focus 시작점은 Navigation 전역 계약과 Browser 검증 전에는 확정하지 않는다. | 시작 radio/Button 복원 후보를 검증한다. | E | 생성 중·실패·Route 전환 전달을 검증하고, 전역 Navigation 계약 없이 status를 확정하지 않는다. |
| CSV 다운로드 | CSV Button | 개별 실측 `NOT_VERIFIED`; `body` 이동 가능성은 공통 추론 | 동일 Button 복원이 필요한지 검증하며 다운로드 콘텐츠로 focus를 이동하지 않는다. | 동일 Button 복원 후보와 오류 전달을 검증한다. | B 후보 / E | 브라우저 다운로드 UI와 기존 오류 전달이 충분한지 검증하고, 불충분한 경우에만 최소 status를 검토한다. |

`A. native disabled 유지 + Focus 복원 없음`은 현재 조사만으로 채택하거나 배제하지 않는다. 개별 흐름의 activeElement 전이가 미검증이므로 Browser 실측 후 판단한다. Navigation으로 control이 사라지는 Experiment 생성과 Baseline Comparison은 전역 Route Focus가 결정되기 전까지 `E`다.

## 5. native disabled와 aria-disabled

- `PASS`: 후속 구현에서도 현재 native disabled와 disabled fieldset을 기본값으로 유지한다. 이는 Tab 순서 제외, form 제출 제외, native activation 차단과 현재 중복 실행 guard를 함께 보존한다.
- `NOT_PRESENT`: 현재 `aria-disabled` 사용처는 없다.
- `NOT_VERIFIED`: focus 유지만을 이유로 `aria-disabled`로 교체할 흐름은 현재 확정하지 않는다.
- `D. aria-disabled 검토 필요`는 같은 control이 장시간 진행 상태를 표시하면서 Tab 순서에 남아야 한다는 사용자 검증 결과가 나온 경우에만 다시 연다.
- aria-disabled를 도입한다면 `onClick`과 submit handler의 선두 guard, Enter submit guard, Button Space·Enter guard를 모두 유지하고 시각적 disabled 상태와 안내 Text를 함께 제공해야 한다. `aria-disabled`만 설정하고 activation을 허용하는 구현은 금지한다.

## 6. keyboard와 중복 실행 계약

1. Button click, Button Enter, Button Space, form input Enter에서 비동기 작업은 한 번만 시작돼야 한다.
2. 기존 상태 guard, request ID 비교, AbortController와 native disabled를 제거하거나 약화하지 않는다.
3. Loading 중 재활성화는 mouse, keyboard, programmatic submit 모두 차단한다.
4. 검증 결과 Focus 복원이 필요하다면 존재하고 활성화된 element에만 수행한다.
5. Focus 복원을 구현하는 경우 mouse click에서도 `:focus-visible`을 강제로 적용하지 않는다.
6. reduced-motion은 animation 계약이며 focus 목적지나 indicator 존재 여부를 바꾸지 않는다.

## 7. Browser 검증 시나리오

각 분류의 대표 흐름을 headed Browser에서 keyboard와 mouse로 검증한다.

1. keyboard Tab으로 시작 control에 이동하고 Loading 시작 전 `document.activeElement`를 기록한다.
2. Enter 또는 Space로 activation하고 상태 전환 직후 active element, `disabled`, `aria-busy`와 중복 Network 요청 수를 기록한다.
3. 성공 시 계약 목적지, 실패 시 복원 목적지와 focus-visible 표시를 각각 확인한다.
4. mouse click에서는 복원 후 focus ring이 강제로 보이지 않는지 확인한다.
5. Pagination 경계, 성공 후 영구 disabled, control unmount, Route 이동을 별도 확인한다.
6. status/alert가 Loading 시작·완료·실패를 중복 없이 전달하는지 접근성 트리 또는 Screen Reader로 확인한다.
7. 빠른 이중 click, Enter key repeat, Space key repeat로 중복 mutation이 발생하지 않는지 확인한다.
8. 네 Phase A3 viewport에서 ring clipping과 layout 변화가 없는지 확인한다.

대표 최소 세트는 Registry 생성 성공·실패, Pagination 중간·경계, Detail 저장·비활성화, Case 승인·실패, Experiment 실행 성공·실패, Gate 평가, Baseline 생성, CSV 성공·실패다.

## 8. 정적 검증

### 8.1 Browser 검증 기록 — 2026-07-27

이번 검증은 Windows의 Chrome headed mode, 기본 Zoom 100%, device scale 1에서 기존 Backend와 Demo Seed를 사용했다. 요청한 `1440px` viewport로 Chrome window를 시작했으나 직접 확인된 내부 viewport는 `1424 × 905`였으며, `3000` 포트가 Windows에서 충돌해 동일 Web을 `3100` 포트로 실행했다. 따라서 요청한 기준 환경과 완전히 일치하는 Browser 검증으로 일반화하지 않는다. Screen Reader는 사용하지 않았다.

대표 흐름은 최대 세 개 범위에서 다음과 같이 다뤘다.

| 대표 흐름 | 재현 상태 | keyboard 결과 | mouse 결과 | 최종 분류 | 구현 필요 여부 |
|---|---|---|---|---|---|
| History CSV 다운로드 | `NOT_VERIFIED_TOOL_LIMIT` | Tab·Enter 입력과 Loading 전이 측정 중 Chrome DevTools 실행 컨텍스트가 시간 초과했다. Loading 전·직후·성공·실패 `activeElement`, 빠른 Enter 반복의 요청 수는 `NOT_VERIFIED_TOOL_LIMIT`이다. | headed Chrome에서 control DOM까지 확인했으나 click 전·직후·완료 후 `activeElement`와 focus-visible은 `NOT_VERIFIED_TOOL_LIMIT`이다. | `E` 유지 | `NOT_VERIFIED`; Focus 복원이나 status를 확정하지 않는다. |
| Target·Evaluator 비활성화 | `BLOCKED` | 기존 Demo Seed의 활성 상태를 영구 변경하지 않고 성공 상태를 재현할 수 없어 실행하지 않았다. | `BLOCKED`; 실행하지 않았다. | `E` 유지 | `NOT_VERIFIED`; 구현을 확정하지 않는다. |
| Experiment 생성 | `BLOCKED` | 기존 Demo Seed에 Experiment를 추가하지 않고 Route 이동 성공을 재현할 수 없어 실행하지 않았다. | `BLOCKED`; 실행하지 않았다. | `E` 유지 | `NOT_VERIFIED`; 구현을 확정하지 않는다. |

History CSV 화면에서 직접 확인한 사실:

- `PASS`: Chrome headed mode로 History Route를 열고 `CSV 다운로드` native `button`이 존재하며 초기 `disabled`가 `false`임을 DOM property로 확인했다.
- `PASS`: 초기 `CSV 다운로드` Button에는 `aria-live`와 `aria-busy`가 없음을 DOM attribute로 확인했다.
- `PASS`: device scale은 `1`이었고 실제 내부 viewport는 `1424 × 905`였다.
- `NOT_PRESENT`: 초기 History 화면에는 `role="alert"`가 없었다.
- `NOT_VERIFIED_TOOL_LIMIT`: Loading 직후 Button의 `disabled`, `document.activeElement`, Loading Text, 완료 후 상태, Network 요청 수는 DevTools 실행 컨텍스트 시간 초과로 측정하지 못했다.

추론:

- History CSV의 `downloading` 조건과 handler guard가 중복 실행을 제한할 것으로 예상되지만, 이번 Browser 세션의 Network 요청 수로 확인하지 못했으므로 개별 흐름의 확인된 사실로 취급하지 않는다.
- native disabled 전환 시 focus가 `body`로 이동할 가능성은 공통 추론이며 이번 History CSV 실측 결과가 아니다.

미검증:

- 세 대표 흐름의 Loading 전·직후·성공·실패 `document.activeElement`
- History CSV의 keyboard와 mouse 결과 차이, 완료 후 focus-visible, 빠른 이중 activation
- 실패 상태의 안전한 재현과 `role="alert"` 전달
- 접근성 트리와 Screen Reader announcement
- 성공 후 영구 disabled, control unmount, Route 이동의 실제 Focus 전이
- 요청한 정확한 `1440px` viewport와 추가 `390px` viewport

이번 기록만으로 Focus 목적지, `aria-disabled`, status 또는 `aria-live` 추가를 확정하지 않는다. 후속 검증은 `1440px` 실제 viewport를 보장하고 안정적으로 `document.activeElement`와 Network 요청 수를 기록할 수 있는 headed Browser 도구에서 History CSV를 먼저 재검증해야 한다. 그 결과 필요한 경우에만 해당 한 흐름의 focus ref, 조건부 `.focus()`, 최소 status Text와 회귀 테스트를 후속 구현 PR의 허용 범위로 삼는다. Target 비활성화나 Experiment 생성은 폐기 가능한 전용 Fixture가 준비되기 전까지 검증 범위를 넓히지 않는다.
후속 구현 PR은 다음을 검사한다.

- Loading 상태가 포함된 모든 `disabled` 조건이 유지되는가.
- handler의 `submitting`·`saving`·`busy` 등 중복 guard가 유지되는가.
- focus 호출 전에 element 존재·연결·disabled 여부를 검사하는가.
- 성공과 실패 목적지가 표의 계약과 일치하는가.
- status와 alert를 중복 선언하지 않는가.
- 새 `aria-disabled`, `tabIndex`, `role`, `aria-live`가 승인된 흐름에만 추가되는가.
- Enter·Space·click 중복 실행 테스트가 있는가.
- 전체 저장소에 임의의 focus 이동이 추가되지 않았는가.

## 9. 확인된 사실, 추론, 미검증

확인된 사실은 2절의 `PASS`·`NOT_PRESENT` 항목과 3절의 코드 조건이다.

추론:

- 개별 control도 Loading 직후 `body`로 이동할 수 있다는 판단은 Phase A3의 기존 대표 Browser 관찰과 native disabled 의미를 적용한 것이다.
- 결과가 추가되거나 상태가 영구 변경되는 흐름은 단순 원위치 복원보다 결과 목적지가 유용할 수 있다.
- 완료 status가 없는 흐름에서는 button label 복귀나 비시각적 목록 변경만으로 완료 인지가 충분한지 Browser와 Screen Reader 검증이 필요하다.

미검증:

- 개별 control의 실제 active element 전이
- Screen Reader별 announcement
- Button·Link Enter·Space activation의 기존 Browser 자동화 결과
- Pagination 경계의 최적 대체 목적지
- Case 생성·수정 성공 목적지
- Navigation 후 새 Route의 focus 시작점
- forced-colors와 focus contrast ratio
- 모든 상태의 mouse focus-visible 결과

이 문서는 WCAG 준수를 선언하지 않는다.

## 10. 후속 구현 PR 최소 범위

후속 구현은 Phase A3 안에서 작은 PR로 분리한다.

1. 대표 한 흐름을 Browser에서 먼저 실측해 시작 전, Loading 직후, 성공 후, 실패 후의 `document.activeElement`를 기록한다.
2. 실측 결과에 따라 필요한 Focus 복원 또는 이동만 구현하고 성공·실패·Loading·중복 activation 회귀 테스트를 추가한다.
3. 기존 상태 전달이 불충분하다고 확인된 경우에만 기존 alert·aria-live와 중복되지 않는 최소 status를 구현한다.
4. 검증 후 같은 분류의 흐름으로만 확대하며, 결과 목적지가 미확정인 `E` 흐름은 Browser 비교로 계약을 먼저 확정한다.
5. 공통 hook이나 대규모 Component 리팩터링은 하지 않는다.

후속 구현의 허용 후보는 검증으로 필요성이 확인된 focus ref, 조건부 `.focus()`, 최소 status Text와 해당 테스트다. 검증 전에는 구현을 확정하지 않는다. native disabled 제거, 일괄 aria-disabled 전환, 새 UI 구조, API·Backend·Database·Migration·Dependency 변경, Phase B Token·Layout 작업은 포함하지 않는다.

## 11. Phase A3와 Phase B 경계

이 문서는 Phase A3의 Loading disabled Focus 하위 계약이다. 이 하위 항목의 완료 조건은 대표 Browser 실측, 흐름별 계약 확정, 필요성이 확인된 최소 구현과 회귀 검증이다.

이 문서 작성 또는 이 하위 항목 완료만으로 Phase A3 전체를 완료 처리하지 않는다. Radius, Spacing, Line-height, Semantic Color, Breakpoint 등 나머지 Phase A3 계약은 별도 범위다. Phase B의 Navigation·State Component 통합, Layout 변경, 디자인 개선은 시작하지 않는다.
