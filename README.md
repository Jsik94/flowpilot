# FlowPilot

GitHub Actions 워크플로우를 브랜치 기준으로 시각화하고, CI 리뷰 리포트로 해석하는 웹 애플리케이션입니다.

## 1. 현재 배포 준비 상태

현재 기준으로 배포 준비는 아래까지 완료됐습니다.

- 프론트엔드/백엔드 Dockerfile 작성
- `docker-compose.yml` 작성
- Docker 시작/종료 스크립트 작성
- 루트 `lint`, `build` 통과 확인

검증 완료:

```bash
pnpm lint
pnpm build
pnpm test
```

주의:

- 이 작업 환경에는 `docker` CLI가 없어 `docker compose up` 자체는 실제 실행 검증하지 못했습니다.
- 즉, 배포 파일은 준비됐지만 컨테이너 런타임 검증은 배포 대상 환경에서 한 번 더 확인해야 합니다.

## 2. 프로젝트 구성

- `frontend/` : React + Vite 기반 UI
- `backend/` : NestJS 기반 API
- `docs/` : 기획, 가이드, 아키텍처 문서
- `scripts/` : 개발/배포 실행 스크립트

## 3. 빠른 시작

요구 사항:

- Node.js 20+
- pnpm 10+

설치:

```bash
pnpm install
```

개발 실행:

```bash
pnpm dev:start
```

중지:

```bash
pnpm dev:stop
```

기본 주소:

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:3001`

## 4. Docker 실행

실행:

```bash
pnpm docker:start
```

중지:

```bash
pnpm docker:stop
```

기본 주소:

- 프론트엔드: `http://localhost:8080`
- 백엔드 헬스체크: `http://localhost:3001/api/health`

동작 방식:

- 프론트는 nginx로 서빙됩니다.
- 브라우저의 `/api` 요청은 backend 컨테이너로 reverse proxy 됩니다.
- `GEMINI_API_KEY`가 설정돼 있으면 backend에서 Gemini 분석을 활성화합니다.

## 5. 주요 기능

- 브랜치별 workflow 목록 로딩
- workflow map 시각화
- `머지 이전`, `머지 이후`, `수동/기타` 필터
- workflow 선택 시 Job Graph / Run History / Workflow Source 표시
- CI 리뷰 리포트 생성
- public/private 레포 접근 가이드와 PAT 안내

## 6. 환경 변수

주요 환경 변수:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` 선택 사항, 기본값 `gemini-2.5-flash`
- `PORT` backend 포트, 기본값 `3001`
- `FRONTEND_URL` backend CORS 허용 origin
- `VITE_API_URL` frontend API base URL, 기본값 same-origin

## 7. 문서

핵심 문서:

- [사용 가이드](/Users/new/dev/project/flowpilot/docs/06-guide.md)
- [프론트엔드 아키텍처](/Users/new/dev/project/flowpilot/docs/07-frontend-architecture.md)
- [백엔드 아키텍처](/Users/new/dev/project/flowpilot/docs/08-backend-architecture.md)

기존 기획 문서:

- [01-init-idea.md](/Users/new/dev/project/flowpilot/docs/01-init-idea.md)
- [02-mvp-requirements.md](/Users/new/dev/project/flowpilot/docs/02-mvp-requirements.md)
- [03-technical-design.md](/Users/new/dev/project/flowpilot/docs/03-technical-design.md)
- [04-implementation-plan.md](/Users/new/dev/project/flowpilot/docs/04-implementation-plan.md)
- [05-agile-delivery-plan.md](/Users/new/dev/project/flowpilot/docs/05-agile-delivery-plan.md)

## 8. 참고

- 로컬 개발 로그: `./.flowpilot/logs/`
- Docker 실행 스크립트:
  - [docker-start.sh](/Users/new/dev/project/flowpilot/scripts/docker-start.sh)
  - [docker-stop.sh](/Users/new/dev/project/flowpilot/scripts/docker-stop.sh)
