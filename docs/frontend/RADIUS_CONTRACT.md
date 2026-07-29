# Frontend Radius Contract

## 2026-07-29 Phase A3 Token Browser 통합 검증

이번 통합 검증은 기준 commit `26e05af`에서 Radius·Spacing·Line-height를 함께 확인하려고 시도했다. PostgreSQL migration은 host `5433`의 `evalops_local`에 정상 적용됐지만 공식 Demo Seed는 Evaluation Case graph가 기대 5건, 실제 6건인 `DEMO_SEED_CONFLICT`로 종료됐다. `3000` 포트의 기존 `server.js`는 `/projects`에 HTTP 404를 반환해 현재 저장소 Frontend로 확인되지 않았다.

| 항목 | 상태 | 실제 결과 |
|---|---|---|
| Backend 준비 | `BLOCKED_DEMO_SEED` | Migration 성공, 공식 Demo Seed conflict로 Backend Browser 세션 미기동 |
| Frontend 준비 | `BLOCKED_FRONTEND` | 기존 `3000` 프로세스의 `/projects`가 404; 현재 저장소 Frontend 미기동 |
| Chrome | `NOT_VERIFIED_ENVIRONMENT` | Chrome 설치는 확인했으나 선행 조건 불충족으로 headed session·CDP 미실행 |
| 적용 전 baseline | `BASELINE_NOT_CAPTURED` | Screenshot·computed style baseline 없음 |
| 자동 Pixel Diff | `NOT_PRESENT` | 기존 자동화와 비교 이미지 없음 |

Projects는 `BLOCKED_FRONTEND`, Project Overview·Dataset Detail·Experiment Create·Experiment Detail·History·Comparison Detail은 `BLOCKED_DEMO_SEED`다. 요청한 `1440px`, `1024px`, `768px`, `390px` viewport의 실제 크기, zoom과 device pixel ratio는 측정하지 않았다.

Radius computed value, Input·Textarea·Select, message surface 예외, `10px` literal, Card·Panel corner, border·background·focus clipping, disabled control, mobile corner, overflow와 Console은 모두 `NOT_VERIFIED_ENVIRONMENT`다. 현재 상태의 정상 여부도 Browser에서 확인하지 않았으므로 `VERIFIED_CURRENT_STATE`를 사용하지 않는다.

Radius Token·selector 계약과 구현 상태는 유지되지만 Radius Browser 통합 검증은 미완료다. Baseline이 없으므로 `PASS`, `PIXEL_IDENTICAL`, `NO_VISUAL_CHANGE`, `VISUAL_REGRESSION_PASS`로 기록하지 않는다.

## 조사 목적과 경계

이 문서는 Phase A3에서 현재 Frontend의 `border-radius` 사용 의미를 조사하고 후속 구현이 따라야 할 계약을 정의합니다. 이번 작업은 문서 계약만 다루며 CSS 값, Selector, React Component와 Layout은 변경하지 않습니다.

- 조사 기준 commit: `f634839a5b42a9a406c0d274009e81f525bf6e66`
- 조사 상태: `PASS`
- 조사 범위: 저장소 전체 키워드 검색, `apps/web/src/app/globals.css`, `apps/web/src/**/*.tsx`, `docs/frontend/DESIGN_TOKENS.md`, `docs/frontend/UI_UX_ROADMAP.md`
- 검색어: `border-radius`, `radius`, `--radius`, `7px`, `8px`, `10px`, `12px`, `999px`, `50%`, `rounded`, `pill`, `circle`
- 구현 변경: `PASS`
- Browser 검증: `NOT_VERIFIED_TOOL_LIMIT`

검색 결과의 Dependency lockfile integrity 문자열과 일반 spacing 값은 radius 근거에서 제외했습니다. 실제 radius 선언은 `apps/web/src/app/globals.css` 한 파일에서 확인했습니다.

## 확인된 사실

### 현재 값 전체 목록

| 값 | Selector | UI 의미 | 현재 Token 참조 | computed value 유지 |
|---:|---|---|---|---|
| `7px` | `input, textarea, select` | Text form control | `--radius-field` | 예 |
| `7px` | `.form-error` | Form error message surface | literal | 예 |
| `7px` | `.notice, .refreshing` | Success·refresh notice surface | literal | 예 |
| `7px` | `.immutable-note` | Neutral immutable guidance surface | literal | 예 |
| `8px` | `.button` | 기본·secondary·danger·compact Button과 Button 형태 Link | `--radius-control` | 예 |
| `8px` | `.warning-list li` | Warning list item surface | literal | 예 |
| `8px` | `.download-error` | Download error surface | literal | 예 |
| `8px` | `.inline-fieldset` | Checkbox·radio option group container | literal | 예 |
| `8px` | `.snapshot-value` | Code snapshot container | literal | 예 |
| `10px` | `.metric-card` | Metric summary card | literal | 예 |
| `10px` | `.baseline-candidate` | 선택 가능한 Baseline candidate card | literal | 예 |
| `12px` | `.form-panel, .state-panel, .detail-panel, .coming-next` | Form·state·detail Panel | `--radius-card` | 예 |
| `12px` | `.project-card` | Project card | `--radius-card` | 예 |
| `12px` | `.filter-panel, .summary-panel` | Filter·summary Panel | `--radius-card` | 예 |
| `12px` | `.history-card` | History card | `--radius-card` | 예 |
| `12px` | `.dataset-card, .case-card, .version-card` | Registry·case·version card | `--radius-card` | 예 |
| `12px` | `.baseline-candidates` | Baseline candidate group Panel | `--radius-card` | 예 |
| `12px` | `.result-card` | Evaluation result card | `--radius-card` | 예 |
| `999px` | `.status-badge` | Active·inactive status pill | `--radius-pill` | 예 |
| `999px` | `.semantic-badge` | Semantic status pill | `--radius-pill` | 예 |
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
| `--radius-control` | `8px` | `.button`, warning·download error surface, inline fieldset, snapshot code | `.button` |
| `--radius-field` | `7px` | `input, textarea, select` | `input, textarea, select` |
| `--radius-card` | `12px` | 일반 Panel과 Card | 확정된 일반 Card·Panel selector |
| `--radius-pill` | `999px` | status·semantic Badge | `.status-badge`, `.semantic-badge` |

네 Token은 위 selector에서 `var()`로 참조합니다. `--radius-control: 8px`과 값이 같은 모든 `8px` 사용처가 control 의미인 것은 아닙니다. 따라서 `.warning-list li`, `.download-error`, `.inline-fieldset`, `.snapshot-value`는 literal을 유지합니다.

### 7px 계약

`7px`는 form control, form error, success·refresh notice, immutable note라는 서로 다른 의미에 사용됩니다.

- 현재 값을 유지합니다.
- `--radius-control`은 `8px`이므로 연결하지 않습니다.
- `--radius-field: 7px`을 선언하고 `input, textarea, select`에 연결했습니다. 목표 computed value는 기존과 같은 `7px`입니다.
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

- `8px`: `.button`을 기존 `--radius-control`에 연결했습니다. 다른 `8px` surface는 literal을 유지합니다.
- `12px`: 확정된 일반 Card와 Panel selector를 기존 `--radius-card`에 연결했습니다. Token 이름 변경이나 `--radius-panel` alias 추가는 하지 않았습니다.
- `999px`: `.status-badge`와 `.semantic-badge`를 기존 `--radius-pill`에 연결했습니다.
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

## 구현된 최소 범위

이번 Phase A3 구현에서 다음 작은 묶음을 적용했습니다.

1. `--radius-field: 7px` 선언
2. `input, textarea, select`를 `--radius-field`에 연결
3. `.button`을 `--radius-control`에 연결
4. 일반 `12px` Card·Panel을 `--radius-card`에 연결
5. `.status-badge`와 `.semantic-badge`를 `--radius-pill`에 연결
6. 각 치환 전후 computed value와 네 viewport Browser 회귀 확인은 `NOT_VERIFIED`

다음 대상은 후속 구현에서 제외합니다.

- `.form-error`, `.notice`, `.refreshing`, `.immutable-note`의 `7px` message surface
- `8px` non-control surface
- `10px` `.metric-card`
- `10px` `.baseline-candidate`
- `50%` loading marker

제외 대상은 현재 literal을 유지했습니다. 별도 의미 계약 전까지 Token을 추가하거나 기존 Token에 연결하지 않습니다.

## Browser 검증 계획

- 환경: Chrome headed mode, Zoom 100%, device scale 1
- Route: `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail
- Viewport: `1440px`, `1024px`, `768px`, `390px`
- 항목: control corner, Card·Panel corner, border·shadow 정렬, nested radius 충돌, overflow clipping, focus outline clipping, Badge·pill 형태, mobile layout, Console 오류, computed `border-radius`
- 추가 항목: checkbox·radio native appearance, compact Pagination Button, Baseline Candidate 선택 상태, Snapshot `details` 내부 clipping, loading marker circle
- 현재 결과: `NOT_VERIFIED_TOOL_LIMIT`

Browser 검증 전에는 시각적 동일성이나 Browser 결과를 `PASS`로 기록하지 않습니다. 정적 typecheck, lint와 build도 시각 동일성의 증거로 사용하지 않습니다.

## 2026-07-28 Browser 검증 시도

### 환경과 도구 상태

| 항목 | 요청 환경 | 실제 확인 | 상태 |
|---|---|---|---|
| Browser | Chrome headed mode | Chrome 2회 실행, DevTools Protocol 포트 연결 실패 | `NOT_VERIFIED_TOOL_LIMIT` |
| Zoom | 100% | DevTools 연결 실패로 측정 불가 | `NOT_VERIFIED_TOOL_LIMIT` |
| Device scale | 1 | 실행 인자로 요청했으나 `window.devicePixelRatio` 측정 불가 | `NOT_VERIFIED_TOOL_LIMIT` |
| Viewport | 1440px, 1024px, 768px, 390px | `window.innerWidth`, `window.innerHeight` 측정 불가 | `NOT_VERIFIED_TOOL_LIMIT` |
| Frontend | 현재 저장소의 Next.js 개발 서버 | `http://localhost:3100/projects` HTTP 200 확인 | `PASS` |
| Backend·Demo Seed | 기존 데이터 읽기 | Backend 응답 없음, Docker Engine 미실행 | `BLOCKED` |
| 대체 Driver | 기존 설치 도구만 사용 | ChromeDriver, EdgeDriver, Playwright, Puppeteer, Selenium 없음 | `NOT_PRESENT` |

Frontend HTTP 200은 서버 응답만 확인한 결과이며 Browser 렌더링, Route 동작 또는 시각 검증 `PASS`의 근거가 아닙니다. 데이터는 생성하거나 변경하지 않았습니다.

### Route별 상태

| Route | 실제 URL 또는 조건 | 상태 | 결과 |
|---|---|---|---|
| Projects | `http://localhost:3100/projects` | `NOT_VERIFIED_TOOL_LIMIT` | HTTP 200만 확인, Browser 렌더링 미확인 |
| Project Overview | Demo Seed Project ID 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |
| Dataset Detail | Demo Seed Project·Dataset ID 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |
| Experiment Create | Demo Seed Project ID와 Registry 데이터 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |
| Experiment Detail | Demo Seed Project·Experiment ID 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |
| History | Demo Seed Project ID 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |
| Comparison Detail | Demo Seed Project·Comparison ID 필요 | `BLOCKED` | Backend·Demo Seed 미가동 |

### Selector별 computed style 결과

DevTools Protocol 연결 실패로 `getComputedStyle`을 실행하지 못했습니다. 아래 값은 계약 기대값이며 실제 Browser 측정값이 아닙니다.

| Selector | 기대값 | 실제값 | 상태 |
|---|---:|---:|---|
| `.button` | `8px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `input`, `textarea`, `select` | `7px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| 확정된 일반 Card·Panel selector | `12px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `.status-badge`, `.semantic-badge` | `999px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `.form-error`, `.notice`, `.refreshing`, `.immutable-note` | `7px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `.warning-list li`, `.download-error`, `.inline-fieldset`, `.snapshot-value` | `8px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `.metric-card`, `.baseline-candidate` | `10px` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |
| `.state-marker` | `50%` | 미측정 | `NOT_VERIFIED_TOOL_LIMIT` |

### 시각·Focus·Console 결과

| 검증 항목 | 상태 | 결과 |
|---|---|---|
| Button·Field corner | `NOT_VERIFIED_TOOL_LIMIT` | Browser 렌더링 미확인 |
| Card·Panel border와 shadow 정렬 | `NOT_VERIFIED_TOOL_LIMIT` | Browser 렌더링 미확인 |
| nested radius 충돌 | `NOT_VERIFIED_TOOL_LIMIT` | Browser 렌더링 미확인 |
| overflow clipping과 가로 overflow | `NOT_VERIFIED_TOOL_LIMIT` | 실제 viewport 미확보 |
| focus-visible outline clipping | `NOT_VERIFIED_TOOL_LIMIT` | keyboard·mouse 입력 자동화 불가 |
| Badge·pill capsule 형태 | `NOT_VERIFIED_TOOL_LIMIT` | Browser 렌더링 미확인 |
| checkbox·radio computed radius와 native appearance | `NOT_VERIFIED_TOOL_LIMIT` | 요소 접근·입력 자동화 불가 |
| mobile layout | `NOT_VERIFIED_TOOL_LIMIT` | 실제 viewport 미확보 |
| Console 오류 | `NOT_VERIFIED_TOOL_LIMIT` | Console event 수집 불가 |
| 자동 Pixel Diff | `NOT_PRESENT` | 수행하지 않음 |

### 확인된 사실, 추론과 미검증

확인된 사실:

- 현재 저장소 Frontend는 3100 포트의 `/projects` 요청에 HTTP 200을 반환했습니다.
- Chrome headed 실행은 가능했지만 두 개의 별도 임시 profile과 DevTools Protocol 포트 모두 연결되지 않았습니다.
- 기존 설치 대체 Driver는 확인되지 않았습니다.
- Backend와 Docker Engine은 실행되지 않았고 Demo Seed 데이터는 변경하지 않았습니다.

추론:

- Token과 기존 literal 값이 같으므로 CSS 계약상 computed value 보존이 목표입니다.
- 이 추론은 실제 `getComputedStyle`이나 시각적 동일성의 Browser 증거가 아닙니다.

미검증:

- 요청한 네 viewport의 실제 `window.innerWidth`, `window.innerHeight`, `window.devicePixelRatio`
- 일곱 Route의 Browser 렌더링
- 모든 대표 selector의 computed `border-radius`
- nested radius, overflow, focus outline, Badge, native checkbox·radio, mobile layout과 Console

### 도구 제한과 최종 판정

긴 복합 스크립트나 반복 polling은 실행하지 않았습니다. Chrome DevTools Protocol 연결을 서로 다른 임시 profile과 포트로 두 번 시도한 뒤 같은 실패의 반복을 중단했습니다.

Radius Browser 검증의 최종 판정은 `NOT_VERIFIED_TOOL_LIMIT`입니다. 핵심 computed style, 실제 viewport, 시각·Focus와 Console 측정을 수행하지 못했으므로 일부 또는 전체를 `PASS`로 기록하지 않습니다. Radius Token 구현 상태는 유지되지만 Radius Browser 검증 하위 작업은 완료되지 않았습니다. Phase A3 전체도 완료 상태가 아니며 Phase B는 시작하지 않습니다.

## 변경하지 않는 범위와 Phase 경계

- CSS의 radius 값은 변경하지 않고 확정 Token 선언·연결만 적용했습니다. React Component, 테스트와 Layout은 변경하지 않습니다.
- `7px→8px`, `10px→12px` 정규화를 하지 않습니다.
- 공통 Component를 만들거나 modal·icon-only control을 새로 추가하지 않습니다.
- WCAG 준수 여부를 radius 계약으로 판단하지 않습니다.
- 이번 문서 계약은 Phase A3이며 Phase A3의 다른 미완료 계약을 완료 처리하지 않습니다.
- Phase B의 Navigation·State Component 작업은 시작하지 않습니다.
