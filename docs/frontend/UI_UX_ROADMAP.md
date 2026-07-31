# Frontend UI/UX Roadmap

## 운영 원칙

이 Roadmap은 Slice 1~8 이후의 기능 보강과 UI/UX 개선을 작은 PR로 나눕니다.

- 기능 결함과 시각 개선을 구분합니다.
- 모든 작업을 한 번에 시작하지 않습니다.
- 각 PR은 하나의 검증 가능한 목적을 가집니다.
- 공통 컴포넌트 추출은 실제 반복과 회귀 기준이 확인된 뒤 진행합니다.
- Browser 검증은 날짜와 증거 수준을 기록하고 자동 검증과 구분합니다.
- Backend가 지원하지 않는 기능을 Frontend에서 임의 구현하지 않습니다.

전체 순서:

```text
Phase 0
→ Phase A
→ Phase B
→ Phase C
→ Phase D
→ Phase E
→ Phase F
```

## Phase 0 — Functional Regression Gaps

### 목표

시각 개선 전에 목록 접근, Project Scope, 404 복귀, 요청 취소 공백을 제거합니다.

### 포함 범위

- Projects Pagination — 구현 및 정적 검증 완료, Browser 검증 완료(2026-07-25, 다중 페이지는 Project 2건으로 NOT_VERIFIED_DATA_LIMIT)
- Dataset Registry Pagination — 구현 및 정적 검증 완료, Browser 검증 시도(2026-07-25)했으나 Dataset 1건으로 NOT_VERIFIED_DATA_LIMIT
- Dataset Detail 404 복귀 — 구현 및 정적 검증 완료, Browser 검증 완료(2026-07-25)
- Dataset Version 404 복귀 — 구현 및 정적 검증 완료, Browser 검증 완료(2026-07-25)
- Dataset, Target, Evaluator Frontend Project Scope 대조 — 구현 및 정적 검증 완료, Browser 검증 완료(2026-07-25, Backend Authorization은 범위 밖)
- Target와 Evaluator Version AbortSignal — 구현 및 정적 검증 완료, Browser 검증 완료(2026-07-25)
- Dataset Evaluation Case / Snapshot Case 배열 필드 파서 회귀 — 2026-07-25 Browser 검증에서 발견 후 같은 날 `fix/v0.25.5-dataset-array-parser` 브랜치에서 수정하고 Browser 재검증까지 완료(VERIFIED_MANUAL). 더 이상 Phase 0 완료 차단 요소가 아님
- 자동 Browser Test가 있는 것처럼 읽히는 문서 표현 정정

### 제외 범위

- Layout 재설계
- Design Token 적용
- Browser Test Dependency 추가
- 공통 Pagination 컴포넌트 추출
- Backend와 Migration 변경

### 예상 파일

- Projects와 Project Detail Client
- Dataset, Target, Evaluator Registry와 Version Client
- 관련 API Client
- Frontend 계약과 회귀 문서

### 위험도

중간입니다. 요청 경합, 기존 데이터 유지, 잘못된 URL 조합 처리에서 회귀가 생길 수 있습니다.

### 선행 조건

- [Frontend Regression Test Matrix](REGRESSION_TEST_MATRIX.md) 기준 확정
- 실제 Backend pagination과 오류 계약 확인

### 회귀 범위

- 목록과 상세
- 404 복귀
- Network 오류와 Retry
- Pagination
- Abort와 최신 응답 보호
- 기존 Form 상태

### Browser 검증

- 1건, 20건, 21건 목록
- 잘못 조합한 Project URL
- 존재하지 않는 리소스
- 빠른 Route 전환
- Backend 중단과 복구

### 완료 조건

- 각 기능 공백에 자동 증거 또는 날짜가 있는 수동 증거가 존재
- typecheck, lint, production build 통과
- 기존 핵심 흐름 회귀 없음

2026-07-25 세션에서 위 기능들의 Browser 회귀 검증을 수행했습니다. Projects 1페이지 표시·생성·Network 복구, Target/Evaluator 상세·Version 정상 표시, Target/Evaluator Version AbortSignal(요청 취소·최신 응답 반영·AbortError 미노출), Dataset/Target/Evaluator 상세 및 Version 6개 Route의 Project Scope 차단은 모두 VERIFIED_MANUAL로 확인됐습니다. 같은 세션에서 발견된 Dataset 상세 Evaluation Case 표시와 Dataset Version Snapshot Case 표시의 배열 필드 파서 회귀는 `fix/v0.25.5-dataset-array-parser` 브랜치에서 수정하고, 정적 검증(typecheck·lint·build)과 같은 날 Browser 재검증(Evaluation Case 5건 표시, Snapshot Case 5건과 Content Hash 표시, 객체 배열 Case 생성·편집 Form 역변환)까지 마쳐 VERIFIED_MANUAL로 확인했습니다.

Phase 0의 핵심 기능 공백(Pagination, 404 복귀, Project Scope 대조, AbortSignal, Dataset 배열 파서)은 모두 수정과 Browser 재검증을 완료했습니다. Pagination 다중 페이지 이동·Empty 상태는 Project·Dataset이 21건 미만이고 기존 데이터를 삭제하지 않아 NOT_VERIFIED_DATA_LIMIT으로, Keyboard 전수 검증은 세션 시간 제약으로 BLOCKED_BY_TIME 처리해 Phase F 접근성 마감 단계로 이관합니다. 이 잔여 항목들은 Dataset 파서 수정을 막는 회귀가 아니라 데이터 제한·시간 제약으로 관리되는 별도 검증 항목이므로, Phase 0의 모든 시나리오가 전수 검증됐다고 과장하지 않되 핵심 기능 공백은 해결된 것으로 판단해 Phase A로 진입할 수 있습니다.

### 독립 Merge 가능 여부

가능합니다. Pagination, Scope와 404, Abort를 서로 다른 PR로 분리합니다.

## Phase A — Regression Baseline and Design Foundation

### 목표

회귀 Matrix 운영 규칙과 Design Token 계약을 확정하고, 선언과 적용을 분리해 시각 변화 없는 적용 기반을 만듭니다.

### Phase A1 — Contract Alignment and Unused Token Declarations

- 문서와 실제 `globals.css` 현황의 정합성을 보완합니다.
- 현재 CSS에서 확인된 값과 목표 계약값을 새 정식 Token으로 선언하되, 기존 Selector에서는 사용하지 않습니다.
- 기존 축약형 Custom Property, literal, media query와 Selector를 유지합니다.
- Selector 치환, Alias 전환과 공통 Component 구현은 포함하지 않습니다.
- 시각 결과를 바꾸지 않는 것이 설계 목표입니다.
- typecheck, lint, production build 같은 정적 검증만으로 시각 동일성을 완료 처리하지 않습니다.

예상 파일은 [Frontend Design Token Contract](DESIGN_TOKENS.md), 이 Roadmap과 `globals.css`입니다. 문서 정합성과 미사용 선언의 위험도는 낮지만, Browser 비교를 수행하지 않은 상태는 시각 검증 완료로 기록하지 않습니다.

### Phase A2 — Low-risk Token Adoption

정확한 값과 Semantic 의미가 모두 일치하는 저위험 Selector만 제한적으로 Token에 연결합니다.

- 2026-07-27 첫 저위험 묶음에서 1120px container, 기본 Button의 44px control height, panel shadow, 정확히 일치하는 일부 font-size와 line-height를 Token에 연결했습니다.
- `/projects`를 대표 Route로 선택해 Chrome Headless에서 1440px, 1024px, 768px, 390px의 적용 전후 computed style, 가로 overflow, Button hover·focus-visible·disabled와 compact 36px 유지를 확인했습니다.
- 같은 날 공개 Demo Seed와 headed Chrome에서 `/projects`, Project Overview, Dataset Detail, Experiment Create, Experiment Detail, History, Comparison Detail을 네 viewport로 육안 검증했습니다. Container, Button, form·state·detail Panel, Typography, Badge, 긴 UUID와 모바일 Layout에 이상이나 가로 overflow가 없고 Console 오류도 없었습니다.
- Screenshot은 임시 검증 자료로만 사용하고 저장소에 포함하지 않았으며 자동 Pixel Diff는 수행하지 않았습니다. Demo Seed에 없는 Empty와 정상 환경의 Error·Loading 상태는 미검증이고 `.coming-next`는 우선 Route에 존재하지 않았습니다.
- 위 제한을 기록한 상태로 Phase A2를 완료합니다. Phase A3와 Phase B는 아직 시작하지 않았습니다.

Selector 치환은 작은 묶음으로 분리하며 네 viewport, keyboard focus, reduced motion과 상태 Badge의 Text·Surface를 관련 범위에서 확인합니다.

### Phase A3 — Contract Decisions

2026-07-29 기준 commit `26e05af`에서 Radius·Spacing·Line-height 통합 Browser 검증을 시도했다. Host `5433` PostgreSQL migration은 성공했지만 공식 Demo Seed가 기존 Evaluation Case graph 불일치로 `DEMO_SEED_CONFLICT`를 반환했고, `3000` 포트의 기존 `server.js`는 `/projects`에 HTTP 404를 반환했다. 현재 저장소 Frontend·정상 Demo Seed·Browser session 선행 조건이 함께 충족되지 않아 headed Chrome과 CDP 측정은 실행하지 않았다.

- Radius Browser 검증: `NOT_VERIFIED_ENVIRONMENT`
- Spacing Browser 검증: `NOT_VERIFIED_ENVIRONMENT`
- Line-height Browser 검증: `NOT_VERIFIED_ENVIRONMENT`
- 적용 전 baseline: `BASELINE_NOT_CAPTURED`
- 자동 Pixel Diff: `NOT_PRESENT`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

Token 계약과 정적 구현 상태는 유지한다. 그러나 neutral Text·Surface, danger border·divider, 현재 `720px` breakpoint, 역할이 다른 동일 색상 통합 여부가 남아 있고 Browser 통합 검증도 완료되지 않았으므로 Phase A3 전체를 완료로 처리하지 않는다.

2026-07-29 기준 commit `db8b407`에서 환경 복구 후 Chrome `150.0.7871.187` headed CDP로 Radius·Spacing·Line-height 현재 상태를 재측정했다. 임시 same-origin rewrite를 사용한 `http://localhost:3002`에서 7개 우선 Route와 네 viewport의 총 28개 조합이 HTTP 200으로 렌더링됐다. 기존 `3001`은 Backend 직접 API 호출이 CORS로 차단됐으며, 임시 `3002`는 제품 파일을 바꾸지 않은 검증 전용 실행으로 정식 제품 설정이나 영구 해결책이 아니다.

- Radius Browser 검증: `VERIFIED_CURRENT_STATE`
- Spacing Browser 검증: `VERIFIED_CURRENT_STATE`
- Line-height Browser 검증: `VERIFIED_CURRENT_STATE`
- `.state-panel p`: `NOT_VERIFIED_STATE_NOT_RENDERED`
- `.coming-next p`: `NOT_VERIFIED_ROUTE_NOT_PRESENT`
- 적용 전 baseline: `BASELINE_NOT_CAPTURED`
- 자동 Pixel Diff: `NOT_PRESENT`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

Radius는 field `7px`, 일반 Card·Panel `12px`, message surface `7px`, Metric·Baseline Candidate `10px`을 확인했다. Baseline Candidate의 native radio `0px`은 text field 계약과 구분했다. Spacing은 Card·Panel padding `20px`·`22px`·`24px`, Form gap `18px`·`20px`, Action gap `8px`·`10px`, Summary gap `24px`, List·Badge·Grid의 계약 범위를 확인했다. Line-height는 Summary `18.4px / 29.44px / 1.6`, Description `16px / 26.4px / 1.65`를 확인했고 Summary는 viewport 감소에 따라 2·2·3·4줄로 wrapping됐다.

28개 조합에서 horizontal overflow, 비정상 overlap, text clipping과 focus outline clipping은 발견되지 않았다. 애플리케이션 Console Error·Runtime exception·API 실패·hydration 오류·실제 Next.js error overlay는 없었다. 단, `/favicon.ico` HTTP 404 1건과 Route 전환 중 canceled Fetch가 있었으며 모든 Console·Network 오류가 없었다고 일반화하지 않는다.

측정 종료 시 Browser PID와 CDP listener가 이미 종료돼 명시적인 `Browser.close` 정상 종료는 확인하지 못했다. 저장소 밖 Temp의 전용 profile도 도구 정책상 남았다. 현재 상태 검증은 완료했지만 적용 전 baseline 비교는 수행하지 않았고, neutral Text·Surface, danger border·divider, 현재 `720px` breakpoint 변경 여부와 의미가 다른 동일 색상 통합 여부가 남아 있으므로 Phase A3 전체는 계속 `IN_PROGRESS`다.

Phase A3는 Focus 계약 결정부터 시작했습니다.

- 2026-07-27 전수 조사에서 현재 primary Focus Indicator가 `:focus-visible`의 3px outline과 2px offset임을 확인했습니다.
- `--focus-ring-color`, `--focus-outline-width`, `--focus-outline-offset`을 현재 literal과 같은 값으로 CSS에 연결했습니다.
- `--shadow-focus`는 outline 대체재가 아니며 시각 변경을 만들 수 있어 미적용 상태를 유지합니다.
- 현재 native button, link, input, textarea, select, checkbox, radio와 native disabled 정책을 유지합니다. Chrome 기본 outline과 비교해 marker·layout·clipping 충돌이 없고 keyboard 표시가 더 명확한 `summary`도 공통 Selector 끝에 포함했습니다.
- headed Chrome의 일곱 우선 Route와 네 viewport에서 keyboard focus, Shift+Tab, mouse focus-visible, disabled 제외, ring 잘림과 Console을 조사했습니다. Button·Link Enter/Space activation은 도구 한계로 미검증이며 forced-colors와 contrast ratio도 미검증입니다. WCAG 준수 상태로 기록하지 않습니다.
- 일곱 우선 Route와 네 viewport의 적용 전후 headed Chrome 검증에서 computed outline, keyboard·mouse 구분, disabled 제외, reduced-motion 유지, ring 잘림 없음과 Console 무오류를 확인했습니다. Loading 중 disabled 전환 시 focus가 `body`로 이동하는 기존 동작은 후속 UX 위험이며, forced-colors와 contrast ratio는 미검증입니다. 이 범위의 Focus CSS 적용과 Focus 단계는 완료했으며 Phase B는 아직 시작하지 않았습니다.

다음처럼 값 보존만으로 결정할 수 없는 항목의 계약을 확정합니다.

- neutral Text와 Surface
- danger border와 divider
- focus outline과 Token 계약 — 문서 결정 및 CSS 적용 완료
- radius와 Token 계약 — `--radius-field: 7px`과 확정 selector의 CSS 적용 완료, Browser 검증 미실시
- spacing 계약 — 의미별 일부 Token화와 예외 유지 결정, CSS 적용·Browser 검증 미실시
- 현재 720px breakpoint 변경 여부
- 7px과 10px radius 처리 — field만 Token화하고 message surface와 10px 사용처는 후속 구현에서 제외
- 1.6 line-height 처리
- 의미가 다른 동일 색상 통합 여부

2026-07-29 기준 commit `62a395c`에서 위 남은 네 계약을 [Phase A3 Remaining Contracts](REMAINING_PHASE_A3_CONTRACTS.md)로 확정했다. Neutral은 일반 muted Text와 중립 상태·immutable guidance를 분리하고 상태 selector만 신규 semantic Text·Surface Token 대상으로 정했다. Error container의 `#f0b8b3`는 danger border 역할로, `#edf0f4` row separator는 divider 역할로 각각 분리하며 strong validation·interactive border와 일반 control border에는 통합하지 않는다. 같은 물리 색상은 역할별 semantic 경계를 유지하고 일부만 통합한다.

현재 Layout의 유일한 width media query는 `max-width: 720px`으로 유지하고 Token화하지 않는다. 768px 변경, Custom Media, Dependency·Build 설정 추가는 근거와 범위를 벗어나므로 제외한다. 후속 CSS 구현은 신규 semantic Token 4개와 확정 selector의 값 보존 치환으로 제한하고, `721px`, `720px`, `719px` Browser 경계 검증을 요구한다.

- 남은 네 계약 조사·결정: `COMPLETE`
- 남은 계약 CSS 구현: `INCOMPLETE`
- Breakpoint 경계 Browser 검증: `NOT_VERIFIED`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

### Phase A 공통 제외 범위

- Dark Mode
- Branding 전면 변경
- 전체 CSS 재작성
- 공통 Navigation과 State Component 구현
- Phase B Component의 선행 구현

### 선행 조건과 완료 조건

- Phase 0 기능 결함 범위가 확정돼야 합니다.
- Token 선언 상태와 Selector 적용 상태를 문서와 CSS에서 구분해야 합니다.
- 적용한 범위는 1440px, 1024px, 768px, 390px에서 비교합니다.
- WCAG contrast 검증 대상과 실제 결과를 구분합니다.
- 자동 시각 회귀가 없는 동안 정적 검증 결과를 시각 동일성 증거로 표현하지 않습니다.

### 독립 Merge 가능 여부

가능합니다. Phase A1의 문서·미사용 선언, Phase A2의 저위험 치환, Phase A3의 계약 판단을 분리합니다.

## Phase B — Common Navigation and State Components

공통화를 한 PR에 몰아넣지 않고 다음 세부 Slice로 나눕니다.

### B1 Breadcrumb + PageHeader

- 목표: 현재 위치, 제목, 핵심 Action을 일관되게 표시
- 포함: Breadcrumb, PageHeader, heading 규칙
- 제외: 본문 Layout 재배치
- 예상 파일: 공통 Component와 적용 Route
- 위험도: 중간
- 선행 조건: Token 이름 확정
- 회귀: 13개 Route의 Link와 heading
- Browser: keyboard focus, 404 복귀, 긴 제목
- 완료 조건: 목적지와 heading 단계가 일관됨
- 독립 Merge: 가능

2026-07-31 `feat/v0.32.0-phase-b1-breadcrumb-pageheader`에서 B1을 구현하고 자동 Browser 회귀를 완료했습니다.

- 12개 제품 Route에 공통 `Breadcrumb`와 `PageHeader`를 적용했습니다. `/projects`는 최상위 Route라 Breadcrumb를 표시하지 않으며, Runtime Validation fixture는 제품 Breadcrumb 계층에서 분리한 채 공통 PageHeader만 사용합니다.
- 각 제품 Route의 정상·loading·error·resource 404 상태에서 하나의 `h1`을 유지하고, 본문 section과 state heading은 `h2` 이하로 구분했습니다. 전역 not-found에는 `/projects` 복귀 Action을 추가했습니다.
- Breadcrumb는 현재 항목을 비-Link `aria-current="page"`로 표시하고 내부 separator를 접근성 트리에서 제외합니다. PageHeader는 제목·설명·metadata와 Action·status 영역의 일관된 DOM 순서를 제공합니다.
- B1 Playwright는 API에서 Demo Seed Route ID를 발견해 12개 제품 Route, resource 404, 전역 404, 비활성 Runtime Validation을 검증합니다. 1440×900, 720×900, 390×900에서 heading, Breadcrumb 목적지, Tab·Shift+Tab, Header Action의 href 또는 동작, 가로 overflow, visible error overlay, Console·Network 오류를 확인합니다.
- 390px에서는 API 응답을 Test Harness에서만 대체한 긴 unbroken Project 제목의 wrapping과 clipping 부재를 별도로 검증했습니다.
- `npm run test:browser:b1`과 `npm run test:browser:b1:headed`는 각각 49 passed, 2 skipped입니다. 두 skip은 390px 전용 긴 제목 Test를 1440px·720px project에서 의도적으로 제외한 결과입니다.
- 기존 Product Focus Test는 headless·headed 각각 21 passed, Runtime Focus Smoke는 headless·headed 각각 1 passed로 유지됐습니다. typecheck, lint, production build와 Repository Policy도 통과했습니다.
- 첫 headed 전수 실행에서 Chrome page/context/browser가 assertion 전 종료된 일시적 Harness 실행 실패 1건이 있었으나, 같은 desktop Route 단독 재실행과 이후 headed 전수 재실행은 모두 통과했습니다.
- forced-colors, screen reader 실사용, WCAG 전체 준수 판정과 본문 Layout 재배치는 이번 범위에서 검증하거나 구현하지 않았습니다.
- Phase B1: `COMPLETE`
- Phase B2: `NOT_STARTED`

### B2 Pagination

- 목표: 이미 검증된 pagination 구현의 공통 계약 정리
- 포함: 이전, 다음, 전체 건수, 현재 page, Disabled 상태
- 제외: Phase 0에서 해결해야 할 접근 불가 결함 자체를 미룸
- 예상 파일: Pagination Component와 목록 화면
- 위험도: 중간
- 선행 조건: Phase 0 Projects와 Dataset pagination 검증
- 회귀: History, Registry, Result, Comparison Case
- Browser: 첫, 중간, 마지막, 빈 page와 요청 경합
- 완료 조건: 서버 pagination과 기존 상태 보존
- 독립 Merge: 가능

2026-07-31 `feat/v0.33.0-phase-b2-pagination`에서 공통 Component 추출 전 선행 결함을 B2-0으로 분리해 수정하고 자동 회귀를 완료했습니다.

- Dataset Version 목록의 `page`와 `size`를 다른 목록 API와 같은 FastAPI Query 계약(`page >= 1`, `1 <= size <= 100`)으로 통일했습니다. 정상 pagination envelope는 유지하며 범위 밖 값은 HTTP 422를 반환합니다.
- History가 `total > 0`인 범위 초과 page를 받으면 Empty 상태로 확정하지 않고 마지막 유효 page로 `router.replace`한 뒤 다시 조회합니다. 기존 filter와 sort query, page 1 Empty, 마지막 유효 page, CSV와 Abort/request ID 계약은 유지합니다.
- Dataset Detail의 Evaluation Case와 Dataset Version Pagination은 각 목록 요청 중 이전·다음 Button을 disabled 처리합니다. 두 landmark는 각각 `Evaluation cases pagination`, `Dataset versions pagination`으로 구분합니다.
- B2-0 Playwright는 DB를 변경하지 않고 interception으로 41건을 구성해 1440×900, 720×900, 390×900에서 URL canonicalization, Empty, 마지막 page, 실제 Tab·Shift+Tab·Enter·Space, 연속 activation 차단, overflow, focus clipping, visible overlay, Console·Page·Network 오류를 검증합니다.
- `npm run test:browser:b2-0`과 headed 실행은 각각 15 passed입니다. B1은 headless·headed 각각 49 passed/2 skipped, Product Focus는 각각 21 passed, Runtime Focus Smoke는 각각 1 passed로 유지됐습니다.
- Backend 관련 Test는 9 passed, 전체 Backend는 124 passed/7 skipped이며 ruff, Frontend typecheck·lint·production build가 통과했습니다.
- 공통 Pagination Component, 전체 화면 JSX 공통화, total 표시, URL 정책 전면 통일은 B2-0 범위에서 제외했습니다.
- Phase B2-0: `COMPLETE`
- Phase B2: `IN_PROGRESS`
- Phase B2-1 common Pagination: `COMPLETE`
- Phase B2-2 remaining Pagination adoption: `NOT_STARTED`

2026-07-31 `feat/v0.33.1-phase-b2-1-pagination-component`에서 공통 Pagination Component를 추가하고 Projects와 History에 우선 적용했습니다.

- 공통 Component는 이전·다음 Button, 전체 건수, 현재 page와 전체 page 수, loading 및 첫·마지막 page Disabled 상태를 하나의 계약으로 제공합니다. Empty 목록에서는 숨기고, 1건과 20건처럼 한 page인 목록에서도 현재 상태를 표시합니다.
- Projects는 기존 Client state와 API pagination을 유지한 채 중복 JSX만 공통 Component로 교체했습니다. History는 B2-0의 범위 초과 page canonicalization, filter·sort query, Abort와 최신 응답 보호 계약을 그대로 유지했습니다.
- B2-1 Playwright는 Backend와 DB를 변경하지 않고 API interception으로 Projects의 0·1·20·21·41건과 History의 범위 초과 page를 구성합니다. 1440×900, 720×900, 390×900에서 첫·중간·마지막 page, Empty, loading 중 연속 activation 차단, 실제 Tab·Shift+Tab·Enter·Space, request 중복, URL·filter 보존, overflow, focus clipping, visible overlay, Console·Page·Network 오류를 검증합니다.
- `npm run test:browser:b2-1`과 `npm run test:browser:b2-1:headed`는 각각 6 passed입니다. B2-0은 headless·headed 각각 15 passed, B1은 각각 49 passed/2 skipped, Product Focus는 각각 21 passed, Runtime Focus Smoke는 각각 1 passed로 유지됐습니다.
- Frontend typecheck, lint, production build와 Repository Policy가 통과했습니다.
- Dataset Detail, Dataset Version과 나머지 pagination 화면의 공통 Component 적용은 B2-2로 남깁니다. 따라서 Phase B2 전체 상태는 `IN_PROGRESS`입니다.

Phase 0 Pagination은 실제 접근 불가 결함을 해결하고, B2는 검증된 화면별 구현을 공통 계약으로 정리합니다.

### B3 Empty + Partial Error

- 목표: 전체 실패와 하위 Panel 실패를 명확히 구분
- 포함: EmptyState, PartialError, Retry
- 제외: Backend 오류 코드 변경
- 예상 파일: Async State Component와 Panel
- 위험도: 중간
- 선행 조건: State와 Error 계약 확인
- 회귀: Dashboard, Experiment, Comparison
- Browser: 하위 API 단독 실패와 복구
- 완료 조건: 한 Panel 실패가 정상 데이터 전체를 숨기지 않음
- 독립 Merge: 가능

### B4 ResourceId + Copy

- 목표: UUID와 Hash 노출을 줄이면서 정확한 값 복사 제공
- 포함: 축약 표시, Copy Button, 성공 알림
- 제외: Clipboard Dependency
- 예상 파일: ResourceId Component와 Detail Metadata
- 위험도: 낮음
- 선행 조건: 목록과 상세 표시 정책 확정
- 회귀: Version, Experiment, Comparison Detail
- Browser: 키보드 복사, 실패, feedback
- 완료 조건: 목록은 이름 중심이고 상세에서 원문 복사 가능
- 독립 Merge: 가능

### B5 Disabled Reason + Field Error

- 목표: 실행 불가 이유와 입력 오류를 일관되게 전달
- 포함: 인라인 이유, label과 오류 연결
- 제외: Backend validation 변경
- 예상 파일: Form 공통 요소와 mutation 화면
- 위험도: 중간
- 선행 조건: 오류 코드 mapping 확인
- 회귀: 생성, 실행, Gate, Comparison
- Browser: 필수값, inactive, immutable, 422
- 완료 조건: 색상이나 tooltip만으로 이유를 전달하지 않음
- 독립 Merge: 가능

## Phase C — Projects and Project Overview

### 목표

첫 방문 사용자가 서비스 목적과 Release Decision을 빠르게 이해하게 합니다.

### 포함 범위

- Release Decision 우선 배치
- KPI 축소
- Dashboard, Summary, Trend 중복 정리
- 최근 Experiment
- Registry Navigation

### 제외 범위

- Backend KPI 재계산
- 새 Chart Library
- 인증과 Workspace

### 예상 파일

- Projects 화면
- Project Detail Client
- Analytics Component
- 관련 Frontend 문서

### 위험도

중간입니다.

### 선행 조건

- Phase B의 Header와 State 기준

### 회귀 범위

- Dashboard
- Summary
- Trend
- 최근 Experiment
- Registry 진입

### Browser 검증

- 1440px, 1024px, 768px, 390px
- 기간 Filter
- 하위 Panel 단독 오류
- Project 404와 Network 복구

### 완료 조건

- 최신 `BLOCK`과 `REGRESSED`가 평균 지표보다 먼저 식별됨
- 핵심 KPI가 약 4개로 정리됨
- Registry 진입점이 명확함

### 독립 Merge 가능 여부

가능합니다. Projects와 Project Overview를 분리할 수 있습니다.

## Phase D — Registry and Version Screens

### 목표

Dataset, Target, Evaluator의 생성, Version, 비활성 UX를 일관되게 만듭니다.

### 포함 범위

- Registry 정보 밀도
- Project Scope
- 404 복귀
- Pagination
- Snapshot Metadata
- 생성과 비활성 상태 안내

### 제외 범위

- Dataset Import
- 삭제와 복구
- 새 Backend API
- 외부 Provider 설정

### 예상 파일

- 세 Registry
- 세 Detail과 Version 화면
- 관련 API Client

### 위험도

중간입니다.

### 선행 조건

- Phase 0
- B1, B2, B4

### 회귀 범위

- Case 상태 전이
- Version 생성과 중복
- 비활성화
- 불변 Snapshot

### Browser 검증

- 정상, Empty, 404, Scope, Network
- 첫 page와 다음 page
- 생성 후 상태 복원

### 완료 조건

- 세 Registry가 같은 Navigation과 State 원칙을 사용
- Snapshot과 활성 원본의 차이를 사용자가 이해

### 독립 Merge 가능 여부

가능합니다. Dataset, Target, Evaluator별 PR을 권장합니다.

## Phase E — Experiment Create and Detail

### 목표

Result, Gate, Comparison, Metadata의 정보 위계를 정리하고 주요 Action 접근성을 높입니다.

### 포함 범위

- 상단 Summary
- PASS, FAIL, ERROR와 필수 실패 우선 표시
- Gate와 Comparison Decision
- Case Result
- 긴 화면 축소
- Tabs 또는 Section Navigation 재검토

### 제외 범위

- Inline 실행 방식 변경
- Quality Gate와 Comparison Backend 변경
- 비동기 Worker 도입

### 예상 파일

- Experiment Create
- Experiment Detail
- Quality Gate Panel
- Baseline Comparison Panel

### 위험도

높습니다.

### 선행 조건

- Phase B 공통 State와 ResourceId
- 현재 수동 회귀 시나리오 재현

### 회귀 범위

- Version 선택
- Inline 실행
- Result
- Gate
- Comparison
- 새로고침 복원

### Browser 검증

- PASS, FAIL, ERROR
- Gate PASS와 BLOCK
- IMPROVED, UNCHANGED, REGRESSED
- Network와 중복 복구
- 1440px, 1024px, 768px, 390px

### 완료 조건

- Critical 또는 필수 실패와 Release 판정이 첫 화면에서 식별됨
- 3분 안에 Experiment에서 Result, Gate, Comparison까지 확인 가능

### 독립 Merge 가능 여부

가능하지만 Create와 Detail을 분리합니다.

Tabs는 후보이며 이 Roadmap에서 확정 구현으로 약속하지 않습니다.

## Phase F — History, Comparison, Responsive and Accessibility

### 목표

History와 Case Diff의 밀도를 개선하고 전체 Route의 반응형과 접근성을 마무리합니다.

### 포함 범위

- History 밀도
- Case Diff의 Desktop과 Mobile 표현
- Mobile Layout
- keyboard-only
- Skip Link
- Copy feedback
- 최종 UI Polish

### 제외 범위

- Dark Mode
- 새 Chart Library
- 새 접근성 Library

### 예상 파일

- History
- Comparison Detail
- Root Layout
- 공통 Component
- `globals.css`

### 위험도

중간에서 높음입니다.

### 선행 조건

- Phase B부터 E까지 핵심 작업 완료

### 회귀 범위

- 전체 13개 Route

### Browser 검증

- 1440px, 1024px, 768px, 390px
- Tab, Shift+Tab, Enter
- focus와 heading
- zoom과 긴 텍스트
- reduced motion

### 완료 조건

- 핵심 흐름을 keyboard-only로 완료
- 정보 손실과 가로 overflow 없음
- 404, Empty, Network 오류에 복구 Action 존재

### 독립 Merge 가능 여부

가능합니다. Responsive와 접근성 마감을 분리합니다.

## 자동화 후보

### 현재 Dependency 없이 가능한 검증

- TypeScript typecheck
- ESLint
- Next.js production build
- build 출력의 Route 존재 확인
- Backend TestClient
- curl 또는 API Smoke
- 정적 금지 패턴 검사

### Playwright 도입 시 후보

- 13개 Route Smoke
- 404 복귀
- Network 오류와 Retry
- 필수 입력
- 상세 이동
- 상태 Badge
- Pagination
- Project Scope
- 새로고침 복원
- Gate와 Comparison
- 네 viewport Screenshot
- keyboard 흐름

Playwright 도입은 별도 Dependency PR로 판단하며 현재 구현 완료로 간주하지 않습니다.

## 포트폴리오 완료 기준

- 첫 화면에서 서비스 목적과 다음 Action을 이해할 수 있음
- 3분 안에 Experiment, Result, Gate, Comparison 흐름 확인
- `BLOCK`과 `REGRESSED`를 즉시 식별
- Version 관계와 불변 Snapshot을 이해
- UUID가 정보 위계를 방해하지 않음
- 실패, Empty, 404, Network 상태에 Action 존재
- 1440px, 1024px, 768px, 390px에서 사용 가능
- keyboard-only로 주요 흐름 완료
- Browser Console 오류 없음
- README와 화면 용어 일치
- 측정하지 않은 수치 표시 금지
- Critical 또는 필수 실패로 Gate가 BLOCK되는 Demo 재현

### Phase A3 Semantic Color Browser Runtime 결과 (2026-07-29)

기준 commit `84364d9`에서 공식 Google Chrome `150.0.7871.187` headed CDP와 임시 same-origin origin `http://127.0.0.1:3002`를 사용해 7개 Route × 7개 viewport, 총 49개 조합을 측정했습니다. Backend health는 `HTTP 200`, Migration은 `20260721170000 (head)`, 공식 Demo Seed 2회는 모두 종료 코드 `0`과 `already_seeded`였으며 Evaluation Case 전체 6, Seed Case 5, 일반 DRAFT 1, Snapshot 5를 유지했습니다.

- Semantic Color CSS 구현: `COMPLETE`
- Neutral Runtime: `.semantic-neutral`의 `rgb(89, 101, 121)` / `rgb(238, 240, 243)`는 `VERIFIED_CURRENT_STATE`; `.status-inactive`는 `NOT_VERIFIED_STATE_NOT_RENDERED`; 전체 `PARTIALLY_VERIFIED_STATE_NOT_RENDERED`
- Immutable Note: 같은 computed 값이 확인됐지만 기존 literal 역할을 유지하며 신규 Neutral State Token 대상이 아님
- Danger Runtime: `.state-panel-error`, `.download-error` 모두 `NOT_VERIFIED_STATE_NOT_RENDERED`
- Divider Runtime: 네 selector 모두 `1px solid rgb(237, 240, 244)`, `VERIFIED_CURRENT_STATE`
- `720px` 경계: 721px에서 미적용, 720px·719px에서 적용된 computed Layout을 확인해 `KEEP_720PX`, `VERIFIED_CURRENT_STATE`
- Horizontal overflow·조사 대상 overlap·text clipping: 49개 조합 `0`건
- Focus outline clipping: `NOT_VERIFIED_METHOD_LIMIT`
- Console Error·Runtime exception·Hydration 오류·application API 실패: 수집 결과 `0`
- Resource 404: 기존 `favicon.ico` 재현
- canceled Fetch: Route 전환 중 `net::ERR_ABORTED`, `canceled=true` 35건으로 navigation 취소와 구분
- Next.js overlay: dev portal host는 존재했으나 visible error overlay 별도 캡처가 없어 `NOT_VERIFIED_VISIBLE_STATE`
- 적용 전 Browser baseline: `BASELINE_NOT_CAPTURED`
- 자동 Pixel Diff: `NOT_PRESENT`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

Danger Runtime과 `.status-inactive`의 실제 렌더링 근거가 없으므로 Phase A3를 `COMPLETE`로 올리지 않습니다. 상세 환경, Route, viewport, computed style과 종료 결과는 [Phase A3 Remaining Contracts](REMAINING_PHASE_A3_CONTRACTS.md)에 기록합니다.

### Phase A3 Runtime 상태 보강 (2026-07-30)

- Runtime validation route: 구현 완료, Production 기본 비활성
- Neutral Runtime `.status-inactive`: `VERIFIED_CURRENT_STATE`
- Danger Runtime `.state-panel-error`, `.download-error`: `VERIFIED_CURRENT_STATE`
- Harness focus clipping: 3개 viewport에서 `VERIFIED_NO_FOCUS_CLIPPING`
- Harness visible overlay: `VERIFIED_NO_VISIBLE_ERROR_OVERLAY`
- 제품 7개 Route focus·overlay 재검증: `BLOCKED_DEMO_SEED_ENVIRONMENT`
- Phase A3: `IN_PROGRESS`
- Phase B: `NOT_STARTED`

상세 computed style, 차단 원인과 미검증 범위는 [Phase A3 Remaining Contracts](REMAINING_PHASE_A3_CONTRACTS.md)의 2026-07-30 결과를 기준으로 합니다.

### Phase A3 Product Route Focus 완료 (2026-07-31)

7개 제품 Route × `1440×900`, `720×900`, `390×900`의 21개 조합을 실제 keyboard Tab·Shift+Tab으로 검증했습니다. 최초 확인된 viewport focus-ring clipping 11건은 공통 focusable 요소의 5px `scroll-margin-block`과 textarea의 공통 최소 높이 `76px`로 해소했습니다. 3px outline, 2px offset, 최대 1px tolerance와 `720px` breakpoint 계약은 유지했으며 테스트 assertion과 Harness 계산은 완화하지 않았습니다.

- Product focus headless: `21/21 PASS`
- Product focus headed: `21/21 PASS`
- viewport·overflow ancestor clipping, fixed·sticky obstruction, visible error overlay: `0`
- Console error·Runtime exception·실패한 application API response: `0`
- Runtime smoke headless·headed: 각각 `1/1 PASS`
- Typecheck, Lint, Production Build, Repository Policy: `PASS`
- Phase A3: `COMPLETE`
- Phase B: `NOT_STARTED`

상세 결함 목록과 CSS 선택 근거는 [Phase A3 Remaining Contracts](REMAINING_PHASE_A3_CONTRACTS.md)의 2026-07-31 최종 검증 결과를 기준으로 합니다.
