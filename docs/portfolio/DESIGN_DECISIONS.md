# EvalOps 설계 결정

이 문서는 EvalOps를 구현하면서 선택한 주요 구조와 그 이유를 정리합니다. 각 결정은 현재 구현 범위와 이후 확장 계획을 함께 고려한 결과입니다.

## 1. Dataset, Target, Evaluator를 분리한 이유

평가 데이터, 실행 대상, 판정 기준은 서로 변경 주기가 다릅니다.

- Dataset은 질문과 기대 조건이 바뀔 때 수정됩니다.
- Target은 모델이나 응답 설정이 바뀔 때 수정됩니다.
- Evaluator는 통과 기준이 바뀔 때 수정됩니다.

세 요소를 하나의 설정으로 묶으면 일부만 변경해도 전체 조합을 다시 만들어야 하고, 어떤 변경이 결과에 영향을 줬는지 추적하기 어렵습니다.

따라서 세 리소스를 독립적으로 관리하고, Experiment에서 필요한 Version을 조합하도록 구성했습니다.

### 얻은 효과

- 변경 원인을 구분할 수 있음
- 같은 Dataset으로 여러 Target 비교 가능
- 같은 Target에 여러 Evaluator 적용 가능
- Version 조합을 기준으로 실행 조건 추적 가능

---

## 2. 원본과 Version을 분리한 이유

원본 리소스는 수정될 수 있지만, 이미 실행한 Experiment의 조건은 바뀌면 안 됩니다.

예를 들어 Target 설정을 수정했을 때 과거 Experiment가 현재 설정을 참조한다면, 당시 실행 조건을 다시 확인할 수 없습니다.

이를 막기 위해 다음 구조를 사용했습니다.

```text
변경 가능한 원본
→ Version 생성
→ 변경할 수 없는 Snapshot
→ Experiment에서 Version 참조
```

### 적용 대상

- Dataset Version
- Target Version
- Evaluator Version

### 설계 원칙

- Version 생성 후 수정과 삭제를 허용하지 않음
- 생성 시점 설정과 Hash를 보존
- Experiment는 원본 ID가 아니라 Version ID를 참조
- 과거 실행 결과는 원본 변경의 영향을 받지 않음

---

## 3. Dataset Version에 승인된 Case만 포함한 이유

작성 중인 Case와 실제 평가에 사용할 Case를 구분할 필요가 있습니다.

Evaluation Case 상태는 다음과 같습니다.

```text
DRAFT
APPROVED
DEPRECATED
```

`DRAFT`는 수정 중인 데이터이므로 평가 기준으로 사용하지 않습니다. `APPROVED`만 Dataset Version에 포함해 평가 기준을 명확하게 고정합니다.

`DEPRECATED`는 과거 이력 확인을 위해 남겨두지만, 새 Version에는 포함하지 않습니다.

### 얻은 효과

- 작성 중인 Case가 실수로 평가에 포함되는 문제 방지
- 승인 시점을 기준으로 평가 기준 확정
- 과거 Case 이력 유지
- Dataset Version 재현성 확보

---

## 4. Experiment가 Version ID를 참조하는 이유

Experiment는 다음 세 Version의 조합입니다.

```text
Dataset Version
Target Version
Evaluator Version
```

이 구조는 어떤 데이터와 설정으로 실행했는지 명확하게 남깁니다.

원본 리소스 ID만 저장하면 이후 수정된 값과 당시 실행값을 구분할 수 없습니다. Version ID를 저장하면 실행 조건이 고정되고, 같은 조건의 재검증과 결과 비교가 쉬워집니다.

### 완료 조건으로 사용한 기준

- Experiment 상세에서 사용한 Version 확인 가능
- 원본 변경 이후에도 과거 결과 해석 가능
- Comparison에서 Dataset Version 일치 여부 검증 가능
- 입력과 출력 Snapshot 보존 가능

---

## 5. Quality Gate와 Baseline Comparison을 분리한 이유

두 기능은 비슷해 보이지만 판단 목적이 다릅니다.

### Quality Gate

현재 Experiment가 정해진 최소 기준을 통과했는지 판단합니다.

주요 기준:

- 최소 통과율
- Error 발생 여부
- 필수 Case 실패 여부

결과:

```text
PASS
BLOCK
```

### Baseline Comparison

현재 Experiment가 이전 Experiment보다 좋아졌는지 판단합니다.

비교 기준:

- 같은 Project
- 같은 Dataset Version
- 동일한 Case 결과 집합

결과:

```text
IMPROVED
UNCHANGED
REGRESSED
```

### 분리한 이유

Quality Gate는 절대 기준이고, Baseline Comparison은 상대 기준입니다.

하나의 결과가 Gate를 통과해도 이전보다 성능이 떨어질 수 있고, 반대로 이전보다 개선됐어도 최소 기준에는 못 미칠 수 있습니다.

두 판단을 분리해야 배포 가능 여부와 변화 방향을 각각 설명할 수 있습니다.

---

## 6. Frontend에서 Backend 판정을 다시 계산하지 않는 이유

상태 전이, Gate 결과, Comparison 결과를 Frontend에서 다시 계산하면 Backend와 화면의 기준이 달라질 수 있습니다.

따라서 책임을 다음처럼 나눴습니다.

### Backend

- 상태 전이 검증
- Version Snapshot 생성
- Experiment 실행
- Case별 결과 생성
- Gate 판정
- Comparison 판정
- 오류 코드 결정

### Frontend

- 요청과 응답 처리
- Loading, Empty, Refreshing, Error 상태 표시
- 사용자 입력과 Action 관리
- 결과와 복구 경로 표시
- Backend 오류 코드를 화면 메시지로 변환

### 얻은 효과

- 판정 기준이 한 곳에 유지됨
- API와 화면 결과 불일치 방지
- Backend Test로 핵심 규칙 검증 가능
- Frontend는 사용자 경험에 집중 가능

---

## 7. 상태 전이를 제한한 이유

현재 구현에서는 다음 동작을 제한합니다.

- 승인되거나 폐기된 Case 수정
- 비활성 리소스 변경
- Experiment 재실행
- 같은 Policy와 Experiment의 Gate 중복 평가
- 같은 Baseline·Current Experiment 쌍의 Comparison 중복 생성

이 제한은 사용 편의보다 결과의 일관성을 우선한 결정입니다.

평가 결과는 과거 조건을 설명할 수 있어야 하므로, 이미 결과에 영향을 준 리소스를 자유롭게 바꾸지 않도록 했습니다.

---

## 8. 자동 재시도를 제한한 이유

GET 요청은 실패해도 다시 조회하면 되지만, 생성이나 실행 요청은 이미 서버에 반영됐을 가능성이 있습니다.

네트워크 응답이 끊겼다는 이유만으로 같은 요청을 자동 재전송하면 다음 문제가 생길 수 있습니다.

- 중복 Version 생성
- Experiment 중복 실행
- Policy 중복 생성
- Comparison 중복 생성

따라서 Mutation은 자동 재시도하지 않습니다.

### 처리 원칙

- 결과를 먼저 재조회
- 이미 반영된 경우 기존 결과 복구
- 상태를 확정할 수 없으면 사용자에게 재시도 안내
- Backend의 중복 오류를 기준으로 최신 상태 확인

---

## 9. 요청 취소와 최신 응답 보호를 함께 사용한 이유

요청 취소만으로는 모든 이전 응답을 완전히 막을 수 없습니다. 이미 응답이 도착했거나 취소 시점이 늦으면 오래된 응답이 화면에 반영될 수 있습니다.

따라서 다음 방식을 함께 사용했습니다.

- `AbortController`로 이전 요청 취소
- 요청 ID 증가
- 현재 Controller와 응답 Controller 비교
- Unmount 시 요청 무효화
- 마지막 요청만 상태에 반영

이 방식은 빠른 화면 이동, 연속 페이지 이동, 재시도 상황에서 이전 응답이 최신 화면을 덮는 문제를 줄입니다.

---

## 10. 페이지네이션을 공통 컴포넌트로 분리한 이유

페이지네이션이 여러 화면에 각각 구현되면 다음 동작이 달라질 수 있습니다.

- 전체 건수 표시
- 현재 페이지 표시
- 첫·마지막 페이지 버튼 상태
- Loading 중 중복 입력 차단
- 한 페이지 목록 표시 여부
- 접근성 이름

공통 컴포넌트는 표시와 입력 계약을 통일하고, 각 화면은 데이터 요청과 상태 관리에 집중하도록 했습니다.

### 공통 범위

- 이전·다음 버튼
- 전체 건수
- 현재 페이지와 전체 페이지
- Loading 상태
- 첫·마지막 페이지 Disabled
- 접근성 이름

### 화면별 유지 범위

- URL Query 반영 여부
- Abort 처리
- 기존 데이터 유지
- 생성 후 1페이지 복귀
- 범위 초과 페이지 보정

---

## 11. Frontend Project Scope 대조를 넣은 이유

현재 일부 단건 API는 Resource ID만으로 조회하며, Backend 권한 검사는 아직 구현하지 않았습니다.

Frontend에서는 URL의 Project ID와 응답 Resource의 Project ID를 비교해 잘못 조합된 경로에서 리소스가 그대로 노출되지 않도록 했습니다.

이 처리는 보안 경계가 아니라 방어적 화면 처리입니다.

### 현재 역할

- 잘못된 URL 조합 차단
- 실제 Resource 정보 노출 최소화
- 상위 화면 복귀 제공

### 후속 계획

실제 권한 검사는 Backend에서 사용자, Workspace, Project 관계를 확인하는 방식으로 구현할 예정입니다.

---

## 12. Demo Seed를 결정론적으로 만든 이유

Demo 환경은 반복 실행해도 같은 흐름을 재현할 수 있어야 합니다.

Demo Seed는 다음 원칙을 사용합니다.

- 고정된 정의
- 중복 데이터 생성 방지
- 기존 데이터와 정의가 다르면 덮어쓰지 않음
- 충돌 시 명확한 오류 반환
- PASS, BLOCK, IMPROVED, UNCHANGED, REGRESSED 시나리오 포함

이 방식은 시연 준비와 회귀 검증에서 데이터 상태가 예측 가능하도록 돕습니다.

---

## 13. 현재 Inline 실행을 유지한 이유

현재 단계에서는 전체 평가 흐름과 데이터 계약을 먼저 검증하는 것이 우선이었습니다.

비동기 Worker를 먼저 도입하면 Queue, 재시도, 상태 복구, 취소 정책까지 함께 결정해야 하므로 구현 범위가 크게 늘어납니다.

따라서 현재는 Inline 실행으로 다음을 먼저 검증했습니다.

- Version 조합
- Case 순회
- Target 실행
- Evaluator 판정
- Result 저장
- Gate와 Comparison 연결

후속 단계에서는 이 계약을 유지한 채 Worker와 Queue 구조로 실행 방식을 교체할 예정입니다.

---

## 정리

EvalOps의 핵심 설계 기준은 다음과 같습니다.

```text
변경 가능한 원본과 불변 Version 분리
판정 책임은 Backend에 집중
Experiment는 Version 조합으로 구성
절대 기준과 상대 비교 분리
Mutation은 자동 재시도하지 않음
오래된 응답이 최신 상태를 덮지 않도록 보호
현재 한계와 보안 경계를 명확히 구분
```

이 기준을 유지하면서 사용자·권한, 비동기 실행, 외부 모델 연동, 운영 기능을 단계적으로 추가할 예정입니다.
