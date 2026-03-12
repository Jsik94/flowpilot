export type ExecutionState = 'success' | 'failure' | 'running' | 'neutral';

export type WorkflowSummary = {
  id: string;
  fileName: string;
  path: string;
  sha: string;
  subtitle: string;
  status: 'healthy' | 'warning' | 'error';
};

export type RepositoryRef = {
  owner: string;
  repo: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
};

export type BranchSummary = {
  name: string;
  sha: string;
};

export type RepositoryFormState = {
  repoUrl: string;
  username: string;
  token: string;
};

export type WorkflowPreview = {
  fileName: string;
  path: string;
  sha: string;
  workflowName: string;
  lineCount: number;
  preview: string[];
  content: string;
};

export type GraphNode = {
  id: string;
  title: string;
  level: number;
  state: ExecutionState;
  meta: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind?: 'strong' | 'weak';
};

export type WorkflowStep = {
  id: string;
  title: string;
  kind: 'run' | 'uses' | 'unknown';
  detail: string;
  executionState?: ExecutionState;
};

export type WorkflowJob = {
  id: string;
  title: string;
  runsOn: string;
  needs: string[];
  steps: WorkflowStep[];
  level: number;
};

export type WorkflowGraph = {
  workflowName: string;
  jobs: WorkflowJob[];
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type WorkflowMapNode = {
  id: string;
  fileName: string;
  workflowName: string;
  triggers: string[];
  branchRules: string[];
  primaryTrigger: string;
  phaseLabel: string;
  phaseOrder: number;
  level: number;
  dependsOnWorkflowIds: string[];
};

export type WorkflowMap = {
  nodes: WorkflowMapNode[];
  edges: GraphEdge[];
  strongEdges: GraphEdge[];
  weakEdges: GraphEdge[];
};

export type RunSummary = {
  id: number;
  runNumber: number;
  title: string;
  branch: string;
  event: string;
  status: ExecutionState;
  startedAt: string;
};

export type RunStepSummary = {
  number: number;
  name: string;
  status: ExecutionState;
};

export type RunJobSummary = {
  id: number;
  name: string;
  status: ExecutionState;
  startedAt: string;
  completedAt: string | null;
  steps: RunStepSummary[];
};

export type JobDetail = {
  id: string;
  title: string;
  runsOn: string;
  needs: string[];
  duration: string;
  steps: Array<{
    name: string;
    duration: string;
    state: 'success' | 'failure' | 'neutral';
  }>;
};

export type AnalysisIssue = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  target: string;
  summary: string;
};

export type AnalysisResult = {
  source: 'gemini' | 'heuristic';
  summary: string;
  issues: AnalysisIssue[];
};
