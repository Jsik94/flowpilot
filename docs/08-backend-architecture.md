# Backend Architecture

## 1. 문서 목적

이 문서는 `backend/`의 현재 구조와 API 책임을 설명합니다.
FlowPilot backend는 무거운 비즈니스 서버가 아니라, AI 분석과 추천을 감싸는 얇은 API 계층입니다.

## 2. 기술 스택

- NestJS 10
- TypeScript
- Node.js 내장 `fetch`
- Gemini API

## 3. 현재 backend의 역할

backend는 세 가지 역할만 수행합니다.

1. health endpoint 제공
2. workflow 분석 요청 처리
3. workflow 변경 위치 추천 요청 처리

원칙:

- GitHub 데이터 수집은 프론트가 담당합니다.
- backend는 전달받은 workflow source와 run context를 바탕으로 해석합니다.
- Gemini API 실패 시 heuristic fallback을 제공합니다.

## 4. 디렉터리 구조

```text
backend/src/
├── analyze/
│   ├── analyze.controller.ts
│   └── analyze.service.ts
├── health/
│   └── health.controller.ts
├── recommend/
│   ├── recommend.controller.ts
│   └── recommend.service.ts
├── app.module.ts
└── main.ts
```

## 5. 부트스트랩

- [backend/src/main.ts](../backend/src/main.ts)

역할:

- Nest 앱 생성
- CORS 설정
- global prefix `/api`
- 포트 바인딩

환경 변수:

- `PORT` 기본값 `3001`
- `FRONTEND_URL` 기본값 `http://localhost:5173`

Docker 환경에서는 frontend nginx를 `http://localhost:8080` 기준으로 맞추는 구성을 사용합니다.

## 6. 모듈 구조

- [backend/src/app.module.ts](../backend/src/app.module.ts)

현재는 단일 모듈 구조입니다.

등록 항목:

- `HealthController`
- `AnalyzeController`
- `RecommendController`
- `AnalyzeService`
- `RecommendService`

현재 규모에서는 별도 `CommonModule`, `ConfigModule` 없이도 충분합니다.

## 7. API 엔드포인트

### 7.1 `GET /api/health`

목적:

- liveness 확인
- compose 또는 reverse proxy 상태 확인

### 7.2 `POST /api/analyze`

컨트롤러:

- [backend/src/analyze/analyze.controller.ts](../backend/src/analyze/analyze.controller.ts)

서비스:

- [backend/src/analyze/analyze.service.ts](../backend/src/analyze/analyze.service.ts)

입력:

- repository 정보
- workflow source
- run 요약
- run job 요약

출력:

- `summary`
- `issues[]`
- `source` (`gemini` 또는 `heuristic`)

분석 관점:

- security
- reliability
- CI latency
- duplicate checks
- branch-specific failures

### 7.3 `POST /api/recommend`

컨트롤러:

- [backend/src/recommend/recommend.controller.ts](../backend/src/recommend/recommend.controller.ts)

서비스:

- [backend/src/recommend/recommend.service.ts](../backend/src/recommend/recommend.service.ts)

입력:

- repository 정보
- workflow source
- repo insight 요약
- change request

출력:

- `summary`
- `suggestions[]`
- `source` (`gemini` 또는 `heuristic`)

추천 관점:

- 어느 파일에 넣을지
- 어느 trigger / job / step 경계가 맞는지
- pseudo diff 초안

## 8. 분석 서비스 구조

### 8.1 AnalyzeService

핵심 흐름:

1. heuristic 분석 결과를 먼저 생성
2. `GEMINI_API_KEY` 존재 여부 확인
3. 키가 없으면 heuristic 즉시 반환
4. 키가 있으면 Gemini 호출
5. 응답 JSON 파싱
6. 파싱 실패 또는 API 실패 시 heuristic fallback

장점:

- 외부 AI 장애가 있어도 앱이 깨지지 않음
- 최소한의 분석 결과는 항상 반환 가능

### 8.2 heuristic 분석

현재 휴리스틱 예시:

- 넓은 permissions
- timeout 누락
- cache 누락
- 실패 job 존재

이 로직은 Gemini가 없어도 기본 리뷰를 제공하기 위한 안전장치입니다.

## 9. 추천 서비스 구조

### 9.1 RecommendService

핵심 흐름:

1. heuristic 추천 생성
2. Gemini 키 확인
3. 키가 있으면 추천 프롬프트 전송
4. JSON 응답 파싱
5. 실패 시 heuristic fallback

현재 heuristic 템플릿:

- slack alert
- approval gate
- nightly scan
- cache optimization
- generic fallback

## 10. 환경 변수

주요 값:

- `PORT`
- `FRONTEND_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

운영 시 주의:

- backend는 GitHub API 키를 직접 받지 않습니다.
- GitHub PAT는 현재 브라우저에서 GitHub REST API 호출에 사용됩니다.
- 따라서 backend는 AI 키와 CORS 설정 위주로 관리하면 됩니다.

## 11. Docker 관점

관련 파일:

- [backend/Dockerfile](../backend/Dockerfile)
- [docker-compose.yml](../docker-compose.yml)

현재 전략:

- build stage에서 TypeScript compile
- runtime stage에서 production dependency 설치
- 컨테이너 시작 시 `node backend/dist/main.js`

## 12. 향후 확장 포인트

현재 backend는 얇은 구조라 확장이 쉬운 편입니다.

후속 확장 후보:

1. config module 도입
2. request validation DTO 도입
3. structured logging
4. rate limit / timeout 제어
5. AI provider abstraction
6. report generation API 분리

## 13. 수정 시 우선 확인할 파일

분석 결과 수정:

- [backend/src/analyze/analyze.service.ts](../backend/src/analyze/analyze.service.ts)

추천 결과 수정:

- [backend/src/recommend/recommend.service.ts](../backend/src/recommend/recommend.service.ts)

포트/CORS/런타임 수정:

- [backend/src/main.ts](../backend/src/main.ts)
- [backend/Dockerfile](../backend/Dockerfile)
- [docker-compose.yml](../docker-compose.yml)
