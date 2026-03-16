# FlowPilot

FlowPilot는 GitHub Actions 워크플로우를 브랜치 기준으로 시각화하고, CI 관점의 리뷰 리포트로 분석하는 애플리케이션입니다.

레포를 연결하면 아래 흐름으로 탐색할 수 있습니다.

- 브랜치별 workflow map
- 선택한 workflow의 Job Graph
- 최근 run history
- workflow source
- CI 리뷰 리포트 및 시각 대시보드

## Features

- Public / Private GitHub repository 연결
- 브랜치별 workflow 탐색
- `전체`, `머지 이전`, `머지 이후`, `수동/기타` 필터
- 명시 관계 + 추론 흐름 기반 workflow map
- Job / Step 구조 시각화
- run history 조회
- source와 연결되는 finding 기반 리뷰
- Gemini 기반 분석 + heuristic fallback
- Workflow inventory / phase distribution / risk matrix / heatmap 기반 리포트
- optimization table / repository coverage matrix / failure snapshot 제공
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

## Requirements

- Node.js 20+
- pnpm 10+

## Installation

```bash
pnpm install
```

## Environment Variables

FlowPilot는 프론트와 백엔드가 분리되어 있어, 환경변수도 파일 위치가 다릅니다.

### 1. Backend

파일 위치:

- `backend/.env`

예시 파일:

- `backend/.env.example`

생성:

```bash
cp backend/.env.example backend/.env
```

기본 예시:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=
```

설명:

- `PORT`
  backend 포트입니다.
- `FRONTEND_URL`
  backend CORS 허용 origin 입니다.
- `GEMINI_API_KEY`
  Gemini 분석을 사용할 때만 넣습니다. 비워 두면 heuristic fallback만 사용합니다.

### 2. Frontend

파일 위치:

- `frontend/.env`

예시 파일:

- `frontend/.env.example`

생성:

```bash
cp frontend/.env.example frontend/.env
```

기본 예시:

```env
PORT=5173
VITE_API_URL=http://localhost:3001
```

설명:

- `PORT`
  frontend dev server 포트입니다.
- `VITE_API_URL`
  frontend가 호출할 backend 주소입니다.
- 로컬 개발에서는 보통 `http://localhost:3001`
- Docker/nginx reverse proxy 환경에서는 비워 두거나 `/api` 기반 same-origin 구성을 사용합니다.

로컬 `pnpm dev:start` / `pnpm dev:stop`는 각 서비스의 `.env`를 우선 읽고, 파일이 없으면 `.env.example` 값을 기본값으로 사용합니다.

### 3. Docker 실행 시

`docker-compose.yml`은 `GEMINI_API_KEY`를 현재 쉘 환경에서 읽습니다.

즉 Docker 기준으로는 `backend/.env`를 직접 읽는 방식이 아니라, 실행 전에 쉘에 export 하거나 `.env` 파일을 루트 기준으로 두는 방식이 필요할 수 있습니다.

가장 단순한 방법:

```bash
export GEMINI_API_KEY=your_key
docker compose up -d --build
```

현재 compose에서 사용하는 값:

- `GEMINI_API_KEY`

## Local Development

Start:

```bash
pnpm dev:start
```

Stop:

```bash
pnpm dev:stop
```

기본 주소:

- Frontend: `frontend/.env`의 `PORT` 값, 없으면 `5173`
- Backend: `backend/.env`의 `PORT` 값, 없으면 `3001`

로그:

- `./.flowpilot/logs/frontend.log`
- `./.flowpilot/logs/backend.log`

## Usage Flow

1. Repository URL을 입력합니다.
2. Public / Private 여부를 선택합니다.
3. Private 레포라면 `GitHub Username`, `PAT`를 입력합니다.
4. 브랜치를 선택하면 workflow map과 리뷰 리포트가 생성됩니다.
5. workflow map에서 노드를 클릭하면 상세 drawer가 열립니다.
6. 리포트에서 finding을 클릭하면 해당 workflow source 위치로 이동할 수 있습니다.

리포트에서 확인할 수 있는 주요 시각 요소:

- `Phase Distribution`
  현재 브랜치의 workflow가 머지 전 / 머지 후 / 수동 흐름에 어떻게 분포하는지 보여줍니다.
- `Workflow Risk Matrix`
  각 workflow를 `job 수`와 `위험도` 기준으로 배치해 어느 workflow가 크고 위험한지 빠르게 파악하게 합니다.
- `Workflow Inventory`
  workflow별 trigger, 역할, risk, 예상 시간, 최근 실패를 표로 정리합니다.
- `Category Heatmap`
  보안, 안정성, 최적화, 중복, 검증 범위 관점에서 workflow별 경고 밀도를 보여줍니다.
- `Repository Coverage Matrix`
  레포 특성과 현재 CI 구성 사이의 적합도와 공백을 보여줍니다.

## Docker

Start:

```bash
pnpm docker:start
```

Stop:

```bash
pnpm docker:stop
```

직접 실행:

```bash
docker compose up -d --build
docker compose down
```

기본 주소:

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:3001/api/health`

동작 방식:

- frontend는 nginx로 서빙됩니다.
- 브라우저의 `/api` 요청은 backend 컨테이너로 reverse proxy 됩니다.

## Security Notes

- public 레포는 토큰 없이 조회합니다.
- private 레포에서만 PAT를 사용합니다.
- PAT는 브라우저 세션 스토리지에 저장하지 않습니다.
- private 레포에서 workflow source는 읽히는데 run history가 안 보이면 `Actions: Read-only` 권한 부족일 가능성이 큽니다.
- 권장 PAT 권한:
  - `Metadata: Read-only`
  - `Contents: Read-only`
  - `Actions: Read-only`

## Available Scripts

```bash
pnpm dev:start
pnpm dev:stop
pnpm docker:start
pnpm docker:stop
pnpm lint
pnpm build
pnpm test
```

## Verification Status

현재 기준 확인된 항목:

- `pnpm lint`
- `pnpm build`
- `pnpm test`

주의:

- 현재 작업 환경에서는 `docker compose up` 실기동 검증은 별도로 하지 못했습니다.

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
