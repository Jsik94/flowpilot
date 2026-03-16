# FlowPilot Implementation Plan

## 1. 목표

이 문서는 MVP를 실제로 만들기 위한 작업 순서와 산출물을 정의한다.
에자일 운영 방식과 iteration 계획은 [05-agile-delivery-plan.md](./05-agile-delivery-plan.md)를 기준으로 한다.

---

## 2. 단계별 구현 계획

### 2.1 Phase 0. 저장소 세팅

목표:

- 모노레포 구조 생성
- 패키지 매니저와 공통 설정 확정

산출물:

- `frontend/`
- `backend/`
- 루트 `package.json`
- 공통 `.gitignore`
- 기본 README

작업:

1. pnpm workspace 설정
2. frontend Vite React TS 생성
3. backend NestJS TS 생성
4. 공통 스크립트 정의

완료 기준:

- `pnpm install`
- `pnpm dev`로 프론트/백엔드가 함께 뜬다

---

### 2.2 Phase 1. GitHub 연결

목표:

- 레포 입력 후 워크플로우 파일 목록까지 로드

산출물:

- RepositoryForm
- GitHub API client
- WorkflowSidebar

작업:

1. URL 파서 작성
2. PAT 메모리 관리 및 public/private 전환 UX
3. repo 확인 API
4. workflow 목록 API
5. workflow 파일 내용 fetch

완료 기준:

- public repo 하나를 정상 조회할 수 있다
- private repo를 PAT로 조회할 수 있다

---

### 2.3 Phase 2. YAML 파싱과 그래프

목표:

- 선택된 워크플로우를 DAG로 렌더링

산출물:

- YAML parser util
- graph transformer
- GraphCanvas
- JobDetailPanel 기본판

작업:

1. YAML jobs 파싱
2. graph node/edge 변환
3. React Flow 적용
4. 노드 선택 상태 연동

완료 기준:

- fixture 3종 이상에서 DAG 정상 렌더링

---

### 2.4 Phase 3. 실행 이력 연동

목표:

- 최근 실행과 실패 Job을 DAG에 반영

산출물:

- RunHistoryPanel
- run jobs merge 로직
- 상태 색상/배지

작업:

1. workflow runs API 연동
2. run jobs API 연동
3. job execution 매핑
4. Step duration 표시

완료 기준:

- 특정 run 선택 시 실패 Job 강조가 반영된다

---

### 2.5 Phase 4. AI 분석

목표:

- 선택 워크플로우에 대한 AI 분석 결과 표시

산출물:

- NestJS analyze endpoint
- Gemini service
- AnalysisPanel

작업:

1. backend analyze module 생성
2. DTO, schema validation
3. Gemini 호출 로직
4. 프론트 analyze 버튼 연동
5. 이슈 목록 및 상세 표시

완료 기준:

- 정상 응답 시 issues가 UI에 출력된다
- 비정상 응답도 앱을 깨지 않는다

---

### 2.6 Phase 5. 폴리싱

목표:

- 실제로 써볼 수 있는 수준의 안정성과 완성도 확보

산출물:

- 로딩/에러/empty 상태
- 테스트 기본 세트
- 스타일 정리

작업:

1. 주요 상태 화면 정리
2. 테스트 fixture 추가
3. 접근성 기본 점검
4. README 정리

완료 기준:

- 최소 사용자 흐름이 막힘 없이 동작한다

---

## 3. 권장 이슈 분해

초기 이슈는 아래 단위로 쪼개는 것이 적당하다.

1. 모노레포 초기화
2. GitHub repo URL 파서
3. GitHub API client
4. workflow 파일 목록 UI
5. YAML graph transformer
6. React Flow DAG 뷰
7. run history 패널
8. job detail 패널
9. analyze API
10. analysis panel

---

## 4. 기술적 위험과 선제 대응

### 4.1 위험 1. GitHub run job과 YAML job key 매칭 불일치

대응:

- 초기에는 이름 기반 휴리스틱 사용
- 불일치 시 실행 상태를 상세 패널에만 제한적으로 노출

### 4.2 위험 2. Gemini 응답 품질 불안정

대응:

- 백엔드에서 schema validation
- issue 개수 제한
- 결과 없음을 허용

### 4.3 위험 3. 복잡한 YAML 파싱 엣지케이스

대응:

- MVP는 `jobs`, `needs`, `runs-on`, `steps`, `if` 중심
- anchor, matrix, reusable workflow는 축소 대응

---

## 5. 바로 다음 액션

문서 기준으로 다음 구현 순서를 권장한다.

1. 루트 워크스페이스와 패키지 구조 생성
2. 프론트 입력 폼 + GitHub API 클라이언트
3. YAML 파서와 DAG 렌더링
4. 백엔드 analyze API

이 순서가 맞는 이유는, AI 없이도 제품 핵심 가치의 절반 이상을 먼저 검증할 수 있기 때문이다.
