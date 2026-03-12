# GitHub Workflow Analyzer Technical Design

## 1. 문서 목적

이 문서는 MVP 구현을 위한 기술 설계 기준을 정의한다.
범위는 프론트엔드 구조, 백엔드 구조, 외부 API 연동, 데이터 흐름, 상태 관리, 테스트 전략까지 포함한다.

---

## 2. 시스템 개요

```
[React Frontend]
   ├─ GitHub REST API
   └─ NestJS Backend
          └─ Gemini API
```

원칙:

- GitHub 데이터는 가능한 한 프론트에서 직접 조회한다.
- AI 관련 처리와 키 관리는 백엔드가 담당한다.
- 워크플로우 파싱과 DAG 생성은 프론트에서 처리한다.

---

## 3. 모노레포 구조

```
flowpilot/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── store/
│   │   ├── styles/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── analyze/
│   │   ├── gemini/
│   │   ├── health/
│   │   ├── common/
│   │   └── main.ts
│   ├── test/
│   └── package.json
└── docs/
```

---

## 4. 프론트엔드 설계

### 4.1 기술 선택

- React + Vite + TypeScript
- Zustand
- React Flow
- Tailwind CSS
- `yaml` 또는 `js-yaml`
- Axios 또는 fetch

권장:

- GitHub API는 `fetch`로 시작한다.
- YAML 파싱은 `yaml` 패키지를 우선 검토한다.
이유: AST/CST 접근 가능성이 더 좋다.

### 4.2 기능 단위 구조

```
features/
├── auth/
├── repository/
├── workflows/
├── graph/
├── runs/
└── analysis/
```

각 feature는 아래 구조를 기본으로 한다.

```
feature-name/
├── api/
├── components/
├── hooks/
├── model/
└── utils/
```

### 4.3 전역 상태

전역 상태는 아래만 둔다.

- 인증 입력값
- 현재 레포 정보
- 워크플로우 목록
- 선택된 워크플로우
- 현재 그래프 데이터
- 최근 실행 목록
- 선택된 실행
- 선택된 Job
- 분석 결과

상태 예시:

```ts
type AppStore = {
  auth: {
    username: string;
    pat: string;
  };
  repo: RepoRef | null;
  workflows: WorkflowFile[];
  selectedWorkflowPath: string | null;
  graph: WorkflowGraph | null;
  runs: WorkflowRunSummary[];
  selectedRunId: number | null;
  jobExecutions: Record<string, JobExecution>;
  selectedJobId: string | null;
  analysis: {
    status: 'idle' | 'loading' | 'success' | 'error';
    issues: AnalysisIssue[];
    errorMessage?: string;
  };
};
```

### 4.4 컴포넌트 책임

#### 4.4.1 AppShell

- 전체 레이아웃
- 패널 조합

#### 4.4.2 RepositoryForm

- URL/PAT/Username 입력
- 입력 검증
- connect 액션 호출

#### 4.4.3 WorkflowSidebar

- 워크플로우 리스트 렌더링
- 현재 선택 표시

#### 4.4.4 GraphCanvas

- React Flow 초기화
- 노드/엣지 렌더링
- 노드 클릭 이벤트

#### 4.4.5 RunHistoryPanel

- 최근 run 리스트
- run 선택 처리

#### 4.4.6 JobDetailPanel

- 선택된 Job의 정적 정보 + 실행 정보 표시

#### 4.4.7 AnalysisPanel

- 분석 요청
- 결과 목록
- 상세 표시

### 4.5 그래프 변환 규칙

입력:

- YAML의 `jobs` 객체

출력:

- React Flow nodes
- React Flow edges

규칙:

- 노드 id는 YAML job key
- 노드 label은 `name || job key`
- `needs`가 문자열이면 배열로 normalize
- 없는 참조를 가진 `needs`는 경고 로그만 남기고 그래프 생성은 계속
- 순환 의존은 비정상 상태로 보고 에러 카드 표시

### 4.6 GitHub API 클라이언트

프론트에서 구현할 API 함수:

- `getRepo()`
- `getWorkflowDirectoryContents()`
- `getWorkflowFileContent(path)`
- `getWorkflowRuns()`
- `getRunJobs(runId)`

헤더 규칙:

```ts
{
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${pat}`,
  'X-GitHub-Api-Version': '2022-11-28'
}
```

PAT가 비어 있으면 Authorization 헤더 없이 요청한다.

### 4.7 세션 저장 전략

sessionStorage 키:

- `fp.username`
- `fp.pat`
- `fp.lastRepoUrl`

보안 원칙:

- 앱 시작 시 세션 데이터 복원 가능
- 새 탭/브라우저 종료 후 사라지는 것을 기본 동작으로 둔다
- localStorage는 쓰지 않는다

---

## 5. 백엔드 설계

### 5.1 NestJS 모듈

```
src/
├── analyze/
│   ├── analyze.controller.ts
│   ├── analyze.service.ts
│   ├── dto/
│   └── schemas/
├── gemini/
│   └── gemini.service.ts
├── common/
│   ├── filters/
│   ├── interceptors/
│   └── validators/
└── main.ts
```

### 5.2 책임

#### 5.2.1 AnalyzeController

- 요청 DTO 검증
- 서비스 호출
- HTTP 응답 반환

#### 5.2.2 AnalyzeService

- 프롬프트 구성
- Gemini 호출
- 응답 파싱
- 스키마 검증
- 최종 JSON 변환

#### 5.2.3 GeminiService

- Gemini SDK 또는 HTTP client 래핑
- 타임아웃 및 재시도

### 5.3 API 계약

#### 5.3.1 POST `/api/analyze`

입력:

- repo 메타정보
- workflows 배열

출력:

- summary
- issues 배열

검증 규칙:

- workflows는 최소 1개
- content는 빈 문자열이면 안 됨
- severity는 `critical | warning | info`
- category는 미리 정의된 enum만 허용

### 5.4 프롬프트 전략

Gemini에는 아래 원칙으로 요청한다.

- GitHub Actions 리뷰어 역할 부여
- 근거 없는 추정 금지
- 보안, 성능, 구조, 디버깅 네 카테고리로 분류
- 결과는 JSON 형식으로 제한
- 최대 이슈 개수 제한

권장 초기 제한:

- workflow당 최대 10개 이슈

### 5.5 실패 처리

- Gemini timeout: 504 또는 502 성격의 오류 응답
- schema mismatch: `analysis_failed`
- empty issues: 정상 응답

---

## 6. 데이터 흐름

### 6.1 초기 로드

1. 사용자가 repo URL 입력
2. 프론트가 owner/repo 파싱
3. 프론트가 GitHub repo 확인 API 호출
4. 프론트가 workflow 목록 조회
5. 첫 workflow 파일 content 조회
6. 프론트가 YAML 파싱
7. 그래프 데이터 생성
8. 프론트가 run 목록 조회

### 6.2 run 선택

1. 사용자가 run 클릭
2. 프론트가 run jobs 조회
3. job 결과를 graph node 상태에 merge
4. JobDetail 표시 갱신

### 6.3 분석 실행

1. 사용자가 analyze 버튼 클릭
2. 프론트가 backend에 분석 요청
3. 백엔드가 Gemini 호출
4. 백엔드가 schema validation
5. 프론트가 issues 렌더링

---

## 7. 에러 상태 설계

프론트는 에러를 기술 원인 그대로 보여주지 않고, 사용자 행동 중심 메시지로 변환한다.

예시:

- `repo_not_found`: 레포를 찾을 수 없습니다
- `workflow_dir_missing`: `.github/workflows` 폴더가 없습니다
- `workflow_parse_failed`: 워크플로우 YAML을 해석하지 못했습니다
- `analysis_failed`: AI 분석 결과를 처리하지 못했습니다
- `rate_limited`: GitHub API 호출 한도에 도달했습니다

각 에러는 아래 메타를 가진다.

```ts
type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  source: 'github' | 'parser' | 'backend' | 'ai';
};
```

---

## 8. 테스트 전략

### 8.1 프론트

- URL 파서 유닛 테스트
- YAML -> graph 변환 유닛 테스트
- run jobs 결과 merge 유닛 테스트
- 주요 컴포넌트 렌더링 테스트

### 8.2 백엔드

- DTO 검증 테스트
- prompt builder 테스트
- Gemini 응답 파서 테스트
- analyze endpoint integration 테스트

### 8.3 fixture 전략

테스트용 workflow fixture를 최소 5종 준비한다.

1. 단일 Job
2. 선형 DAG
3. 병렬 DAG
4. 실패 run 포함 케이스
5. 파싱 실패 YAML

---

## 9. 스타일 및 UX 방향

방향:

- 개발자 도구처럼 정보 밀도가 있어야 한다.
- 카드형 대시보드보다 작업대 같은 느낌이 적합하다.
- 상태 색상은 GitHub Actions 의미와 크게 어긋나지 않게 유지한다.

권장 색상 의미:

- success: green
- failure: red
- in_progress: blue
- skipped: gray
- warning: amber

---

## 10. 배포와 환경 변수

### 프론트

```env
VITE_API_URL=http://localhost:3001
```

### 백엔드

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=
```

---

## 11. 오픈 이슈

아직 구현 전에 결정하면 좋은 항목:

1. GitHub run jobs와 YAML job key 매칭 로직을 어디까지 정교하게 할지
2. AI 분석 결과를 캐시할지
3. YAML 뷰어를 MVP 후반에 넣을지 다음 단계로 미룰지
4. Public repo에 대해 PAT 없는 모드를 어디까지 지원할지
