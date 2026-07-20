## 목적

- [ ] v0.1.0 Repository Foundation 범위에 포함되는 작업인지 확인

## 변경 내용

- 파일/디렉토리 추가·수정:
- PR 범위 외 기능(도메인 API/인프라/보안 고도화) 미포함 여부 확인

## 생성/수정 파일

```text
# 예시
README.md
.gitignore
.env.example
scripts/check-repo-policy.ps1
scripts/check-git-author.ps1
```

## 검증

- [ ] 금지 파일명 검사
- [ ] `.env` 추적 검사
- [ ] 기본 Secret 패턴 검사
- [ ] 저장소 정책 스크립트 실행
- [ ] `git diff --check`

## 보안/정책 체크

- [ ] `.env` 또는 실제 Secret 값을 커밋하지 않았는지 확인
- [ ] AI 도구 로그/세션/임시작업 파일이 생성되지 않았는지 확인
- [ ] `Co-authored-by`/`Signed-off-by`/AI 자동 서명 문자열 미사용
- [ ] 작성자/커미터 설정 변경 없음
