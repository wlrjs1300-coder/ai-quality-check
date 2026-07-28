# Frontend Radius Contract

## 조사 목적과 경계

이 문서는 Phase A3에서 현재 Frontend의 `border-radius` 사용 의미를 조사하고 후속 구현이 따라야 할 계약을 정의합니다. 이번 작업은 문서 계약만 다루며 CSS 값, Selector, React Component와 Layout은 변경하지 않습니다.

- 조사 기준 commit: `f634839a5b42a9a406c0d274009e81f525bf6e66`
- 조사 상태: `PASS`
- 조사 범위: 저장소 전체 키워드 검색, `apps/web/src/app/globals.css`, `apps/web/src/**/*.tsx`, `docs/frontend/DESIGN_TOKENS.md`, `docs/frontend/UI_UX_ROADMAP.md`
- 검색어: `border-radius`, `radius`, `--radius`, `7px`, `8px`, `10px`, `12px`, `999px`, `50%`, `rounded`, `pill`, `circle`
- 구현 변경: `NOT_PRESENT`
- Browser 검증: `NOT_VERIFIED`

검색 결과의 Dependency lockfile integrity 문자열과 일반 spacing 값은 radius 근거에서 제외했습니다. 실제 radius 선언은 `apps/web/src/app/globals.css` 한 파일에서 확인했습니다.

## 확인된 사실

### 현재 값 전체 목록

| 값 | Selector | UI 의미 | 현재 Token 참조 | computed value 유지 |
|---:|---|---|---|---|
| `7px` | `input, textarea, select` | Text form control | literal | 예 |
| `7px` | `.form-error` | Form error message surface | literal | 예 |
| `7px` | `.notice, .refreshing` | Success·refresh notice surface | literal | 예 |
| `7px` | `.immutable-note` | Neutral immutable guidance surface | literal | 예 |
| `8px` | `.button` | 기본·secondary·danger·compact Button과 Button 형태 Link | literal | 예 |
| `8px` | `.warning-list li` | Warning list item surface | literal | 예 |
| `8px` | `.download-error` | Download error surface | literal | 예 |
| `8px` | `.inline-fieldset` | Checkbox·radio option group container | literal | 예 |
| `8px` | `.snapshot-value` | Code snapshot container | literal | 예 |
| `10px` | `.metric-card` | Metric summary card | literal | 예 |
| `10px` | `.baseline-candidate` | 선택 가능한 Baseline candidate card | literal | 예 |
| `12px` | `.form-panel, .state-panel, .detail-panel, .coming-next` | Form·state·detail Panel | literal | 예 |
| `12px` | `.project-card` | Project card | literal | 예 |
| `12px` | `.filter-panel, .summary-panel` | Filter·summary Panel | literal | 예 |
| `12px` | `.history-card` | History card | literal | 예 |
| `12px` | `.dataset-card, .case-card, .version-card` | Registry·case·version card | literal | 예 |
| `12px` | `.baseline-candidates` | Baseline candidate group Panel | literal | 예 |
| `12px` | `.result-card` | Evaluation result card | literal | 예 |
| `999px` | `.status-badge` | Active·inactive status pill | literal | 예 |
| `999px` | `.semantic-badge` | Semantic status pill | literal | 예 |
| `50%` | `.state-marker` | 원형 loading marker | literal | 예 |

`0`은 `.text-button`의 `border` 제거에만 나타나며 `border-radius` 선언이 아닙니다. `rounded`, `pill`, `circle` 이름의 class 또는 Component는 확인되지 않았습니다. Pill과 circle은 각각 `999px`과 `50%`의 형태로 구현되어 있습니다.

### 값별 파일과 Component 문맥

모든 선언 파일은 `apps/web/src/app/globals.css`입니다. 주요 소비 문맥은 다음과 같습니다.

| 값 | Component 또는 Route 문맥 |
|---:|---|
| `7px` | `ProjectCreateForm`, `DatasetRegistry`, `TargetRegistry`, `EvaluatorRegistry`, Dataset·Target·Evaluator detail form, Experiment Create, History filter의 `input`·`select`·`textarea`; 여러 form의 `.form-error`; Projects·Project Overview·History·Experiment의 `.notice`·`.refreshing`; Target·Evaluator·Experiment의 `.immutable-note` |
| `8px` | 전 Route의 `.button`; `AnalyticsUi.WarningList`; Projects와 History의 `.download-error`; Evaluator와 Quality Gate의 `.inline-fieldset`; Experiment Detail의 `.snapshot-value` |
| `10px` | `AnalyticsUi.MetricCard`; `baseline-comparison-panel`의 `.baseline-candidate` |
| `12px` | `ProjectCreateForm`, `AsyncStates`, Registry와 detail 화면의 공통 Panel·Card; History; Dataset; Experiment Create·Detail; Baseline Comparison |
| `999px` | `StatusBadge`; `AnalyticsUi.SemanticBadge` |
| `50%` | `AsyncStates.LoadingState`의 `.state-marker` |

### UI 유형별 현재 분류

| UI 유형 | 상태 | 현재 radius와 근거 |
|---|---|---|
| 기본 button | PASS | `.button` `8px` |
| compact button | PASS | `.compact-pagination .button`이 크기만 바꾸며 `.button`의 `8px` 상속 |
| text button | PASS | `.text-button`에 radius 없음 |
| input | PASS | 공통 selector `7px`; checkbox·radio도 selector에는 포함됨 |
| select | PASS | 공통 selector `7px` |
| textarea | PASS | 공통 selector `7px` |
| checkbox 또는 radio | PASS | native input에 공통 `7px` 선언이 적용되나 브라우저 native appearance의 실제 표시 결과는 미검증 |
| card | PASS | 일반 Card `12px`, Metric·Baseline Candidate `10px` |
| panel | PASS | 일반 Panel `12px`; warning·error·notice surface는 `7px` 또는 `8px` |
| modal 또는 dialog | NOT_PRESENT | `dialog`, modal class와 `role="dialog"` 없음 |
| table 또는 list container | PASS | Table은 `NOT_PRESENT`; `.warning-list li` `8px`, `.baseline-candidates` `12px`, 개별 Candidate `10px` |
| badge | PASS | `.status-badge`, `.semantic-badge` `999px` |
| status pill | PASS | Badge와 같은 두 selector가 `999px` |
| pagination | PASS | 별도 container radius 없음; Button은 `8px` |
| navigation item | PASS | 별도 item radius 없음; Button 형태 Link는 `8px` |
| summary 또는 details | PASS | 자체 radius 없음; 내부 `.snapshot-value`만 `8px` |
| loading marker | PASS | `.state-marker` `50%` |
| icon-only control | NOT_PRESENT | icon-only Button 또는 Link를 확인하지 못함 |

Checkbox와 radio는 `input` 공통 규칙의 선언상 `7px`입니다. 그러나 native appearance가 실제 corner에 이 값을 어떻게 반영하는지는 Browser computed style과 화면 확인 전에는 확정하지 않습니다.

## 기존 Token과 literal 관계

`globals.css`와 `DESIGN_TOKENS.md`에는 다음 목표 Token이 이미 선언되어 있습니다.

| Token | 값 | 정확히 같은 literal 사용처 | 현재 연결 |
|---|---:|---|---|
| `--radius-control` | `8px` | `.button`, warning·download error surface, inline fieldset, snapshot code | 없음 |
| `--radius-card` | `12px` | 일반 Panel과 Card | 없음 |
| `--radius-pill` | `999px` | status·semantic Badge | 없음 |

세 Token은 목표 계약이며 radius selector에서는 아직 `var()`로 참조하지 않습니다. `--radius-control: 8px`과 값이 같은 모든 `8px` 사용처가 control 의미인 것은 아닙니다. 따라서 `.warning-list li`, `.download-error`, `.inline-fieldset`, `.snapshot-value`를 값만 보고 `--radius-control`에 연결하지 않습니다.

### 7px 계약

`7px`는 form control, form error, success·refresh notice, immutable note라는 서로 다른 의미에 사용됩니다.

- 현재 값을 유지합니다.
- `--radius-control`은 `8px`이므로 연결하지 않습니다.
- `--radius-field: 7px`을 Phase A3 Radius 계약으로 확정합니다. 후속 구현 PR에서 Token을 선언하고 `input, textarea, select`에 연결하며 computed value는 `7px`으로 유지합니다.
- `.form-error`, `.notice`, `.refreshing`, `.immutable-note`는 literal `7px`을 유지합니다. `--radius-field` 재사용을 금지하며 별도 message surface 계약 전까지 Token화하지 않습니다.
- checkbox·radio의 native 렌더링은 별도 Browser 확인 전 field 계약의 시각 증거로 사용하지 않습니다.

### 10px 계약

`10px`는 읽기 전용 Metric Card와 상호작용 가능한 Baseline Candidate에 사용됩니다.

- 현재 값을 유지합니다.
- `--radius-card: 12px`로 정규화하지 않습니다.
- 두 selector는 compact 또는 nested card라는 공통 가능성이 있지만, 현재 정보만으로 하나의 Semantic Token을 공유한다고 확정하지 않습니다.
- `.metric-card`와 `.baseline-candidate`는 literal `10px`을 유지하고 이번 후속 구현 PR에서 Token을 추가하거나 연결하지 않습니다.
- 별도 의미 계약 전까지 두 selector를 변경하지 않으며 하나의 compact card Token으로 통합하지 않습니다.

### 기타 값 계약

- `8px`: 후속 구현 PR에서 `.button`을 기존 `--radius-control`에 연결합니다. 다른 `8px` surface는 의미별 판단 전 literal을 유지합니다.
- `12px`: 일반 Card와 Panel은 값과 반복 container 구조가 일치하므로 후속 구현 PR에서 기존 `--radius-card`에 연결합니다. Token 이름 변경이나 `--radius-panel` alias 추가는 이번 범위에서 하지 않습니다.
- `999px`: 후속 구현 PR에서 `.status-badge`와 `.semantic-badge`를 기존 `--radius-pill`에 연결합니다.
- `50%`: 고정 폭·높이가 같은 loading marker의 circle 예외입니다. 일반 corner 또는 pill Token에 연결하지 않습니다.

Pill은 내용 길이에 따라 capsule 형태를 유지하는 `999px`, circle은 동일한 width·height에 적용되는 `50%`입니다. 두 값을 서로 대체하거나 일반 Card·Control radius에 포함하지 않습니다.

## 후보 A~F 비교

| 후보 | 장점 | 위험 | 시각 영향 | 구현 범위 | 판정 |
|---|---|---|---|---|---|
| A. `7px`·`10px` literal 유지 | 변경이 가장 작고 현재 값을 보존 | 의미가 계속 코드에 분산 | 없음이 목표 | 없음 | 부분 채택 |
| B. 현재 값을 유지하며 의미별 Token 신규 선언 | 의미와 값을 함께 고정 | 근거가 약한 의미까지 Token이 늘 수 있음 | 값 보존 시 없음이 목표 | Token 선언과 selector 연결 | 선택적 채택 |
| C. 기존 Token에 연결하고 computed value 유지 | 기존 계약 재사용, 낮은 위험 | 값만 같은 비-control을 잘못 연결할 수 있음 | 없음이 목표 | `8px` Button, `12px` Card·Panel, `999px` Badge | 채택 |
| D. `7→8px`, `10→12px` 정규화 | scale이 단순해짐 | 명확한 디자인·Browser 근거 없이 실제 corner 변경 | 있음 | 광범위 CSS와 Browser 회귀 | 기각 |
| E. UI 의미별 일부 Token화와 예외 유지 | 실제 의미를 보존하며 과도한 통합 방지 | 일부 literal이 남음 | 값 보존 시 없음이 목표 | 작은 selector 묶음 | 최종 선택 |
| F. 현재 정보만으로 결정 불가 | 성급한 변경 방지 | 이미 확인된 저위험 연결도 미룸 | 없음 | 없음 | 전체 선택은 기각, 일부 미검증에 적용 |

## 최종 계약

최종 선택은 **E**이며, A의 값 보존과 C의 정확한 기존 Token 연결을 결합합니다. 현재 computed value를 바꾸지 않습니다.

| UI 의미 | 현재 값 | 계약 값 | Token 여부 | 변경 여부 | 근거 |
|---|---:|---:|---|---|---|
| Control: Button·Button Link | `8px` | `8px` | 기존 `--radius-control` | 값 변경 없음 | Token과 의미·값 일치 |
| Field: input·select·textarea | `7px` | `7px` | 확정 `--radius-field` | 값 변경 없음 | 후속 구현에서 선언·연결하고 computed value 유지 |
| Card: 일반 registry·result·history·project | `12px` | `12px` | 기존 `--radius-card` | 값 변경 없음 | 반복되는 일반 Card |
| Compact metric card | `10px` | `10px` | Token화 제외 | 값 변경 없음 | 별도 의미 계약 전까지 literal 유지 |
| Selectable baseline card | `10px` | `10px` | Token화 제외 | 값 변경 없음 | Metric과 통합하지 않고 literal 유지 |
| Panel: form·state·detail·filter·summary | `12px` | `12px` | 기존 `--radius-card` | 값 변경 없음 | 값과 반복 container 구조가 일치 |
| Message surface | `7px`, `8px` | 현재 값 유지 | 의미별 후속 결정 | 값 변경 없음 | 상태와 구조에 따라 값이 다름 |
| Badge | `999px` | `999px` | 기존 `--radius-pill` | 값 변경 없음 | 두 Badge selector가 pill 형태 |
| Pill | `999px` | `999px` | 기존 `--radius-pill` | 값 변경 없음 | 내용 길이와 무관한 capsule |
| Circle | `50%` | `50%` | 일반 Token 없음 | 값 변경 없음 | 정사각 loading marker 예외 |
| Modal·dialog | NOT_PRESENT | NOT_PRESENT | NOT_PRESENT | 없음 | 저장소에 해당 UI 없음 |

일반 Card와 Panel은 값과 반복 container 구조가 일치하므로 후속 구현 PR에서 `--radius-card`에 연결합니다. Token 이름 변경이나 `--radius-panel` alias 추가는 이번 범위에서 하지 않습니다.

## 추론과 미검증

### 추론

- `12px` 그룹은 border, surface와 container 역할이 반복되어 하나의 일반 container 계약으로 볼 근거가 있습니다.
- `10px` 두 사용처는 일반 Card보다 작은 nested surface라는 공통점이 있지만 상호작용 의미가 달라 단일 Token 근거는 부족합니다.
- `7px` message surface들은 밀도가 비슷하지만 상태 의미가 서로 다르므로 field Token 재사용 근거가 없습니다.

### 미검증

| 항목 | 상태 | 이유 |
|---|---|---|
| 현재 Browser computed `border-radius` | NOT_VERIFIED | 이번 브랜치는 저장소 조사와 문서 계약만 수행 |
| native checkbox·radio corner 표시 | NOT_VERIFIED | CSS 선언과 실제 native appearance를 구분해야 함 |
| Token 연결 전후 Pixel 동일성 | NOT_VERIFIED | 구현 전이며 자동 Pixel Diff 없음 |
| nested radius와 overflow clipping | NOT_VERIFIED | 실제 구현 후 화면 검증 필요 |
| modal·dialog와 icon-only control | NOT_PRESENT | 현재 코드 검색에서 없음 |

## 후속 구현 PR의 최소 범위

Phase A3의 별도 구현 PR은 다음 작은 묶음만 허용합니다.

1. `--radius-field: 7px` 선언
2. `input, textarea, select`를 `--radius-field`에 연결
3. `.button`을 `--radius-control`에 연결
4. 일반 `12px` Card·Panel을 `--radius-card`에 연결
5. `.status-badge`와 `.semantic-badge`를 `--radius-pill`에 연결
6. 각 치환 전후 computed value와 네 viewport Browser 회귀 확인

다음 대상은 후속 구현에서 제외합니다.

- `.form-error`, `.notice`, `.refreshing`, `.immutable-note`의 `7px` message surface
- `8px` non-control surface
- `10px` `.metric-card`
- `10px` `.baseline-candidate`
- `50%` loading marker

제외 대상은 현재 literal을 유지합니다. 별도 의미 계약 전까지 Token을 추가하거나 기존 Token에 연결하지 않습니다.

## Browser 검증 계획

- 환경: Chrome headed mode, Zoom 100%, device scale 1
- Route: `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail
- Viewport: `1440px`, `1024px`, `768px`, `390px`
- 항목: control corner, Card·Panel corner, border·shadow 정렬, nested radius 충돌, overflow clipping, focus outline clipping, Badge·pill 형태, mobile layout, Console 오류, computed `border-radius`
- 추가 항목: checkbox·radio native appearance, compact Pagination Button, Baseline Candidate 선택 상태, Snapshot `details` 내부 clipping, loading marker circle
- 현재 결과: `NOT_VERIFIED`

구현 전에는 시각적 동일성이나 Browser 결과를 `PASS`로 기록하지 않습니다. 정적 typecheck, lint와 build도 시각 동일성의 증거로 사용하지 않습니다.

## 변경하지 않는 범위와 Phase 경계

- CSS 값, Token 실제 선언·연결, React Component, 테스트와 Layout은 변경하지 않습니다.
- `7px→8px`, `10px→12px` 정규화를 하지 않습니다.
- 공통 Component를 만들거나 modal·icon-only control을 새로 추가하지 않습니다.
- WCAG 준수 여부를 radius 계약으로 판단하지 않습니다.
- 이번 문서 계약은 Phase A3이며 Phase A3의 다른 미완료 계약을 완료 처리하지 않습니다.
- Phase B의 Navigation·State Component 작업은 시작하지 않습니다.
