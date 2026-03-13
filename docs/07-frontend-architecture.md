# Frontend Architecture

## 1. 문서 목적

이 문서는 `frontend/`의 현재 구조와 동작 원리를 설명합니다.
목표는 UI 변경, 기능 추가, 배포 설정 변경 시 어디를 수정해야 하는지 빠르게 이해하게 하는 것입니다.

## 2. 기술 스택

- React 18
- TypeScript
- Vite
- `react-force-graph-2d`
- 브라우저 `fetch`
- 단일 글로벌 상태 라이브러리 없이 `App.tsx` 중심 상태 관리

## 3. 런타임 구조

프론트엔드는 두 종류의 데이터를 다룹니다.

1. GitHub REST API에서 직접 가져오는 데이터
2. backend `/api/*`로 보내는 분석 요청

원칙:

- 레포, 브랜치, workflow source, run history는 브라우저에서 GitHub API를 직접 조회합니다.
- AI 분석과 추천은 backend를 통해 호출합니다.
- UI 조합과 화면 상태는 `App.tsx`가 중심입니다.

## 4. 진입점

### 4.1 엔트리

- [frontend/src/main.tsx](../frontend/src/main.tsx)

역할:

- React root 생성
- 전역 CSS 로드
- `App` 렌더링

### 4.2 앱 셸

- [frontend/src/app/App.tsx](../frontend/src/app/App.tsx)

역할:

- 폼 상태
- 레포 연결 상태
- workflow map 데이터
- selected workflow / selected run 상태
- drawer open/close
- branch analysis progress
- review report 조합

현재 프론트의 사실상 orchestration layer 입니다.

## 5. 디렉터리 구조

현재 핵심 구조:

```text
frontend/src/
├── app/
│   └── App.tsx
├── features/
│   ├── auth/
│   ├── graph/
│   ├── jobs/
│   ├── review/
│   ├── runs/
│   └── workflows/
├── lib/
│   ├── analyze.ts
│   ├── ci-review.ts
│   ├── github.ts
│   ├── repo-insights.ts
│   ├── workflow-execution.ts
│   ├── workflow-graph.ts
│   └── workflow-map.ts
├── styles/
│   └── global.css
└── types/
    └── index.ts
```

## 6. 화면 구성과 책임

### 6.1 RepositoryForm

- [frontend/src/features/auth/components/repository-form.tsx](../frontend/src/features/auth/components/repository-form.tsx)

역할:

- 레포 URL 입력
- public/private 선택
- private 인증 입력
- branch 선택
- 진행 상태 표시

### 6.2 WorkflowMapPanel

- [frontend/src/features/workflows/components/workflow-map-panel.tsx](../frontend/src/features/workflows/components/workflow-map-panel.tsx)

역할:

- 브랜치 전체 workflow map 렌더링
- `전체 / 머지 이전 / 머지 이후 / 수동/기타` 필터
- node click 시 workflow 선택

### 6.3 GraphCanvas

- [frontend/src/features/graph/components/graph-canvas.tsx](../frontend/src/features/graph/components/graph-canvas.tsx)

역할:

- 선택된 workflow의 Job Graph 렌더링
- job 선택

### 6.4 RunHistoryPanel

- [frontend/src/features/runs/components/run-history-panel.tsx](../frontend/src/features/runs/components/run-history-panel.tsx)

역할:

- 최근 run 목록 표시
- 선택 run의 job 요약 표시
- private 권한 부족 시 에러 메시지 표시

### 6.5 JobDetailPanel

- [frontend/src/features/jobs/components/job-detail-panel.tsx](../frontend/src/features/jobs/components/job-detail-panel.tsx)

역할:

- workflow source 표시
- source block focus
- workflow export

### 6.6 ReviewReportPanel

- [frontend/src/features/review/components/review-report-panel.tsx](../frontend/src/features/review/components/review-report-panel.tsx)

역할:

- 브랜치 단위 CI 리뷰 리포트 렌더링
- finding 클릭 시 source focus 연결
- HTML export 트리거

## 7. 데이터 처리 계층

### 7.1 GitHub API client

- [frontend/src/lib/github.ts](../frontend/src/lib/github.ts)

역할:

- 레포 URL 파싱
- 레포 메타 조회
- branch 목록 조회
- workflow source 조회
- run / run jobs 조회

특징:

- public 모드에서는 토큰 없이 요청 가능
- private 모드에서는 PAT를 선택적으로 사용
- GitHub 오류는 상위에서 사용자 메시지로 변환

### 7.2 Workflow Graph 변환

- [frontend/src/lib/workflow-graph.ts](../frontend/src/lib/workflow-graph.ts)

역할:

- YAML에서 job/step 구조 파싱
- `needs` 기반 DAG 생성
- job level 계산

### 7.3 Workflow Map 변환

- [frontend/src/lib/workflow-map.ts](../frontend/src/lib/workflow-map.ts)

역할:

- workflow 메타 파싱
- `workflow_run` 기반 strong edge 생성
- trigger/branch rule 기반 weak edge 생성
- phase 분류

### 7.4 Repo Insight / Review

- [frontend/src/lib/repo-insights.ts](../frontend/src/lib/repo-insights.ts)
- [frontend/src/lib/ci-review.ts](../frontend/src/lib/ci-review.ts)

역할:

- 레포 구조 신호 스캔
- 브랜치 비교
- category score 계산
- finding / workflow deep dive / optimization insight 생성
- HTML export 문자열 생성

### 7.5 Backend API client

- [frontend/src/lib/analyze.ts](../frontend/src/lib/analyze.ts)
- [frontend/src/lib/recommend.ts](../frontend/src/lib/recommend.ts)

역할:

- backend `/api/analyze`
- backend `/api/recommend`

현재 기본 API base URL은 same-origin 입니다.
즉 local dev가 아니면 reverse proxy 구성이 있는 환경을 우선 가정합니다.

## 8. 상태 흐름

주요 흐름:

1. `RepositoryForm` 제출
2. `parseRepositoryUrl`
3. `fetchRepository`
4. `fetchBranches`
5. `loadBranchWorkflows`
6. workflow source 전체 fetch
7. `buildWorkflowMap`
8. branch diagnostics 비동기 분석
9. workflow 선택 시 `buildWorkflowGraph` + run history 로딩
10. review report / drawer summary 조합

## 9. 스타일 구조

- [frontend/src/styles/global.css](../frontend/src/styles/global.css)

현재 전략:

- CSS variable 기반 theme
- 단일 전역 스타일 파일
- panel, badge, map, report, drawer 단위로 구획

장점:

- 빠른 수정
- 디자인 일관성 유지 쉬움

한계:

- 파일이 커지기 쉬움
- 컴포넌트 단위 분리가 약함

## 10. 테스트 구조

테스트는 UI 스냅샷보다 순수 로직 테스트 중심입니다.

예:

- [frontend/src/lib/github.test.ts](../frontend/src/lib/github.test.ts)
- [frontend/src/lib/workflow-graph.test.ts](../frontend/src/lib/workflow-graph.test.ts)
- [frontend/src/lib/workflow-map.test.ts](../frontend/src/lib/workflow-map.test.ts)
- [frontend/src/lib/ci-review.test.ts](../frontend/src/lib/ci-review.test.ts)

## 11. 변경 시 우선 확인할 파일

UI/UX 수정:

- [frontend/src/features/auth/components/repository-form.tsx](../frontend/src/features/auth/components/repository-form.tsx)
- [frontend/src/styles/global.css](../frontend/src/styles/global.css)

workflow parsing:

- [frontend/src/lib/workflow-graph.ts](../frontend/src/lib/workflow-graph.ts)
- [frontend/src/lib/workflow-map.ts](../frontend/src/lib/workflow-map.ts)

리포트 수정:

- [frontend/src/lib/ci-review.ts](../frontend/src/lib/ci-review.ts)
- [frontend/src/features/review/components/review-report-panel.tsx](../frontend/src/features/review/components/review-report-panel.tsx)
