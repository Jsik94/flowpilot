# FlowPilot Guide

## 1. 문서 목적

이 문서는 FlowPilot를 실제로 사용하는 사람을 위한 실행 가이드입니다.
설치, 개발 실행, Docker 실행, public/private 레포 연결, 문제 해결까지 포함합니다.

## 2. 사용 시나리오

FlowPilot는 아래 흐름으로 사용합니다.

1. GitHub 레포 URL을 입력한다.
2. 레포를 `public` 또는 `private` 모드로 선택한다.
3. 필요 시 PAT를 입력한다.
4. 브랜치를 선택한다.
5. workflow map에서 전체 흐름을 본다.
6. 특정 workflow를 눌러 Job Graph, Run History, Workflow Source를 확인한다.
7. 아래 리포트에서 시각 대시보드와 CI 관점의 문제점, 최적화 포인트를 읽는다.

## 3. 설치

필수:

- Node.js 20+
- pnpm 10+

설치:

```bash
pnpm install
```

## 4. 로컬 개발 실행

실행:

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

## 5. Docker 실행

실행:

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

구성:

- frontend는 nginx로 정적 파일을 서빙합니다.
- `/api` 요청은 backend 컨테이너로 프록시됩니다.
- Gemini 키는 backend 컨테이너 환경 변수로 전달됩니다.

## 6. Public / Private 레포 연결 방식

### 6.1 Public

- `Repository Visibility`를 `Public`으로 둡니다.
- PAT 없이 바로 레포를 조회합니다.
- 숨겨져 있던 PAT 값이 있어도 public 모드에서는 요청에 사용하지 않습니다.

### 6.2 Private

- `Repository Visibility`를 `Private`로 바꿉니다.
- `GitHub Username`, `Personal Access Token` 입력칸이 나타납니다.
- PAT에는 최소한 아래 읽기 권한이 필요합니다.
  - `Metadata: Read-only`
  - `Contents: Read-only`
  - `Actions: Read-only`
- PAT는 브라우저 세션 스토리지에 저장하지 않고 현재 실행 메모리에서만 사용합니다.

중요:

- private 레포는 source만 읽히고 run history가 막힐 수 있습니다.
- 이 경우 PAT 권한에 `Actions: Read-only`가 빠졌을 가능성이 큽니다.

## 7. 화면 읽는 순서

### 7.1 상단 연결 패널

- 레포 URL 입력
- public/private 선택
- private일 때만 인증 입력
- 현재 연결 상태와 접근 가이드 확인

### 7.2 Workflow Map

- 브랜치 전체 workflow 흐름을 봅니다.
- `전체`, `머지 이전`, `머지 이후`, `수동/기타` 필터로 분기해서 볼 수 있습니다.
- 실선은 명시된 연결이고, 점선은 이름/trigger/branch rule을 바탕으로 추론한 흐름입니다.

### 7.3 Detail Drawer

workflow를 선택하면 드로어가 열립니다.

- `Workflow Summary`
- `Graph`
- `Run History`
- `Workflow Source`

### 7.4 Review Report

맵 아래의 리포트는 구조 요약이 아니라 실제 CI 리뷰 문서입니다.

- 상단 `Phase Distribution`, `Workflow Risk Matrix` 시각 대시보드
- `Workflow Inventory` 표
- `Category Heatmap`
- `Repository Coverage Matrix`
- `Optimization Table`
- 우선순위 액션
- 카테고리별 평가와 heatmap
- workflow별 상세
- source 연결 finding

## 8. 환경 변수

backend:

- `PORT` 기본값 `3001`
- `FRONTEND_URL` 기본값 `http://localhost:5173`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` 기본값 `gemini-2.5-flash`

frontend:

- `VITE_API_URL`
- 값이 없으면 same-origin `/api`를 기본으로 사용합니다.

## 9. 문제 해결

### 9.1 포트 충돌

```bash
pnpm dev:stop
```

후 다시 실행합니다.

### 9.2 private 레포는 열리는데 run history가 안 보임

확인 항목:

1. PAT가 실제로 입력됐는지
2. PAT에 `Actions: Read-only` 권한이 있는지
3. rate limit 또는 repo 권한 제한이 아닌지

### 9.3 Docker 실행이 안 됨

확인 항목:

1. `docker`와 `docker compose`가 설치돼 있는지
2. 포트 `8080`, `3001`이 비어 있는지
3. `GEMINI_API_KEY`가 필요한 환경인지

## 10. 운영 체크리스트

배포 전 최소 확인:

1. `pnpm lint`
2. `pnpm build`
3. `pnpm test`
4. backend health 확인
5. public 레포 연결 확인
6. private 레포 + PAT 연결 확인
