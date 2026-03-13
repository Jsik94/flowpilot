# FlowPilot Product Spec

> 프로젝트명: FlowPilot
> 제품명 확정: FlowPilot
> 작성일: 2026-03-12
> 버전: v0.3
> 대상 사용자: GitHub Actions 워크플로우를 자주 읽고 개선해야 하는 개발자

---

## 1. 제품 한 줄 정의

GitHub 레포지토리의 Actions 워크플로우를 불러와 구조와 실행 이력을 시각화하고, AI 분석으로 개선 포인트를 빠르게 찾는 웹 애플리케이션.

---

## 2. 왜 이 제품이 필요한가

GitHub Actions YAML은 길어질수록 세 가지 문제가 생긴다.

1. 구조를 한눈에 이해하기 어렵다.
2. 실패 원인과 병목 지점을 찾는 데 시간이 오래 걸린다.
3. 성능, 보안, 유지보수 문제를 사람이 직접 점검해야 한다.

이 제품은 아래 세 가지 질문에 빠르게 답하는 것을 목표로 한다.

1. 이 워크플로우는 어떤 순서로 실행되는가?
2. 어디서 실패하고 어디가 느린가?
3. 무엇을 고치면 더 안전하고 빠르게 만들 수 있는가?

---

## 3. 제품 목표

### 3.1 1차 목표

- GitHub 레포지토리의 워크플로우 파일을 불러온다.
- 각 워크플로우의 Job 의존 관계를 DAG로 시각화한다.
- 최근 실행 이력과 Job 결과를 함께 보여준다.
- AI 분석 결과를 심각도별로 정리해 보여준다.

### 3.2 성공 기준

- 레포 입력 후 첫 워크플로우가 3초 안에 로드된다.
- 대표 워크플로우에서 Job DAG가 깨지지 않고 렌더링된다.
- 사용자가 실패 Job과 느린 Step을 10초 이내에 찾을 수 있다.
- AI 분석 결과가 "읽을 만한 수준"이 아니라 "바로 액션 가능한 수준"이어야 한다.

### 3.3 이번 단계에서 하지 않는 것

- YAML 직접 편집
- PR 자동 생성
- GitLab CI, CircleCI 등 타 CI 지원
- 워크플로우 자동 수정
- 장기 저장소 기반 사용자 계정 시스템

---

## 4. 대상 사용자와 핵심 사용 시나리오

### 4.1 주요 사용자

- 개인 프로젝트를 운영하는 개발자
- 사이드 프로젝트 CI를 직접 관리하는 개발자
- 실패 원인과 느린 구간을 빨리 파악하고 싶은 개발자

### 4.2 핵심 시나리오

#### 4.2.1 시나리오 A. 구조 파악

1. 사용자가 GitHub 레포 URL과 PAT를 입력한다.
2. 앱이 `.github/workflows` 아래 파일 목록을 불러온다.
3. 사용자가 `ci.yml`을 선택한다.
4. 앱이 Job DAG를 보여준다.
5. 사용자는 어떤 Job이 병렬인지, 어떤 Job이 deploy 이전에 필요한지 바로 이해한다.

#### 4.2.2 시나리오 B. 실패 원인 파악

1. 사용자가 최근 실행 기록을 본다.
2. 실패한 실행을 선택한다.
3. DAG에서 실패한 Job이 강조된다.
4. Job 상세에서 실패 Step과 로그 링크를 확인한다.

#### 4.2.3 시나리오 C. 개선 포인트 찾기

1. 사용자가 "분석 실행" 버튼을 누른다.
2. 백엔드가 YAML과 레포 메타정보를 기준으로 Gemini 분석을 수행한다.
3. 앱이 심각도별 이슈 목록과 개선 제안을 표시한다.
4. 사용자는 캐시 미사용, 권한 과다, 버전 미고정 같은 문제를 빠르게 확인한다.

---

## 5. MVP 범위

MVP는 "레포 연결 -> 워크플로우 선택 -> DAG 확인 -> 실행 이력 확인 -> AI 분석 확인" 흐름이 끊김 없이 동작하는 것을 의미한다.

### 5.1 반드시 포함할 기능

#### 5.1.1 F1. GitHub 인증 및 레포 연결

- GitHub Username 입력
- GitHub PAT 입력
- 레포 URL 입력
- Public, Private 레포 모두 지원
- PAT는 `sessionStorage`에만 저장
- 잘못된 토큰, 권한 부족, 잘못된 URL 에러 분리 처리

#### 5.1.2 F2. 워크플로우 목록 조회

- `.github/workflows` 경로의 `.yml`, `.yaml` 파일 목록 조회
- 워크플로우 파일 탭 또는 리스트 UI 제공
- 선택한 워크플로우를 기본 뷰에 표시

#### 5.1.3 F3. Job DAG 시각화

- `jobs`를 노드로 표현
- `needs`를 방향 엣지로 표현
- Job 상태를 색상으로 표시
- 노드 클릭 시 상세 정보 표시
- 빈 상태와 파싱 실패 상태 처리

#### 5.1.4 F4. 실행 이력 표시

- 최근 10건 실행 목록
- 각 실행의 상태, 브랜치, 이벤트, 실행 시각 표시
- 실행 선택 시 해당 run의 Job 상태를 DAG에 반영

#### 5.1.5 F5. Job 상세 패널

- Job 이름
- `runs-on`
- `needs`
- Steps 목록
- 각 Step 실행 시간
- 실패 Step 여부
- GitHub run/job 링크

#### 5.1.6 F6. AI 분석

- 선택된 워크플로우 기준 분석
- 이슈를 `Critical`, `Warning`, `Info`로 분류
- 위치 정보 제공: 파일, Job, Step
- 수정 제안 제공
- 분석 실패 시 재시도 가능

### 5.2 있으면 좋지만 MVP에서는 축소 가능한 기능

- YAML 원본 코드 뷰어
- 평균 실행 시간 계산
- 여러 워크플로우 동시 비교
- 분석 결과 캐싱

---

## 6. 기능 우선순위 재정리

### 6.1 P0. 반드시 먼저 구현

- 인증 입력 폼
- 레포 파싱
- 워크플로우 파일 목록 조회
- 단일 워크플로우 DAG 렌더링
- 최근 실행 목록
- AI 분석 API 연결

### 6.2 P1. MVP 완성도에 중요

- Job 상세 패널
- 실패 Job 강조
- Step 시간 표시
- 로딩 상태와 오류 상태

### 6.3 P2. 후속 개선

- YAML 코드 뷰어
- 레포 스택 감지
- 템플릿 추천
- 분석 캐시

---

## 7. 화면 구조

### 7.1 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ Header                                                      │
│ Repo URL / PAT / Load / Analyze                             │
├───────────────┬──────────────────────────────┬───────────────┤
│ WorkflowList  │ DAG + Run Overlay            │ AnalysisPanel │
│               │                              │               │
│ - ci.yml      │ [build] -> [test] -> deploy  │ Critical      │
│ - deploy.yml  │        \-> [lint]            │ Warning       │
│               │                              │ Info          │
├───────────────┴──────────────────────────────┴───────────────┤
│ JobDetail / RunHistory                                      │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 화면별 책임

#### 7.2.1 AuthPanel

- GitHub Username
- PAT
- Repo URL
- 연결 버튼

#### 7.2.2 WorkflowList

- 워크플로우 파일 목록
- 현재 선택 파일 표시

#### 7.2.3 DAGViewer

- Job 노드 렌더링
- 상태 색상
- 선택 상태
- 실패 오버레이

#### 7.2.4 RunHistory

- 최근 실행 목록
- 선택된 실행 강조

#### 7.2.5 JobDetail

- 선택된 Job의 메타정보와 Step 상세

#### 7.2.6 AnalysisPanel

- 분석 버튼
- 분석 중 상태
- 심각도 그룹별 결과 목록
- 선택 이슈 상세

---

## 8. 사용자 흐름

### 8.1 기본 흐름

1. 사용자가 PAT와 레포 URL 입력
2. 프론트가 GitHub API로 레포와 워크플로우 목록 조회
3. 첫 번째 워크플로우 선택
4. 프론트가 YAML 파싱 후 DAG 생성
5. 프론트가 최근 run 목록 조회
6. 사용자가 run 하나를 선택
7. 프론트가 run jobs 결과를 조회해 DAG 상태 반영
8. 사용자가 분석 버튼 클릭
9. 백엔드가 Gemini 분석 결과 반환
10. 프론트가 결과를 이슈 패널과 노드 강조에 반영

### 8.2 예외 흐름

- PAT 누락: 분석 기능과 private repo 접근 차단 안내
- `.github/workflows` 없음: 워크플로우 없음 상태 표시
- YAML 파싱 실패: 해당 파일을 에러 상태로 표시
- GitHub API rate limit: 재시도 안내
- Gemini 실패: 분석 실패 안내와 재시도 버튼 표시

---

## 9. 정보 구조와 데이터 모델

### 9.1 프론트 핵심 엔티티

```ts
type RepoRef = {
  owner: string;
  repo: string;
  defaultBranch?: string;
};

type WorkflowFile = {
  name: string;
  path: string;
  sha: string;
  content: string;
};

type WorkflowGraph = {
  fileName: string;
  jobs: WorkflowJob[];
  edges: WorkflowEdge[];
};

type WorkflowJob = {
  id: string;
  name: string;
  runsOn?: string | string[];
  needs: string[];
  if?: string;
  steps: WorkflowStep[];
};

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
};

type WorkflowRunSummary = {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral';
  event: string;
  branch: string;
  createdAt: string;
};

type JobExecution = {
  jobId: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
  steps: StepExecution[];
  htmlUrl?: string;
};

type StepExecution = {
  name: string;
  status: string;
  conclusion?: string;
  number: number;
  startedAt?: string;
  completedAt?: string;
};

type AnalysisIssue = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'performance' | 'structure' | 'debugging' | 'security';
  file: string;
  job?: string;
  step?: string;
  title: string;
  description: string;
  suggestion: string;
};
```

### 9.2 중요한 판단

- DAG의 기준 식별자는 `job key`를 사용한다.
- GitHub run jobs API의 job name과 YAML job key는 다를 수 있다.
- 따라서 초기 버전은 `job name` 매칭 실패 가능성을 허용하고, 이름 매칭 규칙을 별도 유틸로 둔다.
- 분석 결과 위치 정보는 line number보다 `file/job/step` 우선으로 설계한다.

---

## 10. 기술 아키텍처

### 10.1 선택한 구조

모노레포 기반의 프론트엔드 + 백엔드 분리 구조로 간다.

```
/frontend  -> React + Vite
/backend   -> NestJS
```

### 10.2 분리 이유

- GitHub API는 브라우저에서 직접 호출 가능하다.
- Gemini API 키는 서버에만 둬야 한다.
- AI 분석 프롬프트, 결과 정규화, 추후 캐싱은 백엔드 책임이 적절하다.

### 10.3 프론트 책임

- 인증 정보 관리
- GitHub API 호출
- YAML 파싱
- DAG 생성과 렌더링
- 실행 이력과 상세 UI 표시

### 10.4 백엔드 책임

- Gemini 호출
- 분석 프롬프트 구성
- 결과 JSON 정규화
- 실패 응답 표준화

---

## 11. 외부 API 설계

### 11.1 GitHub API

필수 호출만 먼저 쓴다.

| 메서드 | 엔드포인트 | 목적 |
|------|------|------|
| GET | `/repos/{owner}/{repo}` | 레포 존재 및 접근 권한 확인 |
| GET | `/repos/{owner}/{repo}/contents/.github/workflows` | 워크플로우 파일 목록 조회 |
| GET | `/repos/{owner}/{repo}/contents/{path}` | 워크플로우 파일 내용 조회 |
| GET | `/repos/{owner}/{repo}/actions/runs?per_page=10` | 최근 실행 목록 조회 |
| GET | `/repos/{owner}/{repo}/actions/runs/{run_id}/jobs` | 선택 run의 job/step 결과 조회 |

### 11.2 백엔드 API

#### 11.2.1 POST `/api/analyze`

선택된 워크플로우 하나 또는 여러 개를 분석한다.

Request

```json
{
  "repo": {
    "owner": "octocat",
    "name": "hello-world",
    "language": "TypeScript"
  },
  "workflows": [
    {
      "fileName": "ci.yml",
      "content": "name: CI\non: push\njobs:\n ..."
    }
  ]
}
```

Response

```json
{
  "summary": "4 issues found",
  "issues": [
    {
      "id": "issue-1",
      "severity": "warning",
      "category": "performance",
      "file": "ci.yml",
      "job": "build",
      "step": "Install dependencies",
      "title": "Dependency cache is missing",
      "description": "Dependencies are installed on every run without caching.",
      "suggestion": "Use setup-node cache or actions/cache for npm dependencies."
    }
  ]
}
```

에러 응답

```json
{
  "message": "analysis_failed",
  "detail": "Gemini returned an invalid response"
}
```

---

## 12. AI 분석 설계

### 12.1 분석 입력

- 워크플로우 YAML 원문
- 레포 언어
- 선택된 워크플로우 파일명

### 12.2 분석 출력 형식

백엔드는 Gemini 자유 텍스트를 그대로 내보내지 않는다.

반드시 아래 규격으로 정규화한다.

- severity
- category
- file
- job
- step
- title
- description
- suggestion

### 12.3 프롬프트 원칙

- 문제를 만들어내지 말고 근거 있는 항목만 반환
- 애매하면 `Info`로 낮춰서 반환
- 보안 이슈는 과장하지 말고 실제 위험과 권한 범위를 설명
- 개선 제안은 GitHub Actions 문법 수준으로 구체적으로 작성

### 12.4 리스크

- Gemini 응답이 스키마를 벗어날 수 있다.
- YAML 맥락을 완전히 이해하지 못할 수 있다.
- 실제 실행 이력 없이 구조만 보고 과한 추론을 할 수 있다.

### 12.5 대응

- 백엔드에서 schema validation 수행
- invalid response는 파싱 실패 처리
- Phase 1에서는 "제안" 성격을 명확히 표시

---

## 13. 비기능 요구사항

| 항목 | 요구사항 |
|------|------|
| 보안 | PAT와 Gemini API 키를 영구 저장하지 않음 |
| 응답성 | 첫 워크플로우 표시 3초 이내 |
| 신뢰성 | GitHub API 실패와 AI 실패를 구분해 표시 |
| 확장성 | 이후 GitLab CI 또는 YAML 편집 기능으로 확장 가능해야 함 |
| 접근성 | 색상만으로 상태를 구분하지 않음 |

---

## 14. 에러 처리 정책

### 14.1 GitHub 관련

- 401: 토큰 오류 또는 만료
- 403: 권한 부족 또는 rate limit
- 404: 레포 또는 워크플로우 경로 없음

### 14.2 YAML 관련

- 파싱 실패 시 DAG 대신 오류 카드 표시
- 가능한 경우 원본 코드 뷰는 유지

### 14.3 AI 관련

- 분석 요청 중 로딩 표시
- 실패 시 기존 결과는 유지하고 에러 토스트 표시

---

## 15. 프로젝트 구조 초안

```
flowpilot/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── workflow/
│   │   │   ├── graph/
│   │   │   ├── run-history/
│   │   │   └── analysis/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── store/
│   │   ├── types/
│   │   └── App.tsx
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── analyze/
│   │   ├── gemini/
│   │   ├── common/
│   │   └── main.ts
│   └── package.json
└── 01-init-idea.md
```

---

## 16. 구현 순서

### 16.1 Phase 1. 프로젝트 뼈대

- 모노레포 폴더 생성
- frontend Vite 초기화
- backend NestJS 초기화
- 공통 lint, tsconfig, env 정책 정리

### 16.2 Phase 2. GitHub 연결

- 레포 URL 파서
- GitHub API 클라이언트
- 워크플로우 파일 목록 조회
- 워크플로우 내용 fetch

### 16.3 Phase 3. 시각화

- YAML 파서 유틸
- Job/needs 그래프 변환
- React Flow DAG 렌더링
- RunHistory 연동

### 16.4 Phase 4. AI 분석

- analyze API
- Gemini 프롬프트/응답 정규화
- 이슈 패널 UI
- 노드 하이라이트 연동

### 16.5 Phase 5. 폴리싱

- 로딩/에러/빈 상태
- 기본 반응형 대응
- 접근성 보강

---

## 17. 출시 기준

아래 조건을 만족하면 MVP 출시 가능으로 본다.

1. Public 레포 하나와 Private 레포 하나에서 정상 동작한다.
2. 대표 워크플로우 3종 이상에서 DAG가 깨지지 않는다.
3. 최근 실행 목록과 실패 Job 표시가 동작한다.
4. AI 분석 결과가 지정 스키마로 안정적으로 반환된다.
5. 오류 상황에서 앱이 깨지지 않는다.

---

## 18. 남은 결정 사항

아직 확정이 필요한 항목은 아래다.

1. 제품명은 `FlowPilot`으로 확정하고, 구 레퍼런스 문구를 정리할지
2. 스타일링을 Tailwind로 바로 갈지, CSS Modules로 단순하게 갈지
3. 분석 대상을 선택된 단일 워크플로우로 제한할지, 레포 전체 워크플로우 묶음으로 확장할지
4. YAML 코드 뷰어를 MVP에 넣을지 Phase 1.1로 미룰지

현재 기준 권장 결정은 아래다.

- 제품명: `FlowPilot`
- 스타일링: Tailwind 유지
- 분석 범위: 선택된 단일 워크플로우부터 시작
- YAML 뷰어: MVP 제외
