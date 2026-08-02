# EvalOps 개발 로드맵

이 문서는 현재 구현 범위와 이후 개발 순서를 정리합니다. 포트폴리오 공개 시점에는 핵심 평가 흐름과 검증 결과를 기준으로 현재 상태를 설명하고, 운영 서비스에 필요한 기능은 후속 단계로 분리합니다.

## 현재 구현 범위

현재 버전에서는 다음 흐름을 실행할 수 있습니다.

```text
Project 생성
→ Dataset·Target·Evaluator 등록
→ 각 리소스의 Version 생성
→ Version 조합으로 Experiment 생성
→ Experiment 실행
→ Case별 결과 확인
→ Quality Gate 판정
→ Baseline Comparison
→ History와 CSV 확인
```

구현된 주요 범위:

- Project 생성, 수정, 비활성화
- Dataset과 Evaluation Case 관리
- Dataset, Target, Evaluator Version Snapshot
- Experiment 생성과 실행
- Case별 PASS, FAIL, ERROR 결과
- Quality Gate의 PASS, BLOCK 판정
- Baseline Comparison의 IMPROVED, UNCHANGED, REGRESSED 판정
- Experiment History와 CSV 내보내기
- 오류 상태, 404 복귀, 요청 취소, 페이지네이션
- 주요 화면의 반응형 및 키보드 회귀 검증

현재 버전은 평가 조건을 고정하고 결과를 비교하는 핵심 흐름에 집중합니다. 인증, 사용자별 데이터 분리, 외부 모델 연동, 비동기 실행, 운영 모니터링은 아직 포함하지 않습니다.

---

## 1단계. 포트폴리오 공개 준비

### 목표

현재 구현된 기능을 면접에서 설명할 수 있는 형태로 정리하고, 저장소와 시연 자료만으로 프로젝트 구조와 설계 의도를 이해할 수 있게 만듭니다.

### 작업 항목

- README를 현재 구현 상태에 맞게 정리
- 대표 화면 캡처
- 핵심 사용자 흐름 정리
- 아키텍처 문서 작성
- 주요 설계 결정 문서 작성
- 로컬 실행 절차 재검증
- Demo Seed 실행 절차 확인
- 주요 브라우저 테스트 재실행
- 문서와 실제 화면 용어 정합성 점검
- 공개 저장소의 Secret, 임시 파일, 테스트 산출물 점검

### 완료 조건

- README에서 프로젝트 목적, 기능, 구조, 실행 방법을 확인할 수 있음
- 핵심 흐름을 3분 안에 시연할 수 있음
- Typecheck, Lint, Build, Backend Test 통과
- 주요 Playwright 테스트 통과
- 저장소 링크와 문서 링크가 모두 정상
- 현재 한계와 후속 계획이 명확히 구분됨

---

## 2단계. 사용자와 권한

### 목표

한 명의 로컬 사용자를 전제로 한 구조를 실제 사용자 단위 서비스 구조로 확장합니다.

### 작업 항목

- 회원가입과 로그인
- 비밀번호 해시와 세션 또는 토큰 관리
- 사용자별 Project 분리
- Workspace 생성
- 사용자 초대
- 역할 기반 권한 관리
- Project 소유권과 접근 권한 검증
- Backend의 Project Scope 검증
- 인증 오류와 권한 오류 화면

### 설계 방향

현재 Frontend의 Project Scope 대조는 잘못 조합된 URL에서 리소스 노출을 줄이기 위한 방어적 처리입니다. 실제 권한 경계는 Backend에서 사용자와 Project 관계를 검증하는 방식으로 구현합니다.

### 완료 조건

- 로그인하지 않은 사용자는 보호된 API에 접근할 수 없음
- 사용자는 자신이 속한 Workspace와 Project만 조회할 수 있음
- 역할에 따라 조회, 수정, 실행 권한이 구분됨
- URL을 직접 변경해도 다른 사용자의 리소스가 노출되지 않음

---

## 3단계. 실행 구조 개선

### 목표

현재의 Inline 실행 구조를 장시간 작업과 재시도에 적합한 비동기 실행 구조로 전환합니다.

### 작업 항목

- 작업 Queue 도입
- Worker 프로세스 분리
- Experiment 실행 요청과 실제 실행 분리
- 중복 실행 방지
- 재시도 정책
- Timeout 정책
- 작업 취소
- 실행 상태 복구
- 실패 원인 기록
- Worker 재시작 후 작업 상태 복원

### 설계 방향

Redis는 작업 Queue와 상태 전달에 사용하고, 실행 결과의 기준 데이터는 PostgreSQL에 저장합니다. 브라우저 연결이 끊겨도 작업이 계속 진행되도록 실행 상태를 서버에서 관리합니다.

### 완료 조건

- 장시간 Experiment를 요청한 뒤 화면을 닫아도 작업이 계속됨
- 같은 Experiment에 대한 중복 실행이 차단됨
- 실패한 작업의 원인과 재시도 여부를 확인할 수 있음
- Worker 재시작 이후에도 실행 상태가 유실되지 않음

---

## 4단계. 외부 모델 연동

### 목표

현재 MOCK Target을 실제 모델 API와 연결할 수 있도록 Target 실행 구조를 확장합니다.

### 작업 항목

- Provider 추상화
- 외부 모델 API Credential 관리
- Provider별 Target 설정
- 요청 Timeout과 재시도
- Rate Limit 대응
- 응답 본문과 메타데이터 저장
- 비용과 토큰 사용량 기록
- 실패 유형 표준화
- Provider별 연결 테스트

### 설계 방향

Target Type과 실행 전략을 분리하고, Experiment는 특정 Provider 구현이 아니라 Target Version 계약을 참조하도록 유지합니다.

### 완료 조건

- 하나 이상의 외부 모델 Provider를 통해 Experiment 실행 가능
- Credential이 저장소나 로그에 노출되지 않음
- Timeout, Rate Limit, Provider 오류가 구분되어 기록됨
- 실행 비용과 사용량을 Experiment 단위로 확인할 수 있음

---

## 5단계. 평가 기능 확장

### 목표

현재의 문자열 기반 평가기를 넘어 다양한 평가 방식과 데이터 입력 방식을 지원합니다.

### 작업 항목

- Evaluator 유형 추가
- 수치 점수 기반 Evaluator
- 복수 Evaluator 조합
- Dataset 파일 가져오기
- 대량 Case 등록
- Case 검색과 필터
- 비교 이력 조회
- 결과 정렬과 필터
- 실패 Case 재실행
- 평가 결과 요약 개선

### 완료 조건

- 여러 Evaluator를 조합한 Experiment 실행 가능
- 대량 Dataset을 화면 또는 파일로 등록 가능
- 실패와 회귀 Case를 빠르게 찾을 수 있음
- 같은 조건의 과거 비교 결과를 다시 조회할 수 있음

---

## 6단계. 운영 환경

### 목표

개발 환경을 실제 사용자를 받을 수 있는 운영 환경으로 확장합니다.

### 작업 항목

- Staging과 Production 환경 분리
- 자동 배포
- Database Backup
- Database Restore 점검
- 구조화 로그
- 오류 수집
- 지표 수집
- 장애 알림
- Health와 Readiness 분리
- 부하 테스트
- Secret 관리
- 운영 Runbook
- 장애 복구 절차

### 완료 조건

- 변경 사항이 Staging 검증 후 Production에 배포됨
- Database Backup과 Restore가 실제로 검증됨
- 오류와 성능 저하를 운영 화면에서 확인할 수 있음
- 주요 장애 발생 시 알림을 받을 수 있음
- 운영자가 문서만 보고 기본 장애 대응을 수행할 수 있음

---

## 우선순위

```text
포트폴리오 공개 준비
→ 사용자와 권한
→ 비동기 실행
→ 외부 모델 연동
→ 평가 기능 확장
→ 운영 환경 고도화
```

이 순서는 현재 구조의 신뢰성을 유지하면서 실제 사용자와 실행 규모를 단계적으로 늘리기 위한 기준입니다.
