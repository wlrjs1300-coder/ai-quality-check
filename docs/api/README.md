# Public API Documentation

EvalOps Backend의 공개 HTTP API 문서 진입점입니다. 현재 API는 인증 없이 로컬 환경에서 Project부터 평가 결과, 품질 게이트, 비교와 조회 리포트까지의 흐름을 제공합니다.

## 문서 목록

- [API Reference](API_REFERENCE.md): 전체 Endpoint와 요청·응답 계약
- [Error Reference](ERROR_REFERENCE.md): 오류 Envelope와 오류 코드
- [Demo Workflow](DEMO_WORKFLOW.md): Demo Seed와 권장 확인 순서

## 로컬 접근 경로

기본 Backend 주소는 `http://localhost:8000`입니다.

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- Health Check: `http://localhost:8000/health`

## 공통 규칙

- 공개 도메인 API prefix는 `/api/v1`입니다. `/health`만 prefix 밖에 있습니다.
- 생성은 `201`, 조회·수정·실행은 `200`을 반환합니다.
- 일반 단건 성공 응답은 `data`와 `meta.request_id`, 목록 응답은 여기에 `meta.pagination`을 포함합니다.
- `x-request-id` 요청 헤더가 있으면 성공 응답의 `meta.request_id`에 반영됩니다. 없으면 현재 구현의 로컬 기본값인 `local-request`가 사용됩니다. 응답 헤더로 Request ID를 제공하는 계약은 없습니다.
- `Decimal` 필드는 JSON 문자열로, UUID와 datetime은 문자열로 직렬화됩니다.
- 인증·인가, Workspace, RBAC는 현재 공개 API 범위에 포함되지 않습니다.

Dataset, Target, Evaluator의 Version은 생성 시점 Snapshot입니다. 수정·삭제 Endpoint를 제공하지 않으며, Experiment는 이 Version ID들을 고정해 재현 가능한 평가 단위를 구성합니다.
