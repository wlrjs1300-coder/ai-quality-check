# EvalOps Monorepo (v0.1.0 Foundation)

이 저장소는 Core MVP 구현 전단계로, **Repository & Local Foundation(v0.1.0)** 범위에 맞는 최소 골격만 제공합니다.

## Scope (v0.1.0)

- Monorepo 기본 구조 정리
- Root 문서/정책 템플릿 정리
- 인프라 기초 초기화 전 단계의 폴더 구성
- `.gitignore`, `.env.example` 기초 정비
- 저장소 정책 점검 스크립트 골격
- 최소 Placeholder 디렉터리 구성

## 제외 범위

다음 항목은 이후 마일스톤에서 별도 PR로 진행합니다.

- Next.js/FastAPI 실제 초기화
- PostgreSQL/Redis/MinIO/Alembic 설정
- OAuth, 사용자/도메인 테이블, API, 실험 파이프라인
- OpenAI/LangChain/LangGraph, Celery/Worker
- RLS, Usage, Audit 조회/API
- CI 파이프라인 및 배포 파이프라인

## Repository Layout

```text
apps/
└── web/
backend/
└── src/
    ├── api/
    ├── domain/
    ├── application/
    ├── infrastructure/
    ├── evaluators/
    ├── providers/
    ├── workflows/
    └── workers/
packages/
├── cli/
└── generated-api-client/
infra/
docs/
scripts/
.github/
```

## Scripts

- `scripts/check-repo-policy.ps1`: 저장소 보안/정책 검사 골격
- `scripts/check-git-author.ps1`: 로컬 Git 작성자 점검 스크립트 골격

## 사용 전 주의

- `.env`, 실제 Secret, 고객 데이터, 운영 정보는 생성/커밋하지 않습니다.
- `.env.example`에는 값이 아닌 placeholder만 둡니다.
