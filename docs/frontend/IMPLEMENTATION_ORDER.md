# Frontend Implementation Order

아래 순서는 Demo Seed로 각 단계의 사용자 흐름을 검증할 수 있도록 작은 Vertical Slice로 나눕니다.

## Slice 1 — API 경계와 Projects

포함: 공통 Client, 오류 Parser, Envelope 처리, Projects 목록·생성, Project 기본 상세.

완료 조건: Loading·Empty·Error·Success, Project 생성 후 재조회, 404 이동, FastAPI field 오류 연결이 자동 테스트로 검증됩니다.

상태: 구현 완료. TypeScript strict, lint, production build 검증을 기준으로 하며 별도 Frontend 테스트 Library는 아직 도입하지 않았습니다.

제외: Dashboard, Registry mutation.

## Slice 2 — 관찰 가능한 Demo

포함: Project Overview의 Dashboard·Summary, History·Trend, CSV Export.

완료 조건: 같은 기간 Filter가 네 조회와 CSV에 전달되고 Demo의 네 Experiment, 최신 `BLOCK`, `REGRESSED`, `DECLINING`을 표시합니다. CSV 파일명과 오류 응답을 구분합니다.

상태: 화면과 API 연결을 구현했고 TypeScript strict, lint, production build를 통과했습니다. 실제 Demo Seed 값과 다운로드 동작의 Browser 검증은 로컬 서비스 실행 환경에서 별도로 확인해야 합니다.

## Slice 3 — Dataset Snapshot

포함: Dataset 생성·상세, Case 생성·수정·승인·폐기, Dataset Version 생성·상세.

완료 조건: DRAFT 정책, inactive 상태, 승인 Case 기반 Snapshot, duplicate/no-approved 오류가 화면 상태와 테스트로 연결됩니다.

상태: 구현 완료. Dataset Registry와 생성, Dataset Detail의 Case 생성·DRAFT 수정·승인·폐기, Version 생성·목록·불변 상세를 실제 PostgreSQL 및 Browser Smoke Test로 검증했습니다. Dataset 이름·설명 수정과 비활성화 UI는 이번 Slice에서 제외했습니다.

## Slice 4 — Target와 Evaluator Snapshot

포함: MOCK Target와 결정론적 Evaluator 생성·수정, Version 목록·생성·상세.

완료 조건: FIXED Target 및 세 Evaluator Type의 Snapshot Hash와 inactive·duplicate 상태를 표시합니다. Raw execute UI는 만들지 않습니다.

상태: 구현 완료. MOCK+FIXED Target과 CONTAINS·NOT_CONTAINS·REGEX Evaluator의 생성·수정·영구 비활성화, Version 1·2 불변 Snapshot과 중복 오류를 실제 PostgreSQL API로 검증했습니다. Raw execute UI는 포함하지 않았습니다.

## Slice 5 — Inline Experiment

포함: 세 Version 선택, Experiment 생성, 단건 실행, Case별 Result.

완료 조건: 같은 Project 범위만 선택하고 중복 실행을 막으며 PASS·FAIL·ERROR와 실패 이유를 표시합니다.

상태: 화면과 API 연결을 구현했고 TypeScript strict와 lint 검증을 통과했습니다. 부모·Version 목록의 독립 페이지네이션, 실행 오류 후 상태 재조회, Result 부분 오류 복구와 새로고침 복원을 포함합니다. 실제 PostgreSQL 데이터로 생성·실행·2페이지 이동·Network 복구를 확인하는 Browser 검증은 별도로 수행해야 합니다.

## Slice 6 — Experiment History 연결

포함: Experiment History와 Dashboard 최근 Experiment의 상세 이동, History 복귀, Dataset Version 기반의 방어적 Project Scope 확인.

완료 조건: History와 Dashboard 카드가 올바른 Project·Experiment 상세로 이동하고, Scope 확인 전 Experiment와 Result를 노출하지 않으며 History 404와 Network 오류에서 복구할 수 있습니다.

상태: 화면 연결과 Scope 상태 분리를 구현했고 TypeScript strict와 lint 검증을 통과했습니다. 실제 History·Dashboard 이동, 다른 Project URL 조합 차단, Keyboard 이동과 Network 복구는 Browser에서 별도로 검증해야 합니다.

## Slice 7 — Gate와 Comparison

포함: Gate Policy 생성·평가, Baseline Comparison 생성·상세.

완료 조건: `BLOCK`과 required failure 이유, `REGRESSED` Case를 재현하고 관련 Dashboard·Summary·History가 재조회됩니다.

## Demo Seed 시연 순서

1. Backend에서 Demo Seed를 실행하고 출력된 `project_id`를 확인합니다.
2. Project Overview에서 Dashboard와 Summary를 확인합니다.
3. History에서 pass rate `0.6 → 0.8 → 0.8 → 0.4`를 확인합니다.
4. 최신 Gate `BLOCK`, Comparison `REGRESSED`, Trend `DECLINING`을 확인합니다.
5. 같은 Filter로 CSV를 다운로드합니다.
6. Seed를 재실행해 `already_seeded` no-op을 확인합니다.

이 절차 중 실제 Browser 동작 확인은 정적 빌드 완료와 별도의 검증 단계입니다.

## 전체 MVP 제외 범위

- 인증·인가, Workspace, RBAC
- WebSocket, 실시간 Push, polling 자동화
- 새로운 상태 관리·차트·UI Library 도입
- Dataset Import, 외부 Provider 설정 UI
- 삭제·복구 UI, bulk action
- SDK 생성, Offline mutation, 운영 URL
