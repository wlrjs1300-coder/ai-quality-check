# Phase A3 Remaining Contracts

## 1. 조사 목적

이 문서는 Phase A3에 남은 Neutral Text·Surface, Danger Border·Divider, 동일 색상의 역할별 통합, 현재 `720px` breakpoint 계약을 실제 Frontend 코드 기준으로 확정한다. 이번 작업은 문서 계약만 다루며 CSS, TSX, Dependency와 Build 설정은 변경하지 않는다.

## 2. 기준 commit

- 조사 날짜: `2026-07-29`
- 기준 commit: `62a395c`
- 제품 코드 변경: `NO_CODE_CHANGE`

## 3. 조사 범위

- `apps/web/src/app/globals.css`
- `apps/web/src/**/*.tsx`
- `docs/frontend/DESIGN_TOKENS.md`
- `docs/frontend/UI_UX_ROADMAP.md`
- Radius·Spacing·Line-height·Focus 관련 기존 계약

별도 `COLOR_CONTRACT.md`, `SURFACE_CONTRACT.md`, `BREAKPOINT_CONTRACT.md`, `RESPONSIVE_CONTRACT.md`는 `NOT_PRESENT`다. 제품 스타일은 `globals.css` 한 파일에 있고 CSS Module, styled component, TSX inline style, JavaScript viewport 분기, `matchMedia`, Container Query는 `NOT_PRESENT`다.

## 4. 현재 Token 현황

| 역할 | 기존 이름 | 값 | 현재 상태 |
|---|---|---:|---|
| Page background | `--background`, `--color-bg` | `#f3f5f7` | legacy 이름은 사용 중, design 이름은 미연결 |
| Surface | `--surface`, `--color-surface` | `#ffffff` | legacy 이름은 사용 중, design 이름은 미연결 |
| Muted surface | `--surface-muted`, `--color-surface-muted` | `#f8fafc` | legacy 이름은 사용 중, design 이름은 미연결 |
| Primary text | `--text`, `--color-text` | `#172033` | legacy 이름은 사용 중, design 이름은 미연결 |
| Muted text | `--muted`, `--color-text-muted` | `#627087` | legacy 이름은 사용 중, design 이름은 미연결 |
| Border | `--border`, `--color-border` | `#d8dee7` | legacy 이름은 사용 중, design 이름은 미연결 |
| Strong field border | `--color-border-strong` | `#aeb8c7` | design 이름은 선언됐지만 field는 literal |
| Danger text | `--danger`, `--color-danger` | `#b42318` | legacy 이름은 사용 중, design 이름은 미연결 |
| Danger surface | `--danger-soft`, `--color-danger-surface` | `#fff1f0` | legacy 이름은 사용 중, design 이름은 미연결 |

같은 값의 legacy 이름과 design 이름을 한 번에 전환하는 작업은 이 계약의 최소 구현 범위가 아니다. 역할이 확인된 작은 selector 묶음만 후속 구현 대상으로 삼는다.

## 5. Neutral Text 사용 현황

| Selector | 현재 값 | 역할 | 배경 문맥 | 계약 |
|---|---:|---|---|---|
| `body`, `label`, form control | `#172033` | 기본 본문·Label·입력 Text | Page·white field | `KEEP_EXISTING_TOKEN` |
| `.page-description`, `.card-description`, `.muted`, `.empty-inline` | `#627087` | 설명·보조·Empty Text | Page·Card | `KEEP_EXISTING_TOKEN` |
| `.count-label`, `dt`, metric 보조 Text | `#627087` | Metadata·count | Card·Panel | `KEEP_EXISTING_TOKEN` |
| `.breadcrumb` | `#627087` | Navigation context | Page | `KEEP_EXISTING_TOKEN` |
| `.status-inactive` | `#596579` | 비활성 상태 Text | `#eef0f3` | 상태 Token 추가 대상 |
| `.semantic-neutral` | `#596579` | 중립 판정 Text | `#eef0f3` | 상태 Token 추가 대상 |
| `.immutable-note` | `#596579` | 변경 불가 안내 Text | `#eef0f3` | `KEEP_LITERAL` |
| `.snapshot-value` | `#f8fafc` | Dark code foreground | `#111827` | `KEEP_LITERAL` |

기본 Text와 muted Text는 값과 역할이 각각 일치하므로 기존 Token 경계를 유지한다. `#596579`는 세 selector에서 같지만 상태 Badge와 immutable guidance는 역할이 다르다.

## 6. Neutral Text 최종 계약

- `.status-inactive`와 `.semantic-neutral`은 중립 상태라는 역할이 같아 신규 상태 Text Token으로 통합한다.
- 계약 이름은 `--color-neutral-state-text`이며 값은 `#596579`다.
- `.immutable-note`는 guidance 역할이므로 상태 Text Token을 재사용하지 않고 현재 literal을 유지한다.
- `--muted`와 `--color-text-muted`의 `#627087` 범위에 `#596579` 사용처를 합치지 않는다.
- Code foreground, primary Text, muted Text와 disabled/native opacity는 중립 상태 Token에 포함하지 않는다.

판정: `ADD_SEMANTIC_TOKEN`, `DO_NOT_UNIFY`, `NO_VALUE_CHANGE`

## 7. Neutral Surface 사용 현황

| Selector | 현재 값 | Border·Text 조합 | 역할 | 계약 |
|---|---:|---|---|---|
| `body` | `#f3f5f7` | 기본 Text | Page canvas | `KEEP_EXISTING_TOKEN` |
| 일반 Card·Panel | `#ffffff` | `#d8dee7`, 기본 Text | Content surface | `KEEP_EXISTING_TOKEN` |
| `input`, `textarea`, `select` | `white` | `#aeb8c7`, 기본 Text | Editable field | `KEEP_LITERAL` |
| `.baseline-candidate` | `#f8fafc` | 일반 border, muted Text | Interactive muted surface | `KEEP_EXISTING_TOKEN` |
| `.status-inactive` | `#eef0f3` | `#596579` | 비활성 상태 | 상태 Token 추가 대상 |
| `.semantic-neutral` | `#eef0f3` | `#596579` | 중립 판정 | 상태 Token 추가 대상 |
| `.immutable-note` | `#eef0f3` | `#596579` | Immutable guidance | `KEEP_LITERAL` |
| `.snapshot-value` | `#111827` | `#f8fafc` | Code surface | `KEEP_LITERAL` |
| `.text-button` | `transparent` | accent Text | 투명 interactive surface | `KEEP_LITERAL` |

White Card surface와 white Input surface는 물리 색상이 같아도 container와 editable field 역할이 다르다. `#f8fafc`도 muted interactive surface와 code foreground라는 서로 다른 역할에 사용되므로 하나의 semantic 역할로 합치지 않는다.

## 8. Neutral Surface 최종 계약

- `.status-inactive`와 `.semantic-neutral`은 신규 상태 Surface Token으로 통합한다.
- 계약 이름은 `--color-neutral-state-surface`이며 값은 `#eef0f3`다.
- `.immutable-note`는 같은 물리 색상을 유지하되 guidance 역할이므로 literal을 유지한다.
- Page, Card, field, muted interactive, code와 transparent surface는 기존 경계를 유지한다.

판정: `ADD_SEMANTIC_TOKEN`, `DO_NOT_UNIFY`, `NO_VALUE_CHANGE`

## 9. Danger Text·Surface·Border 사용 현황

### Danger Text

| Selector | 값 | 역할 | 계약 |
|---|---:|---|---|
| `.field-error`, `.form-error`, `.metadata-error` | `#b42318` | Validation·error Text | `KEEP_EXISTING_TOKEN` |
| `.semantic-negative` | `#b42318` | Negative status Text | `KEEP_EXISTING_TOKEN` |
| `.button-danger` | `#b42318` | Destructive Action Text | 역할 분리 유지 |
| `.download-error` | `#b42318` | Download failure Text | `KEEP_EXISTING_TOKEN` |

### Danger Surface

| Selector | 값 | 역할 | 계약 |
|---|---:|---|---|
| `.form-error`, `.semantic-negative` | `#fff1f0` | Error·negative state surface | `KEEP_EXISTING_TOKEN` |
| `.state-panel-error`, `.download-error` | `#fff1f0` | Error container surface | `KEEP_EXISTING_TOKEN` |
| `.button-danger:hover` | `#fff1f0` | Destructive hover surface | interactive 역할 분리 유지 |

### Danger Border

| Selector | 값 | 역할 | 계약 |
|---|---:|---|---|
| `.state-panel-error` | `#f0b8b3` | Error Panel boundary | 신규 soft danger border 대상 |
| `.download-error` | `#f0b8b3` | Download Error boundary | 신규 soft danger border 대상 |
| invalid field | `#b42318` | Validation field 강조 | soft border와 통합 금지 |
| `.button-danger` | `#b42318` | Destructive interactive boundary | soft border와 통합 금지 |

Danger Text, Surface와 Border는 서로 다른 UI 역할이다. 같은 `#b42318`을 사용해도 Text, invalid field, destructive Action을 하나의 신규 Token으로 재정의하지 않는다.

## 10. Danger 최종 계약

- 기존 danger Text와 Surface Token 역할을 유지한다.
- `.state-panel-error`와 `.download-error`의 정확히 같은 error container boundary만 신규 Border Token으로 묶는다.
- 계약 이름은 `--color-danger-border`이며 값은 `#f0b8b3`다.
- Invalid field와 destructive Button border는 strong semantic 강조이므로 신규 soft danger border를 사용하지 않는다.

판정: `ADD_SEMANTIC_TOKEN`, `DO_NOT_UNIFY`, `NO_VALUE_CHANGE`

## 11. Divider 사용 현황

| Selector | 방향·두께 | 값 | 역할 |
|---|---|---:|---|
| `.card-meta div`, `.detail-list div` | top `1px` | `#edf0f4` | Metadata row separator |
| `.compact-list div`, `.trend-values div` | top `1px` | `#edf0f4` | Compact list row separator |
| `.card-link` | top `1px` | `#d8dee7` | Card content와 Action 경계 |
| `.version-picker + .version-picker` | top `1px` | `#d8dee7` | Form group 경계 |

Table, Header, Sidebar, Breadcrumb 전용 divider는 `NOT_PRESENT`다. `#edf0f4`는 약한 row separator이고 일반 border `#d8dee7`, strong field border `#aeb8c7`, danger border와 역할이 다르다.

## 12. Divider 최종 계약

- Metadata·compact list의 `#edf0f4` 두 선언을 신규 Divider Token으로 통합한다.
- 계약 이름은 `--color-divider`이며 값은 `#edf0f4`다.
- Card Action과 Form group의 `#d8dee7` 경계는 일반 border 역할을 유지한다.
- Divider를 control border, field border 또는 danger border와 통합하지 않는다.

판정: `ADD_SEMANTIC_TOKEN`, `DO_NOT_UNIFY`, `NO_VALUE_CHANGE`

## 13. 동일 색상 역할 그룹

| 물리 값 | 현재 역할 | 최종 계약 |
|---:|---|---|
| `#2457d6` | Primary, info Text, accent link·control | 역할별 `--color-primary`, `--color-info` 유지; 물리 Token 하나로 통합 금지 |
| `#eef0f3` / `#596579` | Neutral state, immutable guidance | 상태 selector만 통합하고 guidance는 literal 유지 |
| `#fff7df` | Pending Badge, warning list surface | 기존 warning Surface Token 연결 가능; Text `#875d00`과 `#694b00`은 통합 금지 |
| `#eef4ff` | Refreshing info surface | 기존 info Surface Token 연결 가능 |
| `#ffffff` / `white` | Card surface, Input surface, Button foreground | 역할이 달라 단일 semantic Token으로 통합 금지 |
| `#f8fafc` | Muted interactive surface, code foreground | Surface와 Text 역할 통합 금지 |
| `#b42318` | Danger Text, validation border, destructive border | 역할별 사용 유지; soft danger border와 통합 금지 |
| `rgba(36, 87, 214, 0.3)` | Focus outline, 미사용 shadow 선언 | Focus 계약 유지; primary color와 통합 금지 |

최종 선택은 **B. 역할별 Semantic Token을 유지하되 같은 값 참조**와 **D. 일부만 통합**의 조합이다. 물리 색상 하나로 전체를 통합하지 않는다.

판정: `DO_NOT_UNIFY`

## 14. 720px breakpoint 사용 현황

- Layout media query는 `@media (max-width: 720px)` 한 개다.
- 별도 `prefers-reduced-motion` query는 Layout width 경계가 아니다.
- 768px, 1024px, 480px width media query는 제품 CSS에 `NOT_PRESENT`다.
- TSX viewport 분기, `matchMedia`, Container Query도 `NOT_PRESENT`다.
- 720px 이하에서 app gutter와 top padding, Header 방향, Form·Project·Metric·Overview·History·Summary·Filter·Dataset·Case·Version·Registry Grid, State Panel, metadata rows, warning item과 pagination이 단일 열 또는 세로 방향으로 바뀐다.
- 기존 28개 Browser 조합은 768px과 390px에서 overflow·overlap·text clipping·focus clipping 0건과 responsive wrapping을 확인했다.
- 이 근거만으로 721px부터 719px 사이의 실제 경계를 검증했다고 단정하지 않는다.

## 15. 720px 후보 비교

| 후보 | 장점 | 위험 | 판정 |
|---|---|---|---|
| A. `720px` 유지 | 현재 동작과 검증 근거 보존 | 경계 3개 폭 추가 검증 필요 | 채택 |
| B. `768px`로 변경 | 목표 문서의 medium과 숫자 일치 | 721~768px Layout을 근거 없이 변경 | 제외 |
| C. 역할별 breakpoint 분리 | 세밀한 Layout 제어 | 현재 selector·측정 근거 부족 | `DEFERRED` |
| D. 신규 Token 선언 후 값 유지 | 이름 제공 | 일반 media query에서 Custom Property 사용 불가 | 제외 |
| E. Custom Media 도입 | 명명 가능 | Dependency·Build 설정 필요 | 범위 제외 |
| F. 결정 불가 | 변경 회피 | 현재 동작 계약을 명시하지 못함 | 제외 |

## 16. 720px 최종 계약

- 현재 literal `720px`을 유지한다: `KEEP_720PX`.
- media query 값과 selector 구조를 변경하지 않는다.
- 일반 CSS media query 조건에 `var()`를 사용하지 않는다.
- Breakpoint Custom Property, Custom Media, PostCSS 설정과 TS 상수를 추가하지 않는다: `NO_BREAKPOINT_TOKEN`.
- 768px로 변경하거나 역할별 경계를 분리하는 작업은 실제 붕괴 근거가 생길 때까지 `DEFERRED`다.

판정: `KEEP_LITERAL`, `NO_CODE_CHANGE`

## 17. 후속 구현 최소 범위

후속 CSS 구현은 다음 한 묶음으로 제한한다.

| 항목 | 최소 변경 |
|---|---|
| 신규 Token | 4개: neutral state Text·Surface, danger border, divider |
| Neutral selector | `.status-inactive`, `.semantic-neutral`의 color·background 4개 선언 치환 |
| Danger selector | `.state-panel-error`, `.download-error`의 border color 2개 선언 치환 |
| Divider selector | Metadata/detail row와 compact/trend row의 border-top 2개 선언 치환 |
| 기존 Token 연결 후보 | warning surface 2곳과 refreshing info surface 1곳은 별도 저위험 묶음으로 분리 가능 |
| 값 변경 | `NO_VALUE_CHANGE` |
| Selector 구조 변경 | 없음 |
| Media query 변경 | 없음 |
| Layout 변경 | 없음 |

Legacy 이름 전체를 design 이름으로 교체하는 대규모 migration은 이 최소 범위에 포함하지 않는다.

## 18. 구현 제외 범위

- `.immutable-note`를 neutral state Token에 연결
- Primary·info·focus의 같은 계열 색상 통합
- Warning Text `#875d00`과 `#694b00` 통합
- Card·Input·Button의 white 역할 통합
- Danger Text·Surface·Border 통합
- Divider와 control·field border 통합
- `720px` 값 변경 또는 breakpoint 분리
- Custom Media, PostCSS, Dependency, Build 설정
- Dark Mode, Branding, 공통 Component와 Phase B 구현
- WCAG 준수 단정

## 19. Browser 검증 계획

후속 CSS 구현 후 같은 7개 우선 Route에서 다음을 확인한다.

- `1440×900`, `1024×900`, `768×900`, `390×900`: neutral state, immutable guidance, error container, divider computed color와 현재 Layout
- `721×900`, `720×900`, `719×900`: media query 경계 전후 Grid column, Header·State Panel 방향, metadata row, pagination과 gutter
- 상태 데이터: inactive·neutral Badge, immutable note, form error, state panel error, download error
- computed `color`, `background-color`, `border-color`, horizontal overflow, overlap, text clipping, focus clipping와 Console

적용 전 Browser baseline은 없고 자동 Pixel Diff도 없으므로 현재 상태 검증과 적용 전후 동일성은 구분한다.

## 20. 위험과 미검증

- `721px`, `720px`, `719px` 경계는 `NOT_VERIFIED`다.
- Danger·neutral의 모든 runtime 상태를 한 세션에서 렌더링한 근거는 `INCOMPLETE`다.
- Color contrast ratio와 forced-colors는 `NOT_VERIFIED`이며 WCAG 준수를 의미하지 않는다.
- 신규 Token 적용 전이므로 후속 computed style은 `NOT_VERIFIED`다.
- 역할이 다른 동일 값의 향후 변경 시 semantic Token과 literal이 서로 다른 값으로 분기될 수 있다.

## 21. Phase 상태와 최종 판정

- 네 남은 계약 조사·결정: `COMPLETE`
- 실제 CSS 구현: `INCOMPLETE`
- Browser 경계 검증: `NOT_VERIFIED`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`
- 최종 판정: 계약은 `STATICALLY_VERIFIED`, 제품 변경은 `NO_CODE_CHANGE`

## 22. Semantic Color Token Browser Runtime 검증 결과 (2026-07-29)

### 22.1 환경과 데이터 준비

- 기준 commit: `84364d9`
- Browser: 공식 Google Chrome `150.0.7871.187`, headed, CDP Protocol `1.3`
- CDP: `127.0.0.1:9222`, WMI `Win32_Process.Create`, 고유 `user-data-dir` 사용
- Backend health: `HTTP 200`
- Migration: `20260721170000 (head)`
- 공식 Demo Seed: 동일 `evalops_local` Database에서 2회 모두 `already_seeded`, 종료 코드 `0`
- Row count: Evaluation Case 전체 `6`, Seed 전용 `5`, 일반 DRAFT `1`, Snapshot `5`
- 기존 `3001`: HTML Route는 `HTTP 200`이었으나 Chrome에서 Next.js chunk `404`와 canceled Fetch가 재현되어 최종 측정에서 제외
- 최종 origin: 저장소 밖 임시 same-origin proxy `http://127.0.0.1:3002` (`/api/v1`은 Backend `8000`, UI는 임시 Frontend `3003`으로 전달)
- 제품 파일, `package.json`, Next 설정과 Dependency 변경: 없음

### 22.2 Route와 viewport

다음 7개 Route를 `1440×900`, `1024×900`, `768×900`, `390×900`, `721×900`, `720×900`, `719×900`에서 측정해 총 `49`개 조합을 확인했다.

1. Projects
2. Project Overview
3. Dataset Detail
4. Experiment Create
5. Experiment Detail
6. History
7. Comparison Detail

49개 조합은 모두 Document `HTTP 200`, 예상 URL navigation 성공과 핵심 UI 렌더링을 확인했다. `390px`에서는 scrollbar가 있는 Route의 실제 `clientWidth`가 `375px`였고, 나머지 경계 폭에서도 scrollbar가 있는 Route는 요청 폭보다 `15px` 작은 실제 `clientWidth`를 기록했다.

### 22.3 Semantic Color computed style

| Selector | Runtime 상태 | 측정값 | 판정 |
|---|---|---|---|
| `.status-inactive` | 7개 Route에서 렌더링되지 않음 | 없음 | `NOT_VERIFIED_STATE_NOT_RENDERED` |
| `.semantic-neutral` | Project Overview, Experiment Detail, History, Comparison Detail에서 28개 조합 측정 | `color: rgb(89, 101, 121)`, `background-color: rgb(238, 240, 243)` | `VERIFIED_CURRENT_STATE` |
| `.immutable-note` | Dataset Detail, Experiment Detail에서 14개 조합 측정 | `color: rgb(89, 101, 121)`, `background-color: rgb(238, 240, 243)` | 기존 literal 유지 확인; 신규 Neutral State Token 대상 아님 |
| `.state-panel-error` | 정상 Demo 상태에서 렌더링되지 않음 | 없음 | `NOT_VERIFIED_STATE_NOT_RENDERED` |
| `.download-error` | 정상 Demo 상태에서 렌더링되지 않음 | 없음 | `NOT_VERIFIED_STATE_NOT_RENDERED` |
| `.card-meta div` | Projects 7개 조합 | `border-top: 1px solid rgb(237, 240, 244)` | `VERIFIED_CURRENT_STATE` |
| `.detail-list div` | Experiment Detail, Comparison Detail 14개 조합 | `border-top: 1px solid rgb(237, 240, 244)` | `VERIFIED_CURRENT_STATE` |
| `.compact-list div` | 4개 Route 28개 조합 | `border-top: 1px solid rgb(237, 240, 244)` | `VERIFIED_CURRENT_STATE` |
| `.trend-values div` | Project Overview 7개 조합 | `border-top: 1px solid rgb(237, 240, 244)` | `VERIFIED_CURRENT_STATE` |

Neutral Runtime 전체는 `.semantic-neutral`만 실제 측정됐으므로 `PARTIALLY_VERIFIED_STATE_NOT_RENDERED`다. Danger Runtime은 두 대상 모두 렌더링되지 않아 `NOT_VERIFIED_STATE_NOT_RENDERED`다. Divider Runtime은 네 selector가 모두 실제 Route에서 기대값과 일치해 `VERIFIED_CURRENT_STATE`다. Color contrast와 WCAG 준수는 측정하지 않아 `NOT_VERIFIED`다.

### 22.4 `720px` 경계

- `721×900`: media query 미적용. App top padding `56px`, Header `row`, Project·Form·Overview·History·Summary Grid는 해당 Route에서 다열, metadata row는 `120px + content`, pagination은 `row`였다.
- `720×900`: media query 적용. App top padding `32px`, Header `column`, 대상 Grid와 metadata row는 단일 열, pagination은 `column`이었다.
- `719×900`: `720px`과 동일하게 media query가 적용됐다.
- 경계 판정: `KEEP_720PX`, `VERIFIED_CURRENT_STATE`.
- 49개 조합에서 document horizontal overflow, 조사 대상 구조의 비정상 overlap과 text clipping은 `0`건이었다.
- Focus outline 자체를 순회하며 캡처한 검증은 아니므로 focus outline clipping은 `NOT_VERIFIED_METHOD_LIMIT`다.

### 22.5 Console, Network와 증거 제한

- Console Error: `0`
- Runtime exception: `0`
- React hydration 오류: `0`
- Failed application API request: `0`
- Resource `404`: `favicon.ico` 1종 재현
- Route 전환 중 canceled Fetch: `35`; 모두 `net::ERR_ABORTED`, `canceled=true`로 navigation 취소와 구분
- Next.js dev `nextjs-portal` host는 49개 조합에 존재했으나 visible error overlay 여부를 별도로 캡처하지 않았으므로 `NOT_VERIFIED_VISIBLE_STATE`다. Console·exception·API 실패 근거는 없었다.
- 적용 전 Browser baseline: `BASELINE_NOT_CAPTURED`
- 자동 Pixel Diff: `NOT_PRESENT`
- `PIXEL_IDENTICAL`, `NO_VISUAL_CHANGE`, `VISUAL_REGRESSION_PASS`, 수동 전후 비교 주장은 하지 않는다.

### 22.6 종료와 Phase 판정

Browser-level WebSocket에 `Browser.close`를 전송한 뒤 생성 Browser PID와 CDP listener가 종료됐다. 기존 사용자 Chrome, 기존 Frontend `3001`, Backend `8000`은 종료하지 않았다. 임시 profile은 저장소 밖 Temp에 생성됐다.

- Semantic Color CSS 구현: `COMPLETE`
- Neutral Runtime: `PARTIALLY_VERIFIED_STATE_NOT_RENDERED`
- Danger Runtime: `NOT_VERIFIED_STATE_NOT_RENDERED`
- Divider Runtime: `VERIFIED_CURRENT_STATE`
- `720px` 경계: `KEEP_720PX`, `VERIFIED_CURRENT_STATE`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

Danger Runtime과 `.status-inactive`가 실제 제품 상태로 렌더링되지 않았으므로 Phase A3를 완료로 판정하지 않는다.

## 23. 남은 Runtime 상태 검증 결과 (2026-07-30)

- 기준 commit: `674e22b`
- 선택 경로: `RUNTIME_VALIDATION_ENABLED=true`에서만 열리는 `/runtime-validation`
- 재사용 Component: `StatusBadge`, `ErrorState`, `InlineActionError`
- 기본값·`false`: Server-side `notFound()`로 `HTTP 404`
- Navigation 노출, API 호출·Mutation, Database 접근·변경, Dependency 변경: 없음
- Browser: 공식 Google Chrome `150.0.7871.187`, headed, CDP Protocol `1.3`
- 측정: Harness 1 Route × `1440×900`, `720×900`, `390×900` = 3개 조합

| Selector | 실제 Component | computed 결과 | Runtime 판정 |
|---|---|---|---|
| `.status-inactive` | `StatusBadge active={false}` | `color: rgb(89, 101, 121)`, `background-color: rgb(238, 240, 243)` | `VERIFIED_CURRENT_STATE` |
| `.state-panel-error` | retry Action이 있는 `ErrorState` | `border: 1px solid rgb(240, 184, 179)`, `background-color: rgb(255, 241, 240)` | `VERIFIED_CURRENT_STATE` |
| `.download-error` | retry Action이 있는 `InlineActionError` | `border: 1px solid rgb(240, 184, 179)`, `background-color: rgb(255, 241, 240)` | `VERIFIED_CURRENT_STATE` |

세 viewport에서 selector count는 각각 1, horizontal overflow와 text clipping은 0건이었다. 두 retry Button은 실제 focus에서 `outline: 3px solid`, `outline-offset: 2px`였고 viewport clipping은 0건이었다. Dev `nextjs-portal`은 존재하고 shadow root에 접근할 수 있었지만 visible portal과 error dialog는 0건이며 Runtime exception도 0건이었다. Resource 404 console entry는 기존 `favicon.ico` 요청으로 구분했다.

전체 7개 제품 Route의 Tab·Shift+Tab 순회는 `BLOCKED_DEMO_SEED_ENVIRONMENT`다. 검증 시작 시 `8000`, `3001`, EvalOps PostgreSQL listener가 없었고, 기존 EvalOps PostgreSQL container는 다른 프로젝트가 점유한 `5432`·`5433`과 충돌해 시작할 수 없었다. 인증 정보나 다른 프로젝트 process/container를 변경하지 않았다. 따라서 migration, row count, 21개 제품 Route·viewport focus 조합은 검증하지 않았고 PASS로 기록하지 않는다.

- 남은 미검증: Demo Seed row count, 7개 제품 Route의 Tab·Shift+Tab focus clipping, 제품 Route overlay·console·network
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`
