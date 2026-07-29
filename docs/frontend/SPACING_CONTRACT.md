# Frontend Spacing Contract

## 조사 목적과 경계

이 문서는 Phase A3에서 현재 Frontend의 `margin`, `padding`, `gap` 사용 현황과 UI 의미를 조사하고 후속 구현이 따라야 할 Spacing 계약을 정의합니다. 이번 브랜치는 문서 계약만 다루며 CSS, Selector, React Component와 Layout은 변경하지 않습니다.

- 조사 기준 commit: `fa0480a03900025c14ca53020630ead39fac1a06`
- 조사 상태: `PASS`
- 조사 파일: 저장소 전체 키워드 검색, `apps/web/src/app/globals.css`, `apps/web/src/**/*.tsx`, `docs/frontend/DESIGN_TOKENS.md`, `docs/frontend/UI_UX_ROADMAP.md`
- 조사 속성: `margin`과 방향별 속성, `padding`과 방향별 속성, `gap`, `row-gap`, `column-gap`
- 구현 변경: `NOT_PRESENT`
- Browser 검증: `NOT_VERIFIED`

실제 spacing 선언은 `apps/web/src/app/globals.css` 한 파일에서 확인했습니다. 빈도는 각 spacing 선언의 shorthand에 기록된 숫자 항목을 한 번씩 계산했습니다. 예를 들어 `padding: 10px 12px`은 `10px`과 `12px` 각각 1회이며, selector가 여러 개 묶인 선언은 CSS 선언 기준 1회입니다. `auto`는 숫자 literal 빈도에서 제외했습니다.

## 기존 Spacing Token

| Token | 값 | 현재 selector 참조 | 정확히 일치하는 대표 literal | 값은 같지만 다른 의미 |
|---|---:|---|---|---|
| `--space-1` | `4px` | 없음 | semantic Badge block padding, compact Pagination top margin, mobile metadata gap | padding·margin·gap |
| `--space-2` | `8px` | 없음 | heading·metadata margin, action gap, legend·Badge padding | margin·padding·gap |
| `--space-3` | `12px` | 없음 | version list·header gap, back action margin, field·notice padding | margin·padding·gap |
| `--space-4` | `16px` | 없음 | 다수 Grid·header gap, metadata padding, margin | component·grid·section 내부 의미 혼재 |
| `--space-5` | `24px` | 없음 | 일반 Panel padding, header·state gap, summary gap | container padding과 gap |
| `--space-6` | `32px` | 없음 | Breadcrumb bottom margin, mobile page top padding | navigation margin과 responsive page padding |
| `--space-7` | `40px` | 없음 | `.overview-section` top margin | section rhythm |
| `--space-8` | `56px` | 없음 | desktop `.app-shell` top padding | page shell top |
| `--space-9` | `80px` | 없음 | desktop `.app-shell` bottom padding | page shell bottom |

기존 Token은 모두 `:root`에 선언되어 있지만 spacing selector에서 `var(--space-*)` 참조는 `NOT_PRESENT`입니다. 값이 같다는 이유만으로 서로 다른 margin·padding·gap 의미를 하나의 사용 계약으로 합치지 않습니다.

## 현재 spacing literal과 빈도

| 값 | 전체 | Margin | Padding | Gap | 대표 selector와 의미 |
|---:|---:|---:|---:|---:|---|
| `0` | 38 | 27 | 11 | 0 | reset, 축 방향 제거, shorthand의 0 |
| `3px` | 1 | 0 | 0 | 1 | `.baseline-candidate-heading > span` 내부 gap |
| `4px` | 3 | 1 | 1 | 1 | compact Pagination margin, semantic Badge padding, mobile metadata gap |
| `5px` | 3 | 1 | 1 | 1 | status Badge padding, history summary gap, error copy margin |
| `6px` | 9 | 1 | 1 | 7 | Badge·reason·option inline gap, heading margin, legend padding |
| `7px` | 2 | 0 | 1 | 1 | label gap, compact list vertical padding |
| `8px` | 11 | 5 | 4 | 2 | heading·metadata margin, action gap, Badge·legend padding |
| `9px` | 5 | 1 | 2 | 2 | Breadcrumb·warning gap, Badge·note padding, metric margin |
| `10px` | 9 | 2 | 4 | 3 | heading·snapshot margin, notice·metadata padding, action gap |
| `11px` | 1 | 0 | 1 | 0 | form field block padding |
| `12px` | 9 | 1 | 5 | 3 | back margin, field·message padding, list·header gap |
| `14px` | 7 | 1 | 4 | 2 | notice·error·fieldset·snapshot padding, compact card gap |
| `16px` | 25 | 7 | 3 | 15 | Grid·header gap, metadata·card link padding, 내부 margin |
| `18px` | 18 | 6 | 5 | 7 | form·grid gap, section 내부 margin, Button·card padding |
| `20px` | 5 | 1 | 3 | 1 | 일반 Card padding, description margin, Experiment form gap |
| `22px` | 3 | 1 | 2 | 0 | Project·filter Panel padding, header action margin |
| `24px` | 4 | 0 | 1 | 3 | 일반 Panel padding, header·state·summary gap |
| `26px` | 1 | 1 | 0 | 0 | Gate option 설명 indent |
| `28px` | 3 | 3 | 0 | 0 | 일반 Panel vertical margin, Pagination top margin |
| `32px` | 2 | 1 | 1 | 0 | Breadcrumb bottom margin, mobile page top padding |
| `40px` | 1 | 1 | 0 | 0 | Overview section top margin |
| `56px` | 1 | 0 | 1 | 0 | desktop page shell top padding |
| `80px` | 1 | 0 | 1 | 0 | desktop page shell bottom padding |

`48px`은 조사 키워드에 포함했으나 spacing 속성에서 `NOT_PRESENT`입니다. `row-gap`과 `column-gap`의 개별 선언도 `NOT_PRESENT`이며, 두 축이 다른 경우 `.baseline-candidate-details`의 `gap: 8px 16px` shorthand를 사용합니다.

## 값별 selector 문맥

모든 경로는 `apps/web/src/app/globals.css`입니다.

| 값 | 주요 selector |
|---:|---|
| `3px` | `.baseline-candidate-heading > span` |
| `4px` | `.semantic-badge`, `.compact-pagination`, mobile `.card-meta div, .detail-list div` |
| `5px` | `.status-badge`, `.history-summary`, `.download-error p` |
| `6px` | `.status-badge`, `.state-panel h2`, `.badge-row > span`, `.inline-fieldset legend`, `.gate-options`, `.gate-reasons`, `.comparison-reasons`, `.baseline-candidate-details > span` |
| `7px` | `label`, `.compact-list div, .trend-values div` |
| `8px` | `.eyebrow, .slug`, `.case-actions`, `.metric-card small`, `.summary-copy`, `.filter-panel legend`, `.semantic-badge`, `.baseline-candidates legend`, `.baseline-candidate-details`, `.gate-options p`, `.metadata-error` |
| `9px` | `.status-badge`, `.breadcrumb`, `.metric-card p`, `.warning-list`, `.immutable-note` |
| `10px` | `h1`, `.form-error`, `.notice, .refreshing`, `.card-meta div, .detail-list div`, `.header-actions, .filter-actions, .badge-row`, `.warning-list li`, `.baseline-candidate-heading`, `.version-picker`, `.snapshot-value` |
| `11px` | `input, textarea, select` |
| `12px` | form field·message·notice·note padding, `.back-action`, `.history-card header`, `.version-list`, `.baseline-candidate-list, .comparison-case-list`, compact Button |
| `14px` | notice·error·note·fieldset·snapshot padding, `.metric-grid`, `.baseline-candidate` |
| `16px` | 공통 Grid·Card header·metadata gap, Card link·error·candidate padding, 여러 top·vertical margin |
| `18px` | Button inline padding, form·project Grid gap, Panel·Card 내부 margin, Metric·Baseline group padding |
| `20px` | `.card-description`, `.history-card`, `.dataset-card, .case-card, .version-card`, `.experiment-create-form`, `.result-card` |
| `22px` | `.project-card`, `.header-actions`, `.filter-panel, .summary-panel` |
| `24px` | 공통 page header gap, 일반 Panel padding, `.state-panel`, `.summary-panel` gap |
| `26px` | `.gate-options p` |
| `28px` | 일반 Panel vertical margin, `.filter-panel, .summary-panel`, `.pagination` |
| `32px` | `.breadcrumb`, mobile `.app-shell` |
| `40px` | `.overview-section` |
| `56px`, `80px` | desktop `.app-shell` |

## Margin·Padding·Gap 분류

### Margin

Margin은 reset, text rhythm, component 분리와 page section rhythm에 함께 쓰입니다. 주요 page·section 값은 `28px`, `32px`, `40px`이며, component 내부 text·action margin에는 `5px`부터 `22px`까지 여러 값이 사용됩니다.

- Page·section: `.overview-section` `40px`, Panel과 Pagination `28px`, Breadcrumb `32px`
- Component 분리: `.header-actions` `22px`, `.card-description` `20px`, `.card-link` `18px`
- 내부 text rhythm: heading·copy·metadata에서 `5px`~`16px`
- Reset과 축 제거: `0`

### Padding

Padding은 page shell, container, control과 status surface에 사용됩니다.

- Page shell: desktop `56px 0 80px`, mobile top `32px`
- 일반 Panel: `24px`
- Card family: `18px`, `20px`, `22px`
- Button: 기본 inline `18px`, compact inline `12px`
- Field: `11px 12px`
- Badge: status `5px 9px`, semantic `4px 8px`
- Notice·Error: `10px 12px`, `10px 14px`, `14px 16px`

### Gap

Gap은 Form, Grid, header, inline metadata와 loading state에 사용됩니다.

- Form: 주로 `18px`
- 일반 Grid·Card header: 주로 `16px`
- Page header·loading state: `24px`
- Inline metadata·icon과 Text: 주로 `6px`, 일부 `8px`, `10px`
- Compact nested content: `3px`~`14px`

## UI 의미별 분류

| UI 의미 | 상태 | 현재 값과 근거 |
|---|---|---|
| Page shell top·bottom padding | `PASS` | desktop `56px 0 80px`, mobile top `32px` |
| Page section 간격 | `PASS` | `.overview-section` `40px`, Panel·Pagination `28px` 등 |
| Card·Panel padding | `PASS` | Panel `24px`, Card family `18px`·`20px`·`22px` |
| Card 내부 요소 간격 | `PASS` | `3px`~`20px`, component 문맥별 차이 |
| Form field 간격 | `PASS` | form gap `18px`, label gap `7px`, field padding `11px 12px` |
| Form action 간격 | `PASS` | 공통 action group gap `10px`, case actions `8px` |
| Button horizontal padding | `PASS` | 기본 `18px`, compact `12px` |
| Grid gap | `PASS` | 주로 `16px`·`18px`, metric `14px` |
| List gap | `PASS` | `9px`, `12px`, `16px` 등 |
| Badge padding | `PASS` | status `5px 9px`, semantic `4px 8px` |
| Notice·Error padding | `PASS` | `10px 12px`, `10px 14px`, `14px 16px` |
| Pagination gap·margin | `PASS` | gap `16px`, top margin `28px`; compact top `4px` |
| Header gap | `PASS` | page header `24px`, Card header `12px`·`16px` |
| Navigation gap | `PASS` | Breadcrumb `9px`; 별도 공통 Navigation은 `NOT_PRESENT` |
| Table cell padding | `NOT_PRESENT` | Table UI 없음 |
| Modal·dialog padding | `NOT_PRESENT` | Modal·dialog 없음 |
| Mobile breakpoint spacing | `PASS` | page top `32px`, metadata gap `4px`; width gutter는 별도 layout 표현 |
| Inline metadata gap | `PASS` | 주로 `6px`, 상세 묶음 `8px 16px` |
| Icon과 Text 간격 | `PASS` | Badge·reason group `6px`; 독립 icon Component는 없음 |
| Loading state gap | `PASS` | `.state-panel` `24px` |

## 주요 예외값 계약

### 18px

`18px`은 gap 7회, margin 6회, padding 5회로 서로 다른 의미에 사용됩니다.

- Form gap: `.form-panel form`, `.form-grid`, `.case-form`, `.gate-form`, `.comparison-form`
- Grid gap: `.project-grid`
- Margin: notice, card link, filter actions, history grid·summary, case actions
- Padding: Button inline, Metric Card, Baseline group, version divider

판정은 **E. 사용처별 분리**입니다. Form의 반복 `18px` gap은 후속 `--space-form-gap: 18px` 계약으로 묶습니다. Button padding, Grid gap, margin과 container padding에는 이 Token을 재사용하지 않고 literal을 유지합니다.

`--space-form-gap`의 허용 selector는 `.form-panel form`, `.form-grid`, `.case-form`, `.gate-form`, `.comparison-form`으로 고정합니다. `.project-grid`의 `18px` gap은 같은 값이지만 Form 의미가 아니므로 연결하지 않습니다.

### 20px

`20px`은 일반 Card padding 3회, `.card-description` vertical margin 1회, Experiment Create form gap 1회입니다.

판정은 **E. 사용처별 분리**입니다. `.history-card`, `.dataset-card, .case-card, .version-card`, `.result-card`의 일반 Card padding은 후속 `--space-card-padding: 20px` 계약으로 묶습니다. Description margin과 Experiment form gap은 같은 값만으로 Card Token에 연결하지 않습니다. `18px` 또는 `22px`과 합치지 않습니다.

`--space-card-padding`의 허용 selector는 `.history-card`, `.dataset-card`, `.case-card`, `.version-card`, `.result-card`로 고정합니다.

### 22px

`22px`은 `.project-card` padding, `.filter-panel, .summary-panel` padding, `.header-actions` top margin에 사용됩니다.

판정은 **A. literal 유지**입니다. 두 container padding도 Project Card와 filter·summary Panel이라는 서로 다른 밀도를 나타내며, 현재 일반 Card `20px`이나 Panel `24px`과 같은 의미라는 근거가 없습니다. `24px`로 정규화하지 않습니다.

### 28px

`28px`은 일반 Panel vertical margin, filter·summary Panel vertical margin, Pagination top margin에 사용됩니다.

판정은 **E. 사용처별 분리**입니다. Panel의 `margin: 28px 0`은 반복되는 container separation으로 후속 `--space-panel-margin-block: 28px` 계약에 포함합니다. Pagination은 의미가 다르므로 literal `28px`을 유지합니다. `24px` 또는 `32px`로 정규화하지 않습니다.

`--space-panel-margin-block`의 허용 selector는 `.form-panel`, `.state-panel`, `.detail-panel`, `.coming-next`, `.filter-panel`, `.summary-panel`로 고정합니다.

## 기타 예외값과 responsive 계약

- `7px`, `9px`, `11px`, `14px`, `26px`: 현재 component 밀도 또는 alignment에 종속된 literal로 유지합니다.
- `3px`, `5px`, `6px`, `10px`: compact·inline spacing에 반복되지만 의미 범위가 넓어 일괄 Token화하지 않습니다.
- `16px`: 가장 빈번하지만 Grid, header, margin과 padding 의미가 혼재하므로 전체 치환하지 않습니다.
- desktop page shell `56px`·`80px`은 각각 정확한 기존 `--space-8`, `--space-9`에 연결합니다.
- mobile page top `32px`은 정확한 기존 `--space-6`에 연결하되 desktop top과 하나의 Token으로 통합하지 않습니다.
- `.overview-section` `40px`은 정확한 기존 `--space-7`에 연결합니다.
- 일반 Panel padding `24px`은 정확한 기존 `--space-5`에 연결합니다.
- responsive width의 `calc(100% - 32px)`과 `100% - 24px`는 margin·padding·gap 속성이 아닌 container gutter 계산입니다. 이번 spacing Token 구현 범위에서 변경하지 않습니다.

## Grid gap과 Badge padding 계약

### 일반 Grid gap

`16px`·`18px` Grid gap은 이번 구현 대상에서 제외하고 각 selector의 literal을 유지합니다. `.project-grid`의 `18px`은 `--space-form-gap`에 연결하지 않습니다. 같은 값이라는 사실만으로 Form과 Grid 의미를 합치지 않습니다.

### Badge padding

- `.status-badge`는 `padding: 5px 9px`을 유지합니다.
- `.semantic-badge`는 `padding: 4px 8px`을 유지합니다.
- 이번 구현에서는 Badge padding을 기존 `--space-*` Token에 연결하지 않습니다.
- Badge padding 통합 또는 Token화는 별도 의미 계약 전까지 보류합니다.

responsive spacing은 desktop 값을 mobile 값으로 자동 통합하지 않습니다. 후속 구현에서도 desktop page top `56px`, bottom `80px`, mobile top `32px`의 computed value를 각각 유지합니다.

## 후보 A~F 비교

| 후보 | 장점 | 위험 | Layout 영향 | 구현 범위 | 판정 |
|---|---|---|---|---|---|
| A. 기존 literal 전부 유지 | 현재 Layout을 그대로 보존 | 반복 의미와 계약이 계속 분산 | 없음 | 없음 | 부분 채택 |
| B. 정확히 일치하는 기존 Token만 연결 | 값 변경 없이 기존 scale 활용 | 같은 값의 다른 의미를 과도하게 연결할 수 있음 | 없음이 목표 | 작은 selector 묶음 | 채택 |
| C. 의미별 신규 Token을 값 보존으로 추가 | scale 밖 반복 의미를 명확히 고정 | Token 증가와 잘못된 재사용 위험 | 없음이 목표 | 선언과 제한된 연결 | 선택적 채택 |
| D. `18px`·`20px`·`22px`·`28px` 정규화 | 숫자 scale 단순화 | 근거 없는 크기·wrapping·page rhythm 변화 | 있음 | 광범위 CSS와 Browser 회귀 | 기각 |
| E. 저위험 공통값만 Token화하고 예외 유지 | 의미와 현재 Layout을 함께 보존 | 일부 literal 유지 | 없음이 목표 | 최소 selector 묶음 | 최종 선택 |
| F. 현재 정보만으로 결정 불가 | 성급한 변경 방지 | 확인된 저위험 연결도 미룸 | 없음 | 없음 | 전체 선택은 기각, 미검증 항목에 적용 |

## 최종 계약

최종 선택은 **E**입니다. 정확히 일치하는 기존 Token 연결인 B와 의미가 반복되는 scale 밖 값의 제한적 신규 Token인 C를 결합하며 모든 computed spacing 값은 유지합니다.

| UI 의미 | 현재 값 | 계약 값 | Token 여부 | 변경 여부 | 근거 |
|---|---:|---:|---|---|---|
| Page shell desktop top | `56px` | `56px` | 기존 `--space-8` | 값 변경 없음 | page top 단일 의미 |
| Page shell desktop bottom | `80px` | `80px` | 기존 `--space-9` | 값 변경 없음 | page bottom 단일 의미 |
| Page shell mobile top | `32px` | `32px` | 기존 `--space-6` | 값 변경 없음 | responsive 값 별도 유지 |
| Section rhythm | `40px` | `40px` | 기존 `--space-7` | 값 변경 없음 | `.overview-section` |
| Panel block margin | `28px` | `28px` | 신규 `--space-panel-margin-block` | 값 변경 없음 | 두 Panel group 반복 |
| 일반 Panel padding | `24px` | `24px` | 기존 `--space-5` | 값 변경 없음 | 공통 Panel group |
| 일반 Card padding | `20px` | `20px` | 신규 `--space-card-padding` | 값 변경 없음 | 반복되는 일반 Card |
| Project·filter Card padding | `22px` | `22px` | literal 유지 | 값 변경 없음 | 일반 Card와 밀도 차이 |
| Metric·Baseline group padding | `18px` | `18px` | literal 유지 | 값 변경 없음 | 서로 다른 container 의미 |
| Form gap | `18px` | `18px` | 신규 `--space-form-gap` | 값 변경 없음 | 다섯 form selector 반복 |
| 일반 Grid gap | `16px`, `18px` | 현재 값 유지 | literal 유지 | 값 변경 없음 | 이번 구현 제외, `.project-grid`에 Form Token 재사용 금지 |
| Button padding | `0 18px` | 현재 값 유지 | literal 유지 | 값 변경 없음 | scale 밖 control 크기 |
| Compact Button padding | `0 12px` | 현재 값 유지 | literal 유지 | 값 변경 없음 | 기본 Button과 구분 |
| Badge padding | `5px 9px`, `4px 8px` | 현재 값 유지 | literal 유지 | 값 변경 없음 | 별도 계약 전까지 통합·Token화 보류 |
| Pagination | gap `16px`, top `28px` | 현재 값 유지 | literal 유지 | 값 변경 없음 | Panel rhythm과 다른 의미 |
| Table cell padding | `NOT_PRESENT` | `NOT_PRESENT` | `NOT_PRESENT` | 없음 | Table 없음 |
| Modal·dialog padding | `NOT_PRESENT` | `NOT_PRESENT` | `NOT_PRESENT` | 없음 | Modal·dialog 없음 |

## 확인된 사실, 추론과 미검증

### 확인된 사실

- spacing 숫자 literal은 `0`을 포함해 23개입니다.
- `--space-1`부터 `--space-9`까지 9개 Token이 선언되어 있고 selector 참조는 없습니다.
- `18px`, `20px`, `22px`, `28px`은 각각 여러 속성 또는 UI 의미에 사용됩니다.
- `16px`은 25회로 non-zero spacing literal 중 가장 자주 나타나지만 gap·margin·padding 의미가 섞여 있습니다.
- `48px`, 개별 `row-gap`, `column-gap`, Table과 Modal spacing은 현재 없습니다.

### 추론

- 반복 selector와 같은 UI 역할을 함께 만족하는 Form gap, 일반 Card padding과 Panel block margin은 의미 기반 Token으로 분리할 근거가 있습니다.
- 값만 정확히 일치하더라도 서로 다른 UI 역할의 모든 사용처를 기존 Token에 연결할 근거는 없습니다.
- 값 보존 치환은 시각 변화가 없도록 설계할 수 있지만 Browser 검증 전 Layout 동일성의 증거는 아닙니다.

### 미검증

| 항목 | 상태 | 이유 |
|---|---|---|
| Browser computed margin·padding·gap | `NOT_VERIFIED` | 이번 브랜치는 문서 계약만 수행 |
| 네 viewport Layout 동일성 | `NOT_VERIFIED` | 구현 전이며 자동 Pixel Diff 없음 |
| Grid wrapping과 가로 overflow | `NOT_VERIFIED` | 실제 Browser 검증 필요 |
| Text wrapping에 따른 Button·Badge 크기 | `NOT_VERIFIED` | 실제 렌더링 필요 |
| Table·Modal spacing | `NOT_PRESENT` | 해당 UI 없음 |

## 후속 구현 PR의 최소 범위

별도 Phase A3 구현 PR은 다음 값 보존 묶음만 적용합니다.

### 묶음 A — 기존 Token 연결

1. desktop `.app-shell` top `56px`을 `--space-8`에 연결
2. desktop `.app-shell` bottom `80px`을 `--space-9`에 연결
3. mobile `.app-shell` top `32px`을 `--space-6`에 연결
4. `.overview-section`의 `margin-top: 40px`을 `--space-7`에 연결
5. `.form-panel, .state-panel, .detail-panel, .coming-next`의 `padding: 24px`을 `--space-5`에 연결

### 묶음 B — 신규 의미 Token

1. `--space-form-gap: 18px`을 선언하고 `.form-panel form`, `.form-grid`, `.case-form`, `.gate-form`, `.comparison-form`에만 연결
2. `--space-card-padding: 20px`을 선언하고 `.history-card`, `.dataset-card`, `.case-card`, `.version-card`, `.result-card`에만 연결
3. `--space-panel-margin-block: 28px`을 선언하고 `.form-panel`, `.state-panel`, `.detail-panel`, `.coming-next`, `.filter-panel`, `.summary-panel`에만 연결

각 묶음은 치환 전후 computed style과 네 viewport Browser 회귀를 확인합니다. 범위가 커지면 묶음 A와 B를 두 PR로 분리할 수 있습니다. 한 PR로 진행하더라도 두 묶음의 selector와 제외 범위를 섞지 않으며 Selector 순서와 specificity를 유지합니다.

## 구현 제외 범위와 Phase 경계

- `.project-grid`의 `18px` gap
- Button의 `18px` padding
- Metric Card와 Baseline group의 `18px` padding
- component margin의 `18px`
- `.experiment-create-form`의 `20px` gap과 `.card-description`의 `20px` margin
- 모든 `22px` 사용처
- `.pagination`의 `28px` `margin-top`
- `3px`~`16px`의 compact·inline·Grid spacing 일괄 치환
- `.status-badge`와 `.semantic-badge` padding
- container gutter `calc()`
- responsive Layout 변경
- 가장 가까운 scale로 값 변경, CSS·Component 재설계와 공통 Component 생성

이번 계약은 Phase A3의 Spacing 하위 작업만 다룹니다. 다른 Phase A3 계약과 Browser 제한 항목을 완료 처리하지 않으며 Phase B의 Navigation·State Component 작업을 시작하지 않습니다.

## Browser 검증 계획

- 환경: Chrome headed mode, Zoom 100%, device scale 1
- Route: `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail
- Viewport: `1440px`, `1024px`, `768px`, `390px`
- 항목: Page vertical rhythm, section 간격, Card·Panel 크기, Grid wrapping, Form field 간격, Button 크기와 Text 정렬, Badge 크기, Pagination 정렬, mobile Layout, 가로 overflow, nested Layout, Console 오류, computed margin·padding·gap
- 현재 상태: `NOT_VERIFIED`

구현 전에는 Browser 결과나 Layout 동일성을 `PASS`로 기록하지 않습니다. 자동 Pixel Diff는 현재 `NOT_PRESENT`입니다.

## Phase A3 Spacing Browser 검증 결과

### 검증 기준과 환경

- 목적: 구현 묶음 A·B의 spacing token이 실제 Chrome computed style과 네 viewport의 layout에서 계약값을 유지하는지 확인
- 기준 commit: `59849c8`
- 검증 날짜: `2026-07-29`
- 요청 환경: Windows, Chrome headed mode, Zoom 100%, device scale 1
- 요청 viewport: `1440px`, `1024px`, `768px`, `390px`
- 최종 상태: `NOT_VERIFIED_TOOL_LIMIT`

| 환경 항목 | 상태 | 확인 결과 |
|---|---|---|
| Frontend | `NOT_VERIFIED` | 검증용 Frontend HTTP 서버를 시작하지 못해 응답과 렌더링을 확인하지 못함 |
| Backend | `BLOCKED` | `localhost:5432` 연결 시도가 실패했으며 정확한 연결 실패 원인은 `NOT_VERIFIED`; Backend를 시작하지 못함 |
| Docker | `PASS` | Docker Desktop과 `evalops-postgres`, `evalops-redis`, `evalops-minio` 실행 확인; 컨테이너 실행은 Backend 또는 Demo Seed 준비 완료를 의미하지 않음 |
| Demo Seed | `BLOCKED` | migration이 완료되지 않아 공식 `seed_demo`를 실행하지 못함 |
| Browser 자동화 도구 | `NOT_PRESENT` | Playwright, Puppeteer, Selenium, ChromeDriver가 설치되어 있지 않음 |
| Chrome 설치 | `PASS` | `C:\Program Files\Google\Chrome\Application\chrome.exe` 확인 |
| Chrome headed 실행 | `NOT_VERIFIED` | 기존 사용자 Chrome 프로세스는 있었으나 검증 전용 Chrome은 시작하지 않음 |
| CDP 연결 | `NOT_VERIFIED` | Backend·Demo Seed 선행 조건이 충족되지 않아 페이지 측정을 시도하지 않음 |

첫 번째 Compose 기동은 기존 `evalops-postgres` 컨테이너 이름 충돌로 중단됐다. 이후 Docker Desktop과 `evalops-postgres`, `evalops-redis`, `evalops-minio`의 실행을 확인했다. Migration 명령은 `localhost:5432`를 대상으로 실행됐지만 `evalops-postgres`는 host `5433`에서 container `5432`로 매핑돼 있었다. 두 endpoint가 일치하지 않으므로 실패한 endpoint가 `evalops-postgres`였는지는 확인되지 않으며, endpoint 불일치 또는 다른 PostgreSQL 인스턴스 연결 가능성이 있다. 정확한 연결 실패 원인은 `NOT_VERIFIED`다. 추가 재시도, 인증정보 추측, 데이터 변경, 임의 ID 또는 Mock 응답 생성은 수행하지 않았다.

### 실제 viewport와 Route

실제 Browser page에서 측정한 `window.innerWidth`, `window.innerHeight`, `window.devicePixelRatio`는 없다.

| Route | 상태 | 사유 |
|---|---|---|
| `/projects` | `BLOCKED` | Frontend와 Backend HTTP 응답 및 Browser 렌더링을 확인하지 못함 |
| Project Overview | `BLOCKED` | Demo Seed Project ID와 Backend가 필요함 |
| Dataset Detail | `BLOCKED` | Demo Seed Project·Dataset ID와 Backend가 필요함 |
| Experiment Create | `BLOCKED` | Demo Seed Project ID와 Registry 응답이 필요함 |
| Experiment Detail | `BLOCKED` | Demo Seed Experiment ID와 Backend가 필요함 |
| History | `BLOCKED` | Demo Seed Project ID와 Backend가 필요함 |
| Comparison Detail | `BLOCKED` | Demo Seed Comparison ID와 Backend가 필요함 |

### Token 선언값

아래 값은 구현 계약과 CSS 소스에서 확인된 값이며 Browser computed style 측정값이 아니다.

| Token | Expected | Browser actual | 상태 |
|---|---:|---:|---|
| `--space-5` | `24px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-6` | `32px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-7` | `40px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-8` | `56px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-9` | `80px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-form-gap` | `18px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-card-padding` | `20px` | 측정 없음 | `NOT_VERIFIED` |
| `--space-panel-margin-block` | `28px` | 측정 없음 | `NOT_VERIFIED` |

### Selector별 expected·actual

| Selector | Expected | Browser actual | 상태 |
|---|---|---|---|
| desktop `.app-shell` | padding `56px 0 80px` | 측정 없음 | `NOT_VERIFIED` |
| mobile `.app-shell` | padding-top `32px` | 측정 없음 | `NOT_VERIFIED` |
| `.overview-section` | margin-top `40px` | 측정 없음 | `NOT_VERIFIED` |
| `.form-panel`, `.state-panel`, `.detail-panel`, `.coming-next` | margin `28px 0`, padding `24px` | 측정 없음 | `NOT_VERIFIED` |
| `.filter-panel`, `.summary-panel` | margin `28px 0` | 측정 없음 | `NOT_VERIFIED` |
| `.form-panel form`, `.form-grid`, `.case-form`, `.gate-form`, `.comparison-form` | gap `18px` | 측정 없음 | `NOT_VERIFIED` |
| `.history-card`, `.dataset-card`, `.case-card`, `.version-card`, `.result-card` | padding `20px` | 측정 없음 | `NOT_VERIFIED` |

제외 literal인 `.project-grid` gap `18px`, Button horizontal padding `18px`, `.metric-card`와 `.baseline-candidates` padding `18px`, `.experiment-create-form` gap `20px`, `.card-description` margin `20px`, `22px` 사용처, `.pagination` margin-top `28px`, `.status-badge` padding `5px 9px`, `.semantic-badge` padding `4px 8px`도 Browser actual을 측정하지 못했으므로 `NOT_VERIFIED`다.

### Visual·interaction 결과

| 검증 항목 | 상태 | 결과 |
|---|---|---|
| Page vertical rhythm·Section 간격 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Card·Panel 크기 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Form field 간격 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Grid wrapping·nested layout | `NOT_VERIFIED_TOOL_LIMIT` | 실제 viewport 측정 없음 |
| Button·Text 정렬 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Badge 크기 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Pagination 정렬 | `NOT_VERIFIED_TOOL_LIMIT` | 실제 page 렌더링 없음 |
| Mobile layout | `NOT_VERIFIED_TOOL_LIMIT` | `390px` viewport 측정 없음 |
| 가로 overflow | `NOT_VERIFIED_TOOL_LIMIT` | `scrollWidth`와 `clientWidth` 측정 없음 |
| Focus outline clipping | `NOT_VERIFIED_TOOL_LIMIT` | keyboard focus와 clipping 확인 없음 |
| Browser Console 오류 | `NOT_VERIFIED_TOOL_LIMIT` | 검증 page Console 수집 없음 |
| 자동 Pixel Diff | `NOT_PRESENT` | 기준 이미지와 기존 자동화 도구 없음 |

### 사실·추론·미검증

확인된 사실:

- branch와 기준 commit은 각각 `docs/v0.29.3-phase-a3-spacing-browser-verification`, `59849c8`이다.
- Chrome과 Docker Desktop은 설치·실행 상태였다.
- 초기 Compose 서비스 목록은 비어 있었다.
- Playwright, Puppeteer, Selenium, ChromeDriver는 설치되어 있지 않았다.
- 첫 Compose 기동은 기존 PostgreSQL 컨테이너 이름 충돌로 중단됐다.
- Docker Desktop과 `evalops-postgres`, `evalops-redis`, `evalops-minio`의 실행을 확인했다.
- Migration은 `localhost:5432`를 대상으로 실행됐고 `evalops-postgres`는 host `5433`에 매핑돼 있었다.
- 두 endpoint가 일치하지 않아 실패 대상은 확인되지 않으며 정확한 연결 실패 원인은 `NOT_VERIFIED`다.
- Demo Seed, Backend, Frontend, CDP 측정은 완료되지 않았다.

추론:

- CSS token 선언값이 교체 전 literal과 같으므로 computed spacing 보존이 구현 목표다.
- 이 추론은 실제 Browser computed style과 visual 동일성의 증거가 아니므로 PASS 근거로 사용하지 않는다.

미검증:

- 모든 대상 selector의 computed margin·padding·gap
- 네 viewport의 실제 내부 크기와 device pixel ratio
- visual 동일성, wrapping, overflow, Console 오류, focus clipping
- 제외 literal의 실제 Browser 값

### 잔여 위험과 Phase 경계

- 올바른 PostgreSQL endpoint와 연결 조건이 확인되지 않으면 Demo Route 검증을 재현할 수 없다.
- Screenshot 또는 자동 Pixel Diff 증거가 없다.
- 실제 Browser 측정이 없으므로 Spacing Browser 검증을 완료로 처리할 수 없다.

```text
Spacing 구현 묶음 A: 완료
Spacing 구현 묶음 B: 완료
Spacing Browser 검증: NOT_VERIFIED_TOOL_LIMIT
Phase A3 전체: 미완료
Phase B: 미진행
```

다음 경계는 올바른 endpoint와 인증 설정이 확인된 PostgreSQL 및 공식 Demo Seed를 준비한 뒤, 동일 route와 네 viewport에서 headed Chrome computed style·visual·overflow·Console·focus 검증을 다시 수행하는 것이다.
