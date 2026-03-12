import type {
  AnalysisIssue,
  GraphNode,
  RunSummary,
} from '../types';

export const graphNodes: GraphNode[] = [
  {
    id: 'checkout',
    title: 'Checkout',
    level: 0,
    state: 'success',
    meta: 'ubuntu-latest · 2 steps',
  },
  {
    id: 'build',
    title: 'Build',
    level: 1,
    state: 'success',
    meta: 'ubuntu-latest · 5 steps',
  },
  {
    id: 'lint',
    title: 'Lint',
    level: 1,
    state: 'failure',
    meta: 'ubuntu-latest · 3 steps',
  },
  {
    id: 'deploy',
    title: 'Deploy',
    level: 2,
    state: 'neutral',
    meta: 'production · waiting',
  },
];

export const runs: RunSummary[] = [
  {
    id: 1520,
    runNumber: 1520,
    title: 'Deploy pipeline failed on main',
    branch: 'main',
    event: 'push',
    status: 'failure',
    startedAt: '5분 전',
  },
  {
    id: 1519,
    runNumber: 1519,
    title: 'CI passed on main',
    branch: 'main',
    event: 'push',
    status: 'success',
    startedAt: '38분 전',
  },
  {
    id: 1518,
    runNumber: 1518,
    title: 'PR checks in progress',
    branch: 'feat/graph',
    event: 'pull_request',
    status: 'running',
    startedAt: '1시간 전',
  },
];

export const issues: AnalysisIssue[] = [
  {
    id: 'issue-1',
    severity: 'critical',
    title: '권한 범위가 과합니다',
    target: 'deploy.yml > deploy',
    summary: '배포 Job에 광범위한 write 권한이 열려 있습니다.',
  },
  {
    id: 'issue-2',
    severity: 'warning',
    title: 'npm 캐시가 없습니다',
    target: 'ci.yml > build',
    summary: '의존성 설치가 매번 반복되어 실행 시간이 증가합니다.',
  },
  {
    id: 'issue-3',
    severity: 'info',
    title: 'timeout 설정이 없습니다',
    target: 'ci.yml',
    summary: '장시간 대기 상황에서 런이 불필요하게 점유될 수 있습니다.',
  },
];
