# FlowPilot

FlowPilot는 GitHub Actions 워크플로우를 브랜치 기준으로 시각화하고, CI 리뷰 리포트로 분석하는 애플리케이션입니다.

레포를 연결하면 다음 흐름으로 볼 수 있습니다.

- workflow map
- 선택한 workflow의 Job Graph
- 최근 run history
- workflow source
- CI 관점 리뷰 리포트

## Features

- Public / Private GitHub repository 연결
- 브랜치별 workflow 탐색
- `전체`, `머지 이전`, `머지 이후`, `수동/기타` 필터
- Job / Step 구조 시각화
- run history 조회
- source와 연결되는 finding 기반 리뷰
- Gemini 기반 분석 + heuristic fallback
- HTML 리포트 export

## Tech Stack

- Frontend: React 18, TypeScript, Vite, `react-force-graph-2d`
- Backend: NestJS, TypeScript
- Infra: Docker, Docker Compose, nginx

## Project Structure

```text
flowpilot/
├── frontend/   # React + Vite UI
├── backend/    # NestJS API
├── docs/       # guide / architecture / planning docs
├── scripts/    # local and docker scripts
└── README.md
```

## Getting Started

### Requirements

- Node.js 20+
- pnpm 10+

### Install

```bash
pnpm install
```

### Local Development

Start:

```bash
pnpm dev:start
```

Stop:

```bash
pnpm dev:stop
```

URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Logs:

- `./.flowpilot/logs/frontend.log`
- `./.flowpilot/logs/backend.log`

## Docker

Start:

```bash
pnpm docker:start
```

Stop:

```bash
pnpm docker:stop
```

URLs:

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:3001/api/health`

Notes:

- frontend는 nginx로 서빙됩니다.
- `/api` 요청은 backend 컨테이너로 프록시됩니다.
- `GEMINI_API_KEY`가 있으면 backend 분석 기능이 활성화됩니다.

## Environment Variables

| Variable | Scope | Default | Description |
| --- | --- | --- | --- |
| `PORT` | backend | `3001` | backend listen port |
| `FRONTEND_URL` | backend | `http://localhost:5173` | backend CORS origin |
| `GEMINI_API_KEY` | backend | empty | Gemini API key |
| `GEMINI_MODEL` | backend | `gemini-2.5-flash` | Gemini model |
| `VITE_API_URL` | frontend | empty | API base URL, empty면 same-origin `/api` |

## Security Notes

- public 레포는 토큰 없이 조회합니다.
- private 레포에서만 PAT를 사용합니다.
- PAT는 브라우저 세션 스토리지에 저장하지 않습니다.
- 권장 PAT 권한:
  - `Metadata: Read-only`
  - `Contents: Read-only`
  - `Actions: Read-only`

## Verification Status

현재 기준 확인된 항목:

- `pnpm lint`
- `pnpm build`
- `pnpm test`

주의:

- 현재 작업 환경에는 `docker` CLI가 없어 `docker compose up` 실기동 검증은 별도로 못 했습니다.

## Documentation

Guide / Architecture:

- [사용 가이드](./docs/06-guide.md)
- [프론트엔드 아키텍처](./docs/07-frontend-architecture.md)
- [백엔드 아키텍처](./docs/08-backend-architecture.md)

Planning:

- [01-init-idea.md](./docs/01-init-idea.md)
- [02-mvp-requirements.md](./docs/02-mvp-requirements.md)
- [03-technical-design.md](./docs/03-technical-design.md)
- [04-implementation-plan.md](./docs/04-implementation-plan.md)
- [05-agile-delivery-plan.md](./docs/05-agile-delivery-plan.md)

## Scripts

- [docker-start.sh](./scripts/docker-start.sh)
- [docker-stop.sh](./scripts/docker-stop.sh)
