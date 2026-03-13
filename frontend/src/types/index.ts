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

export type RepositoryEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
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
  completedAt: string | null;
  durationMinutes: number | null;
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

export type WorkflowDiagnostic = {
  workflowId: string;
  workflowName: string;
  fileName: string;
  runs: RunSummary[];
  latestRunJobs: RunJobSummary[];
  analysis: AnalysisResult | null;
  estimatedDurationMinutes: number | null;
  failureCount: number;
  latestFailureJobs: string[];
  failureRuns: Array<{
    runId: number;
    runNumber: number;
    title: string;
    startedAt: string;
    durationMinutes: number | null;
    event: string;
    failedJobs: string[];
  }>;
  recurringFailedJobs: Array<{
    jobName: string;
    count: number;
  }>;
};

export type CiReviewFinding = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category:
    | 'security'
    | 'reliability'
    | 'performance'
    | 'maintainability'
    | 'coverage'
    | 'duplication'
    | 'latency';
  workflowName?: string;
  filePath?: string;
  line?: number;
  lineEnd?: number;
  blockLabel?: string;
  evidence?: string;
  impact?: string;
  summary: string;
  recommendation: string;
};

export type CiReviewReport = {
  headline: string;
  summary: string;
  score: number;
  repoSummary: string;
  repoStages: Array<{
    title: string;
    summary: string;
    details: string[];
  }>;
  stats: {
    workflowCount: number;
    preMergeCount: number;
    postMergeCount: number;
    manualCount: number;
    jobCount: number;
    runCount: number;
    failedWorkflowCount: number;
  };
  strengths: string[];
  watchouts: string[];
  quickWins: string[];
  categoryScores: Array<{
    key:
      | 'security'
      | 'reliability'
      | 'performance'
      | 'maintainability'
      | 'coverage'
      | 'duplication'
      | 'latency';
    label: string;
    score: number;
    summary: string;
  }>;
  architecture: {
    preMerge: string[];
    postMerge: string[];
    manual: string[];
  };
  roleAnalysis: {
    overlaps: Array<{
      role: string;
      workflows: string[];
      summary: string;
    }>;
    gaps: Array<{
      role: string;
      summary: string;
      recommendation: string;
    }>;
  };
  optimizationInsights: {
    duplicateWork: string[];
    latencyRisks: string[];
    efficiencyTips: string[];
  };
  failureInsights: {
    summary: string;
    patterns: string[];
    items: Array<{
      workflowName: string;
      fileName: string;
      failureCount: number;
      latestFailureJobs: string[];
      recurringFailedJobs: Array<{
        jobName: string;
        count: number;
      }>;
      recentFailures: Array<{
        runNumber: number;
        title: string;
        failedJobs: string[];
      }>;
    }>;
  };
  reviewLenses: Array<{
    key:
      | 'security'
      | 'reliability'
      | 'performance'
      | 'maintainability'
      | 'coverage'
      | 'duplication'
      | 'latency';
    label: string;
    summary: string;
    findings: CiReviewFinding[];
  }>;
  workflowCards: Array<{
    workflowName: string;
    fileName: string;
    triggerSummary: string;
    phaseLabel: string;
    jobCount: number;
    riskCount: number;
    headline: string;
    estimatedDurationText: string;
    failureText: string;
    analysisSummary: string;
  }>;
  workflowDeepDives: Array<{
    workflowName: string;
    fileName: string;
    triggerSummary: string;
    phaseLabel: string;
    headline: string;
    estimatedDurationText: string;
    failureText: string;
    analysisSummary: string;
    jobFlowSummary: string;
    failurePatterns: string[];
    topFindings: CiReviewFinding[];
  }>;
  findings: CiReviewFinding[];
};

export type RepoInsight = {
  summary: string;
  frameworks: string[];
  keyFiles: string[];
  deploymentSignals: string[];
  packageManager: string | null;
  monorepo: boolean;
  workspaceRoots: string[];
  testSignals: string[];
  analysisStages: Array<{
    title: string;
    summary: string;
    details: string[];
  }>;
  confidence: 'high' | 'medium' | 'low';
};

export type BranchComparison = {
  baseBranch: string;
  currentBranch: string;
  addedWorkflows: string[];
  removedWorkflows: string[];
  unchangedCount: number;
  summary: string;
};

export type RecommendationSuggestion = {
  id: string;
  title: string;
  target: string;
  reason: string;
  pseudoDiff: string;
  confidence: 'high' | 'medium' | 'low';
};

export type RecommendationResult = {
  source: 'gemini' | 'heuristic';
  summary: string;
  suggestions: RecommendationSuggestion[];
};
