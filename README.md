# FlowPilot

GitHub Actions 워크플로우를 시각화하고 분석하는 웹 애플리케이션.

## 1. Workspace

- `frontend/` - React + Vite 기반 UI
- `backend/` - NestJS 기반 API
- `docs/` - 제품/설계/개발 문서

## 2. 요구 사항

- Node.js 20+
- pnpm 10+

## 3. 설치

```bash
pnpm install
```

## 4. 실행

대화형 개발 실행:

```bash
pnpm dev
```

백그라운드 실행:

```bash
pnpm dev:start
```

중지:

```bash
pnpm dev:stop
```

로그 위치:

- `./.flowpilot/logs/frontend.log`
- `./.flowpilot/logs/backend.log`

기본 주소:

- 프론트엔드: `http://localhost:5173`
- 백엔드: `http://localhost:3001`

### 포트 충돌 시

기본 포트 `5173`, `3001`이 이미 사용 중이면 실행이 실패할 수 있습니다.

정리:

```bash
pnpm dev:stop
```

다시 실행:

```bash
pnpm dev:start
```

## 5. 환경 변수

프론트엔드:

```bash
cp frontend/.env.example frontend/.env
```

백엔드:

```bash
cp backend/.env.example backend/.env
```

실제 연동 시 필요한 값:

- GitHub PAT
- `GEMINI_API_KEY`

## 6. 개발 흐름

1. `pnpm install`
2. `pnpm dev:start`
3. 프론트 화면 확인
4. 필요 시 `pnpm dev:stop`

## 7. Docker 배포

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

참고:

- 프론트는 nginx로 서빙되고 `/api` 요청은 backend 컨테이너로 프록시됩니다.
- `GEMINI_API_KEY`가 있으면 `docker compose` 실행 시 backend 컨테이너에 전달됩니다.

## 8. 현재 상태

- GitHub 레포 연결과 워크플로우 목록 조회가 동작함
- 브랜치 선택 후 해당 브랜치 기준으로 워크플로우를 다시 로드할 수 있음
- 워크플로우 파일 중심 overview 맵과 선택된 워크플로우의 Job DAG, 선택 Job의 Step flow가 동작함
- 브랜치 로딩 중 진행 상태를 프로그레스 바로 표시함
- 실행 이력과 AI 분석 패널은 아직 목업 상태임
- 백엔드는 `/api/health`, `/api/analyze` 스텁이 준비되어 있음
