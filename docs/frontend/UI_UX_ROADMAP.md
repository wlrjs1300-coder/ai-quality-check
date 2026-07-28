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
