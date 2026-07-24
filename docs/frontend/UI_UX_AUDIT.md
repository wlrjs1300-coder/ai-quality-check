# Frontend UI/UX Audit

## Executive Summary

Slice 1~8의 핵심 흐름은 실제 Frontend Route와 Backend API로 연결되어 있습니다.

```text
Project
→ Dataset / Target / Evaluator
→ Version Snapshot
→ Experiment
→ Evaluation Result
→ Quality Gate
→ Baseline Comparison
```

현재 가장 큰 위험은 UI 미관보다 기능 공백과 화면별 상태 처리의 일관성 부족입니다. Projects와 Dataset Registry Pagination, Dataset Detail·Version 404 복귀는 코드 구현과 정적 검증을 마쳤고 Browser 회귀 검증만 남아 있습니다. UI를 전면 재설계하기 전에 Dataset·Target·Evaluator Project Scope 대조와 일부 Version 요청의 Abort 문제를 먼저 해결해야 합니다.

현재 자동 Frontend 검증은 typecheck, lint, production build뿐입니다. 2026-07-23에 확인한 Browser 시나리오는 수동 검증이며 저장소에 자동 Report가 없습니다.

## Route별 UI 완성도

| ID | Route | 강점 | 기능 또는 UI 문제 |
|---|---|---|---|
| R01 | `/` | `/projects`로 단순 Redirect | 별도 안내나 오류 상태 없음 |
| R02 | `/projects` | 목록, 생성, Pagination, Empty, 오류 상태 제공 | Pagination 구현 및 정적 검증 완료, Browser 회귀 검증 대기 |
| R03 | `/projects/{projectId}` | Dashboard, Summary, Trend, 최근 실행, 세 Registry 통합 | 정보가 많고 화면이 길며 KPI 의미가 일부 중복 |
| R04 | `/projects/{projectId}/history` | Filter, CSV, pagination, Experiment와 Comparison Link | 좁은 화면에서 Filter와 Card 밀도 검증 필요 |
| R05 | `/projects/{projectId}/datasets/{datasetId}` | Case 생성, 수정, 승인, 폐기와 Version 흐름 연결, 404 복귀 Action | URL Project Scope 대조 부족(404 복귀는 구현 및 정적 검증 완료, Browser 검증 대기) |
| R06 | `/projects/{projectId}/datasets/{datasetId}/versions/{version}` | 불변 Snapshot과 Case 표시, 404 복귀 Action | Project Scope 대조 부족(404 복귀는 구현 및 정적 검증 완료, Browser 검증 대기) |
| R07 | `/projects/{projectId}/targets/{targetId}` | MOCK 설정, 비활성화, FIXED Version 관리 | URL Project Scope 대조 부족 |
| R08 | `/projects/{projectId}/targets/{targetId}/versions/{version}` | 불변 Snapshot과 404 복귀 Action | 요청 AbortSignal 보강 필요 |
| R09 | `/projects/{projectId}/evaluators/{evaluatorId}` | 세 Evaluator Type과 Version 관리 | URL Project Scope 대조 부족 |
| R10 | `/projects/{projectId}/evaluators/{evaluatorId}/versions/{version}` | Snapshot과 404 복귀 Action | 요청 AbortSignal 보강 필요 |
| R11 | `/projects/{projectId}/experiments/new` | 독립 Version 선택 상태, 오류와 pagination 처리 | 상태 설계는 좋지만 Client 파일이 크고 선택 정보 밀도가 높음 |
| R12 | `/projects/{projectId}/experiments/{experimentId}` | Inline 실행, Result, Gate, Comparison이 연결됨 | 핵심 흐름은 완성됐지만 화면과 Client 파일이 지나치게 김 |
| R13 | `/projects/{projectId}/comparisons/{comparisonId}` | Summary와 Case 목록 오류가 분리되고 pagination 제공 | Mobile Case Diff와 긴 Reason 표시 검증 필요 |

## 상태와 오류 일관성

### 잘 구현된 부분

- Project Overview의 Dashboard, Summary, Trend 오류가 서로 분리됩니다.
- Experiment는 Dataset Version을 이용해 URL Project Scope를 방어적으로 확인합니다.
- Experiment Result, Gate, Comparison이 독립적인 상태와 오류를 가집니다.
- Comparison Summary와 Case 목록 오류가 분리됩니다.
- Target와 Evaluator Version 404에서 상위 Detail 복귀 Action을 제공합니다.
- Network 오류와 예상하지 못한 응답을 구분합니다.
- 주요 비동기 화면에 AbortController 또는 requestId 패턴이 있습니다.
- 갱신 중 기존 데이터를 유지하는 화면이 존재합니다.

### 보완할 부분

- Dataset Detail 404 복귀는 코드 구현과 정적 검증을 마쳤으며 Browser 회귀 검증이 남아 있습니다.
- Dataset Version 404 복귀는 코드 구현과 정적 검증을 마쳤으며 Browser 회귀 검증이 남아 있습니다.
- Dataset, Target, Evaluator Detail은 URL `projectId`와 응답 Scope 대조가 충분하지 않습니다.
- Target와 Evaluator Version API 요청에 AbortSignal 보강이 필요합니다.
- Projects와 Dataset Registry Pagination은 코드 구현과 정적 검증을 마쳤으며 Browser 회귀 검증이 남아 있습니다(20건 이하 데이터에서는 실제 2페이지 이동이 NOT_VERIFIED_DATA_LIMIT).
- Error, Empty, Disabled Reason의 문구와 배치가 화면마다 다릅니다.
- 같은 Network 오류의 제목과 설명이 완전히 통일되지 않았습니다.
- Dataset Registry의 Loading과 Refreshing 구분이 다른 Registry보다 약합니다.
- Disabled 이유가 본문, `title`, Form 오류 등 여러 방식으로 전달됩니다.

## 중복 UI Pattern

아래 수치는 정확한 public API 계약이 아니라 현재 코드에서 파악한 대략적인 반복 규모입니다.

| Pattern | 대략적인 반복 |
|---|---:|
| `section-heading` | 약 24 |
| `LoadingState` | 약 25 |
| `ErrorState` | 약 35 |
| Breadcrumb | 약 11 |
| Detail Header | 약 10 |
| Pagination | 약 8 |
| Empty inline | 약 12 |
| UUID를 표시하는 `code` | 약 29 |
| 날짜 format 호출 | 약 30 |
| Section 또는 Detail Card | 15 이상 |

### 공통화 우선 후보

1. Breadcrumb
2. Pagination
3. EmptyState
4. PageHeader와 SectionHeader
5. ResourceId와 Copy Action
6. Inline Error와 Partial Error
7. Field Error
8. Disabled Reason

### 후순위 후보

- 모든 Card를 하나로 합치는 추상화
- 모든 Form을 Schema 하나로 만드는 구조
- Dataset, Target, Evaluator를 하나의 Registry 고차 컴포넌트로 합치는 구조
- 모든 Metadata를 담는 거대한 범용 컴포넌트

후순위 후보는 화면별 의미와 상태가 달라 회귀 범위를 크게 만들 수 있습니다.

## `globals.css` 분석

- 약 185줄의 단일 Global CSS입니다.
- Layout, 공통 Component, 페이지 전용 규칙이 섞여 있습니다.
- 배경, surface, border, text, primary, success, danger 일부만 변수로 정의돼 있습니다.
- spacing, radius, warning, info, font-size 값이 여러 selector에 분산돼 있습니다.
- `dataset-card` 이름을 Target와 Evaluator에서도 재사용합니다.
- Gate와 Comparison 전용 규칙이 같은 파일에 누적돼 있습니다.
- 핵심 반응형 규칙은 720px breakpoint 하나에 집중돼 있습니다.
- 768px 부근에서 Desktop 다단 Layout이 유지되어 폭이 부족할 위험이 있습니다.
- reduced motion 대응은 있으나 Dark Mode는 없습니다.

전체 CSS 재작성보다 [Frontend Design Token Contract](DESIGN_TOKENS.md)에 따라 기존 값을 단계적으로 토큰으로 치환하는 방식이 안전합니다.

## 정보 위계

### Project Overview 권장 순서

1. Project 이름, 상태, 핵심 Action
2. Release Readiness와 최신 Gate, Comparison
3. 핵심 KPI 약 4개
4. 최근 Experiment
5. 상세 Analytics
6. Dataset, Target, Evaluator Registry

현재 Dashboard, Summary, Trend가 유사한 수치를 반복해 사용자가 Release 판정보다 지표를 먼저 읽게 할 수 있습니다. Backend 계산값은 유지하되 첫 화면에서는 `BLOCK`과 `REGRESSED` 같은 판정을 우선해야 합니다.

### Experiment Detail 권장 순서

1. Experiment 상태와 Inline 실행 Action
2. PASS, FAIL, ERROR와 필수 Case 실패 요약
3. 최신 Gate와 Comparison Decision
4. Case Results
5. Quality Gate 상세
6. Baseline Comparison 상세
7. Version, UUID, Hash Metadata

Tabs 또는 Section Navigation은 후보입니다. URL, focus, 새로고침, 부분 오류 상태를 검토하기 전에는 확정 구현으로 약속하지 않습니다.

## UUID와 기술 정보 전략

- 목록과 선택 UI는 이름과 Version 번호를 우선합니다.
- 목록에서 식별 보조가 필요하면 UUID를 축약합니다.
- 전체 UUID는 Detail Metadata 또는 Copy Action에서 제공합니다.
- Hash는 화면에서 축약하고 정확한 원문을 복사할 수 있게 합니다.
- 개발 정보는 `details` 또는 Metadata 영역으로 분리합니다.
- Tooltip만으로 원문이나 Action을 전달하지 않습니다.
- Copy는 실제 Button으로 제공하고 성공 알림을 표시합니다.

## 반응형

필수 검토 폭:

- 1440px
- 1024px
- 768px
- 390px

768px은 현재 720px 단일 breakpoint 때문에 가장 위험한 폭입니다.

우선 검증 화면:

- Project Overview
- History Filter
- Experiment Create
- Experiment Detail
- Dataset Case Form
- Comparison Case Diff
- 긴 Hash와 UUID
- Pagination과 Header Action wrapping

## 접근성

### 잘 구현된 부분

- `main` landmark
- 일부 Breadcrumb의 `aria-label`
- Loading의 `aria-live` 또는 `aria-busy`
- ErrorState의 `role="alert"`
- `focus-visible`
- 상태를 텍스트로 표시하는 Badge
- Gate Checkbox 설명
- Baseline Radio의 키보드 조작
- reduced motion 처리

### 보완할 부분

- Skip Link
- 모든 Breadcrumb의 일관된 label
- Form의 `id`와 `htmlFor` 규칙
- Field Error와 control의 `aria-describedby` 연결
- 모든 Button의 명시적 `type`
- Disabled 이유를 텍스트로 전달
- Refreshing 상태의 일관된 `aria-live`
- Heading 단계 정리
- Breadcrumb separator의 `aria-hidden`
- UUID와 Hash Copy Action 및 성공 알림

## 기능 결함과 UI 개선 분리

### 기능 결함 P1

1. Projects Pagination — 코드 구현 및 정적 검증 완료, Browser 회귀 검증 대기 (첫 20건만 접근 가능하던 결함은 해소)
2. Dataset Registry Pagination — 코드 구현 및 정적 검증 완료, Browser 회귀 검증 대기 (첫 20건만 접근 가능하던 결함은 해소)
3. Dataset Detail 404 복귀 — 코드 구현 및 정적 검증 완료, Browser 회귀 검증 대기
4. Dataset Version 404 복귀 — 코드 구현 및 정적 검증 완료, Browser 회귀 검증 대기
5. Dataset, Target, Evaluator Project Scope 대조

### 기능 결함 P2

1. Target와 Evaluator Version AbortSignal
2. Error, Empty, Disabled 표현 일관성
3. 768px Layout 위험
4. 수동 Browser 검증이 자동 검증처럼 다시 기록되지 않도록 문서 정합성 유지

### 순수 UI 개선

- Project Overview 정보 과밀
- Experiment Detail의 과도한 세로 길이
- UUID와 Hash 과다 노출
- Registry의 긴 Card 구조
- 공통 Header, Breadcrumb, Pagination 부재
- Loading, Empty, Partial Error 표현 차이
- 720px 단일 breakpoint
- Copy Action 부재

이번 문서 복구 PR에서는 위 P1과 P2를 구현 완료로 변경하지 않습니다. 기능 결함을 Phase 0에서 먼저 처리한 뒤 시각 개선을 진행합니다.

## 작업 모델 재평가 기준

현재 문서 복구와 Foundation 단계는 작은 범위로 진행할 수 있습니다. 다음 상황에서는 더 높은 추론 수준을 다시 검토합니다.

- Experiment Detail을 Tabs로 전면 재구성
- 전 Route의 공통 컴포넌트를 한 PR에서 교체
- 상태 계약과 Navigation 구조를 동시에 변경
- 기존 API State와 새로운 UI State가 충돌
- 공통 컴포넌트 추출로 10개 이상 Route를 한 번에 변경
