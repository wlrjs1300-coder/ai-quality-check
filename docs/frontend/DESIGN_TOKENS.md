# Frontend Design Token Contract

## 목적과 적용 원칙

이 문서는 후속 UI 구현에서 사용할 Design Token의 이름, 목표 값, 의미와 단계별 적용 경계를 정의합니다. Token이 선언됐다는 사실과 기존 Selector가 Token을 사용한다는 사실은 구분합니다.

- 기존 화면을 한 번에 바꾸지 않고 Phase A1, A2, A3의 작은 범위로 적용합니다.
- 값이 같다는 사실만으로 두 표현의 Semantic 의미가 같다고 판단하지 않습니다.
- 기존 Selector의 값을 Token으로 치환할 때 의도하지 않은 시각 변화가 없는지 별도로 확인합니다.
- 같은 상태의 의미를 화면마다 임의로 바꾸지 않습니다.
- 상태는 색상과 함께 텍스트, 아이콘 또는 설명으로 전달합니다.
- Light Mode를 우선하며 Dark Mode는 현재 Roadmap에서 제외합니다.
- 자동 시각 회귀가 없으므로 typecheck, lint, production build 통과는 시각 동일성의 증거가 아닙니다.

## 현재 구현 상태

현재 `globals.css`는 다음 12개의 축약형 CSS Custom Property를 사용합니다.

```css
--background
--surface
--surface-muted
--border
--text
--muted
--accent
--accent-dark
--danger
--danger-soft
--success
--success-soft
```

기존 Selector는 위 변수와 literal 값을 사용합니다. Phase A1에서 새 정식 Token을 선언하지만 기존 Selector에는 적용하지 않습니다.

- 기존 축약형 변수는 삭제하거나 이름을 변경하지 않습니다.
- 기존 축약형 변수와 새 정식 Token 사이의 Alias 전환도 Phase A1에서 하지 않습니다.
- 기존 Selector의 `var()` 참조, literal, 순서와 specificity를 유지합니다.
- 현재 실제 반응형 규칙은 `@media (max-width: 720px)` 하나입니다.
- 현재 `focus-visible`은 세 outline Token을 통해 `3px solid rgba(36, 87, 214, 0.3)`와 `2px` offset을 유지합니다.
- 현재 reduced motion 규칙은 loading marker의 animation을 제거합니다.

## 목표 Token 계약

아래 Token은 Phase A의 목표 계약입니다. Phase A1에서는 선언만 존재하며 기존 Selector에 적용된 상태가 아닙니다.

### Color와 Semantic Status Tokens

```css
:root {
  --color-bg: #f3f5f7;
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-text: #172033;
  --color-text-muted: #627087;
  --color-border: #d8dee7;
  --color-border-strong: #aeb8c7;
  --color-primary: #2457d6;
  --color-primary-hover: #1845b8;
  --color-success: #18794e;
  --color-success-surface: #eaf8f1;
  --color-warning: #875d00;
  --color-warning-surface: #fff7df;
  --color-danger: #b42318;
  --color-danger-surface: #fff1f0;
  --color-info: #2457d6;
  --color-info-surface: #eef4ff;
}
```

| Token | 의미 |
|---|---|
| `--color-bg` | 앱 전체 배경 |
| `--color-surface` | Card, Form, Panel 배경 |
| `--color-surface-muted` | 보조 Panel과 약한 구분 영역 |
| `--color-text` | 기본 본문과 제목 |
| `--color-text-muted` | 설명, 보조 정보, Metadata |
| `--color-border` | 기본 경계선 |
| `--color-border-strong` | 입력 필드와 강조 경계선 |
| `--color-primary` | 주요 Action과 Link |
| `--color-primary-hover` | 주요 Action hover |
| `--color-success` | 성공 상태 Text |
| `--color-success-surface` | 성공 상태 Surface |
| `--color-warning` | 주의 상태 Text의 목표 기본값 |
| `--color-warning-surface` | 주의 상태 Surface |
| `--color-danger` | 차단, 오류, 회귀 상태 Text |
| `--color-danger-surface` | 차단, 오류, 회귀 상태 Surface |
| `--color-info` | 갱신, 범위 확인, 안내 Text |
| `--color-info-surface` | 갱신, 범위 확인, 안내 Surface |

상태 의미 계약은 다음과 같습니다.

| 의미 | 상태 | 표현 원칙 |
|---|---|---|
| success | `PASS`, `COMPLETED`, `IMPROVED` | 성공 Text와 Surface를 함께 사용 |
| warning | `DRAFT`, `RUNNING`, `FAIL` | 주의 Text와 다음 행동을 함께 표시 |
| danger | `BLOCK`, `ERROR`, `FAILED`, `REGRESSED` | 원인과 복구 또는 검토 Action을 함께 표시 |
| neutral | `INACTIVE`, `UNCHANGED`, 데이터 없음 | 중립 Text와 약한 Surface 사용 |
| info | Refreshing, Scope 확인, 실행 안내 | 처리 중인 상태와 목적을 Text로 표시 |

개별 평가의 `FAIL`은 실행 자체의 `FAILED`와 구분합니다. `BLOCK`과 `REGRESSED`는 평균 수치보다 먼저 사용자가 인식할 수 있어야 합니다.

### Spacing Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 56px;
  --space-9: 80px;
}
```

작은 간격은 control 내부와 inline 요소에 사용하고, 큰 간격은 section과 page 구분에 사용합니다. 이 scale에 없는 현재 literal을 가장 가까운 값으로 바꾸지 않습니다.

### Radius Tokens

```css
:root {
  --radius-control: 8px;
  --radius-field: 7px;
  --radius-card: 12px;
  --radius-pill: 999px;
}
```

- `--radius-control`: Button과 8px radius를 사용하는 control
- `--radius-field`: Input, Textarea, Select form field
- `--radius-card`: 12px radius를 사용하는 Card, Form, Detail Panel
- `--radius-pill`: Badge와 상태 Label

현재 7px 또는 10px radius를 사용하는 Selector를 위 Token에 맞추기 위해 8px 또는 12px로 변경하지 않습니다.

#### Phase A3 Radius 계약

`RADIUS_CONTRACT.md`에서 실제 Selector와 Component 문맥을 조사해 후보 E인 의미별 일부 Token화와 예외 유지를 선택했습니다.

- `.button`의 `8px`는 `--radius-control`, 일반 Card·Panel의 `12px`는 `--radius-card`, Badge의 `999px`는 `--radius-pill`에 연결했습니다.
- `--radius-field: 7px`을 선언하고 `input, textarea, select`에 연결했습니다. Token 값은 기존 literal과 같으므로 목표 computed value는 `7px`으로 유지됩니다.
- `.form-error`, `.notice`, `.refreshing`, `.immutable-note`는 literal `7px`을 유지하고 `--radius-field`를 재사용하지 않습니다. 별도 message surface 계약 전까지 Token화하지 않습니다.
- `8px` non-control surface, `10px` Metric·Baseline Candidate, `50%` loading marker는 이번 후속 구현에서 제외하고 literal을 유지합니다.
- `10px` 두 selector는 별도 의미 계약 전까지 변경하거나 하나의 compact card Token으로 통합하지 않습니다.
- Token 이름 변경이나 `--radius-panel` alias 추가는 이번 범위에서 하지 않습니다.
- Radius Token CSS 적용은 완료했으며 Browser computed style과 시각적 동일성은 아직 `NOT_VERIFIED`입니다.

### Shadow와 Focus Tokens

```css
:root {
  --shadow-panel: 0 8px 24px rgba(23, 32, 51, 0.05);
  --shadow-focus: 0 0 0 3px rgba(36, 87, 214, 0.3);
  --focus-ring-color: rgba(36, 87, 214, 0.3);
  --focus-outline-width: 3px;
  --focus-outline-offset: 2px;
}
```

#### Phase A3 Focus 계약

Primary Focus Indicator는 `outline`입니다. 기존 `:focus-visible` 동작과 computed style을 보존하면서 다음처럼 세 outline Token을 연결했습니다.

```css
outline: var(--focus-outline-width) solid var(--focus-ring-color);
outline-offset: var(--focus-outline-offset);
```

- `--focus-ring-color`는 primary outline 색상입니다. 현재 literal과 같은 `rgba(36, 87, 214, 0.3)`을 유지합니다.
- `--focus-outline-width`는 primary outline 두께입니다. 현재 literal과 같은 `3px`을 유지합니다.
- `--focus-outline-offset`은 element 경계와 outline 사이 간격입니다. 현재 literal과 같은 `2px`을 유지합니다.
- `--shadow-focus`는 outline 대체재가 아닌 선택적 보조 효과 후보입니다. 적용하면 기존 렌더링이 바뀌므로 이번 계약의 사용처에 포함하지 않으며 미적용 상태를 유지합니다.
- `var()` fallback은 추가하지 않습니다. 네 Token은 `:root`의 필수 선언이며 이번 구현에서 undefined 참조가 없음을 확인했습니다. 후속 변경에서도 같은 검사를 유지합니다.

현재 공통 Selector는 `button`, `a`, `input`, `textarea`, `select`, `summary`의 `:focus-visible`에 적용됩니다. checkbox와 radio는 native `input`으로 같은 계약에 포함됩니다. Pagination, form submit, retry, text button과 Button 형태의 Link도 각각 native `button` 또는 `a`를 사용하므로 포함됩니다. 비네이티브 `role="button"`, 명시적 `tabIndex`, `aria-disabled` 사용처는 현재 없습니다.

Native `summary`의 Chrome 기본 `1px auto` outline과 공통 Token outline을 비교한 결과, 네 viewport의 open·closed details에서 marker 정렬, border·shadow, overflow와 clipping 충돌이 없고 keyboard 표시가 더 명확했습니다. 따라서 `summary:focus-visible`을 공통 Selector 끝에 포함했습니다. 미래에 `role="button"`, 양수 또는 0인 `tabIndex`, `aria-disabled="true"`를 도입할 때는 native 요소와 동일하다고 가정하지 않고 별도 keyboard·activation 계약을 먼저 정의합니다.

Native `disabled` control과 disabled fieldset 하위 control은 Tab 순서와 primary Focus 계약에서 제외합니다. 이번 Browser 검증에서 Loading 중 native disabled로 전환되는 control의 focus가 `body`로 이동할 수 있음을 확인했으며, Focus 복원 정책은 후속 UX 계약 대상으로 남깁니다. 향후 `aria-disabled`를 사용하면 focus를 유지할 수 있으므로 activation 차단과 안내 Text를 별도 계약으로 다룹니다.

`:focus-visible`을 유지하고 일반 `:focus` 규칙은 추가하지 않습니다. Keyboard navigation에는 primary outline을 표시하고 일반적인 mouse click에는 강제로 표시하지 않습니다. Focus Indicator는 정적 신호이므로 reduced-motion에서 제거하지 않으며 현재 Focus 규칙에는 transition이나 animation이 없습니다.

2026-07-27 headed Chrome에서 `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail을 1440px, 1024px, 768px, 390px로 적용 전후 조사했습니다. button, link, input, textarea, select, checkbox, radio와 `summary`는 keyboard focus에서 `3px solid rgba(36, 87, 214, 0.3)`와 `2px` offset을 사용했고 box-shadow는 변하지 않았습니다. Native disabled와 disabled fieldset 하위 control은 Tab 순서에서 제외됐고, reduced-motion에서도 정적 outline은 유지됐습니다. Loading 중 control이 disabled로 바뀔 때 focus가 `body`로 이동하는 기존 동작은 이번 CSS 범위에서 복원하지 않고 후속 UX 위험으로 남깁니다. Shift+Tab 복귀, `summary`의 Space 토글, 일반 mouse click 시 강제 outline 미표시, ring 잘림 없음과 Console 오류 없음도 확인했습니다. CDP 환경에서 Button·Link의 Enter/Space activation은 재현하지 못해 `NOT_VERIFIED_TOOL_LIMIT`이며, forced-colors와 focus contrast ratio는 테스트하지 않았습니다. 이 결과는 접근성 기준을 고려한 명시적 Focus 표시를 확인한 것이며 WCAG 준수를 의미하지 않습니다.

### Typography와 Line Height Tokens

```css
:root {
  --font-size-xs: 0.78rem;
  --font-size-sm: 0.9rem;
  --font-size-body: 1rem;
  --font-size-lead: 1.125rem;
  --font-size-heading-sm: 1.2rem;
  --font-size-heading-md: 1.25rem;
  --font-size-heading-lg: 2rem;

  --line-height-compact: 1.25;
  --line-height-body: 1.5;
  --line-height-relaxed: 1.65;
}
```

큰 화면 제목의 반응형 `clamp()`는 유지할 수 있습니다. 현재 `1.6` line-height를 `1.5` 또는 `1.65`로 변경하지 않습니다.

### Layout과 Control Height Tokens

```css
:root {
  --container-width: 1120px;
  --control-height: 44px;
}
```

- `--container-width`: 기본 앱 본문 최대 너비의 목표 계약
- `--control-height`: 기본 Button과 주요 Form control의 최소 높이 목표 계약
- compact button의 현재 `36px` 높이는 기본 `44px` control과 별도로 유지합니다.

### Breakpoint 목표 계약

| 이름 | 값 | 기본 목적 | 현재 적용 상태 |
|---|---:|---|---|
| small | 480px | 좁은 Mobile 화면 | 미적용 |
| medium | 768px | Tablet과 다단 Layout 전환 | 미적용 |
| large | 1024px | 넓은 Desktop Layout | 미적용 |

480px, 768px, 1024px은 목표 계약이며 현재 구현 완료 상태가 아닙니다. 실제 CSS는 `max-width: 720px`만 사용합니다. CSS Custom Property는 일반적인 media query 조건에 직접 사용할 수 없으므로 breakpoint는 문서 계약으로 관리하고 `@media` 조건에는 결정된 값을 직접 기록합니다.

필수 수동 검토 폭은 1440px, 1024px, 768px, 390px입니다.

## Phase A1 적용 범위

- 문서의 목표 Token 계약과 실제 CSS 현황을 구분합니다.
- 현재 CSS에서 확인된 값과 목표 계약값을 새 정식 Token으로 선언하되, 기존 Selector에서는 사용하지 않습니다.
- 새 Token은 선언만 하며 기존 Selector에서 참조하지 않습니다.
- 기존 축약형 변수, literal, media query, focus-visible, reduced motion을 유지합니다.
- 시각 결과를 바꾸지 않는 것이 설계 목표입니다.
- 정적 검증 결과를 시각 동일성 검증 완료로 표현하지 않습니다.

## Phase A2 이후 적용 범위

### Phase A2

정확한 값과 Semantic 의미가 모두 일치하는 저위험 Selector만 작은 묶음으로 Token에 연결합니다.

2026-07-27에 첫 저위험 묶음을 다음 Selector에 적용했습니다.

| Token | 적용 Selector와 속성 |
|---|---|
| `--container-width` | `.app-shell`의 기본·mobile `width` |
| `--control-height` | `.button`의 `min-height` |
| `--shadow-panel` | `.form-panel`, `.state-panel`, `.detail-panel`, `.coming-next`의 `box-shadow` |
| `--font-size-xs` | `.eyebrow`, `.slug`, `.status-badge`의 `font-size` |
| `--font-size-sm` | `.count-label`의 `font-size` |
| `--font-size-heading-sm` | `h3`의 `font-size` |
| `--font-size-heading-md` | `h2`의 `font-size` |
| `--line-height-relaxed` | `.page-description`, `.card-description`, `.state-panel p`, `.coming-next p`의 `line-height` |

Chrome Headless의 `/projects`에서 1440px, 1024px, 768px, 390px 적용 전후 computed style을 비교해 container width, 기본·compact Button 높이, panel shadow, font-size와 line-height가 같음을 확인했습니다. hover, focus-visible, disabled 상태와 가로 overflow도 같은 범위에서 확인했습니다.

2026-07-27에는 같은 네 viewport와 공개 Demo Seed를 사용해 headed Chrome에서 `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail을 육안 검증했습니다. Container 여백, Button 상태와 정렬, form·state·detail Panel, Typography, Badge, 긴 UUID, 모바일 단일 열과 줄바꿈에서 이상이나 가로 overflow가 없었고 Console 오류도 없었습니다. Screenshot은 작업 중 임시 증빙으로만 사용하고 저장소에는 포함하지 않았으며 자동 Pixel Diff는 수행하지 않았습니다.

Demo Seed에 없는 Empty 상태와 정상 실행 환경의 Error·Loading 상태는 이번 육안 검증 범위에 포함하지 않았습니다. 우선 Route에 `.coming-next`가 없어 해당 Panel은 `NOT_PRESENT`이며, Selector 그룹의 동일 computed style은 앞선 비교 결과를 근거로 유지합니다. 이 제한을 제외한 Phase A2 저위험 Token 적용과 Browser 검증은 완료했습니다.

위 표에 없는 Color, Spacing, Radius 등 선언은 아직 기존 Selector에 적용되지 않았습니다.

### Phase A3

계약 판단이 필요한 항목을 별도로 다룹니다.

- neutral Text와 Surface
- danger border와 divider
- focus outline과 shadow Token의 관계 — 계약 및 CSS 적용 완료
- 7px과 10px radius
- 문서 scale에 없는 spacing
- 1.6 line-height
- 현재 720px breakpoint의 변경 여부
- 같은 색상을 사용하지만 의미가 다른 표현의 통합 여부

Phase B의 공통 Navigation과 State Component 작업은 Phase A에 포함하지 않습니다.

## 현재 구현에만 존재하는 미포괄 값

아래 값은 실제 CSS에 존재하지만 현재 목표 Token scale만으로 안전하게 표현할 수 없습니다.

| 범주 | 현재 값 | 대표 의미 | 처리 |
|---|---|---|---|
| Radius | 7px | Input, Form Error, Notice | Phase A3 계약에 따라 값 유지, 의미별 Token 분리 |
| Radius | 10px | Metric Card, Baseline Candidate | Phase A3 계약에 따라 값 유지, 단일 Token 통합 보류 |
| Line Height | 1.6 | Summary Copy | Phase A3 판단 전 유지 |
| Spacing | 18px, 20px, 22px, 28px 등 | Gap, Padding, Margin | 가장 가까운 scale로 변경하지 않음 |
| Control Height | 36px | Compact Pagination Button | 기본 44px과 별도로 유지 |
| Neutral Surface | `#eef0f3` | Inactive, Neutral, Immutable Note | Phase A3에서 의미 분리 검토 |
| Neutral Text | `#596579` | Inactive, Neutral, Immutable Note | Phase A3에서 의미 분리 검토 |
| Divider | `#edf0f4` | Metadata와 List 경계 | Phase A3에서 계약 여부 검토 |
| Danger Border | `#f0b8b3` | Error Panel 경계 | Phase A3에서 계약 여부 검토 |
| Warning Text | `#694b00` | Warning List Text | 기본 warning Text와 의미 차이 검토 |
| Selection Shadow | `0 0 0 2px rgba(36, 87, 214, 0.12)` | 선택된 Baseline 강조 | Phase A3 이후 검토 |

`#fff7df` warning surface가 여러 Selector에서 같더라도 warning Text는 `#875d00`과 `#694b00`으로 다릅니다. 값이 같다는 것과 Semantic 의미가 같다는 것은 별개이므로, 동일 색상 또는 인접 값을 근거로 자동 통합하지 않습니다.

## Token 치환 시 금지되는 임의 정규화

- 7px과 10px radius를 8px 또는 12px로 변경하지 않습니다.
- 1.6 line-height를 1.5 또는 1.65로 변경하지 않습니다.
- 18px, 20px, 22px, 28px 등의 spacing을 가장 가까운 scale 값으로 변경하지 않습니다.
- compact button 36px을 기본 control height 44px로 변경하지 않습니다.
- 현재 720px breakpoint를 768px 또는 다른 목표 breakpoint로 자동 변경하지 않습니다.
- 색상값이 같다는 이유만으로 서로 다른 상태 의미를 하나의 Token 사용처로 통합하지 않습니다.
- focus-visible의 outline 구조를 shadow-only 표현으로 변경하지 않습니다.
- 기존 축약형 변수와 새 정식 Token 사이 Alias를 검증 없이 추가하지 않습니다.

## 접근성과 검증 원칙

- Text와 Surface 조합은 실제 적용 시 WCAG contrast를 검증합니다.
- 키보드 focus를 숨기지 않고 현재 outline 구조를 유지합니다.
- 기존 reduced motion 대응을 유지합니다.
- 상태 Badge에는 사람이 읽을 수 있는 상태 Text를 포함합니다.
- 색상만으로 성공, 실패, 차단, 회귀를 구분하지 않습니다.
- Disabled control에는 가능한 경우 주변 Text로 이유를 제공합니다.
- 상태 갱신은 필요한 위치에서 `aria-live`를 사용합니다.
- Light Mode를 먼저 안정화하며 Dark Mode는 현재 범위에 포함하지 않습니다.
- typecheck, lint, production build는 정적 건전성을 확인하지만 시각 동일성을 증명하지 않습니다.
