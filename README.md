# FlowPilot

FlowPilot는 GitHub Actions 워크플로우를 브랜치 기준으로 시각화하고, CI 운영 관점의 리뷰 리포트로 해석하는 분석 애플리케이션입니다.  
단순 YAML 뷰어가 아니라, `workflow map`, `Job/Step 구조`, `run history`, `repo-aware CI review`를 한 화면 흐름으로 제공합니다.

## Executive Summary

조직 내 CI/CD 운영은 시간이 지날수록 아래 문제를 반복합니다.

- 워크플로우 파일 수가 늘어나며 전체 흐름이 보이지 않음
- 실패 원인과 병목 지점이 파일 단위로 흩어져 있음
- 보안, 최적화, 검증 범위를 사람이 일일이 읽어야 함

FlowPilot는 이 문제를 다음 방식으로 해결합니다.

1. 브랜치 기준 workflow 전체 흐름을 map으로 시각화
2. 선택 workflow의 Job Graph와 Workflow Source를 연결
3. run history와 CI 리뷰 리포트를 함께 제공
4. public/private 레포를 모두 지원하고 private 접근은 최소 권한 PAT로 제한

## Core Capabilities

- Branch-aware workflow discovery
- Workflow map filtering: `전체`, `머지 이전`, `머지 이후`, `수동/기타`
- Job Graph / Step 구조 시각화
- Workflow Source와 finding 연결
- CI review report 생성
- Public / Private GitHub repository access
- Gemini 기반 분석과 heuristic fallback
- HTML 리포트 export

## Solution Scope

현재 범위:

- GitHub Actions workflow 분석
- 브랜치별 구조 파악
- CI 관점 리뷰 리포트
- Docker 기반 배포 준비

현재 범위 밖:

- YAML 직접 편집
- PR 자동 생성
- 다중 CI 플랫폼 지원
- 장기 저장 사용자 계정 시스템

## Architecture Overview

```text
Browser
  ├─ GitHub REST API
  └─ FlowPilot Frontend (React/Vite)
        └─ FlowPilot Backend (NestJS)
              └─ Gemini API
```

구성 요소:

- `frontend/`
  React + Vite UI
- `backend/`
  NestJS API for analysis and recommendation
- `docs/`
  guide / architecture / planning documents
- `scripts/`
  local development and Docker orchestration scripts

세부 구조 문서:

- [사용 가이드](./docs/06-guide.md)
- [프론트엔드 아키텍처](./docs/07-frontend-architecture.md)
- [백엔드 아키텍처](./docs/08-backend-architecture.md)

## Deployment Readiness

현재 기준 배포 준비 상태:

- frontend Dockerfile 준비 완료
- backend Dockerfile 준비 완료
- `docker-compose.yml` 준비 완료
- Docker 시작/중지 스크립트 준비 완료
- root `lint`, `build`, `test` 기준 검증 완료

검증 명령:

```bash
pnpm lint
pnpm build
pnpm test
```

운영 주의:

- 현재 작업 환경에는 `docker` CLI가 없어 `docker compose up` 실기동 검증은 수행하지 못했습니다.
- 따라서 배포 파일은 준비됐지만, 실제 배포 대상 환경에서 컨테이너 기동 확인은 한 번 더 필요합니다.

## Security Posture

현재 보안 기본 원칙:

- public 레포는 토큰 없이 조회
- private 레포만 PAT 사용
- PAT는 세션 스토리지에 저장하지 않고 런타임 메모리에서만 사용
- `.env`, `.env.local`, `.flowpilot`는 git ignore 처리
- Docker compose에는 실제 키가 아니라 환경 변수 참조만 사용

권장 PAT 권한:

- `Metadata: Read-only`
- `Contents: Read-only`
- `Actions: Read-only`

관련 참고:

- [사용 가이드](./docs/06-guide.md)
- [backend/.env.example](./backend/.env.example)
- [docker-compose.yml](./docker-compose.yml)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install

```bash
pnpm install
```

### Local Development

시작:

```bash
pnpm dev:start
```

중지:

```bash
pnpm dev:stop
```

기본 주소:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

로그:

- `./.flowpilot/logs/frontend.log`
- `./.flowpilot/logs/backend.log`

### Docker Runtime

시작:

```bash
pnpm docker:start
```

중지:

```bash
pnpm docker:stop
```

기본 주소:

- frontend: `http://localhost:8080`
- backend health: `http://localhost:3001/api/health`

동작 방식:

- frontend는 nginx로 서빙됩니다.
- 브라우저의 `/api` 요청은 backend 컨테이너로 reverse proxy 됩니다.

## Environment Variables

주요 환경 변수:

| Variable | Scope | Default | Description |
| --- | --- | --- | --- |
| `PORT` | backend | `3001` | backend listen port |
| `FRONTEND_URL` | backend | `http://localhost:5173` | CORS allowed origin |
| `GEMINI_API_KEY` | backend | empty | Gemini analysis key |
| `GEMINI_MODEL` | backend | `gemini-2.5-flash` | Gemini model name |
| `VITE_API_URL` | frontend | empty | API base URL, empty면 same-origin `/api` 사용 |

## Operational Notes

운영 시 우선 확인할 항목:

1. `pnpm lint`
2. `pnpm build`
3. `pnpm test`
4. backend health endpoint 확인
5. public 레포 연결 확인
6. private 레포 + PAT + run history 확인

트러블슈팅:

- 포트 충돌: `pnpm dev:stop`
- private 레포는 열리는데 run history가 안 보임: PAT의 `Actions: Read-only` 권한 확인
- Docker 실행 실패: `docker` / `docker compose` 설치 여부와 포트 `8080`, `3001` 점검

## Documentation Index

운영/구조 문서:

- [06-guide.md](./docs/06-guide.md)
- [07-frontend-architecture.md](./docs/07-frontend-architecture.md)
- [08-backend-architecture.md](./docs/08-backend-architecture.md)

기획/계획 문서:

- [01-init-idea.md](./docs/01-init-idea.md)
- [02-mvp-requirements.md](./docs/02-mvp-requirements.md)
- [03-technical-design.md](./docs/03-technical-design.md)
- [04-implementation-plan.md](./docs/04-implementation-plan.md)
- [05-agile-delivery-plan.md](./docs/05-agile-delivery-plan.md)

## Repository Utilities

- [docker-start.sh](./scripts/docker-start.sh)
- [docker-stop.sh](./scripts/docker-stop.sh)
