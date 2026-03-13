import type { AnalysisResult, RunJobSummary, RunSummary, WorkflowPreview } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type AnalyzeWorkflowInput = {
  repository: {
    owner: string;
    repo: string;
  };
  branch: string;
  preview: WorkflowPreview;
  runs: RunSummary[];
  runJobs: RunJobSummary[];
};

type AnalyzeApiResponse = {
  source: 'gemini' | 'heuristic';
  summary: string;
  issues: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    file?: string;
    job?: string;
    title: string;
    description?: string;
    suggestion?: string;
  }>;
};

export async function analyzeWorkflow(input: AnalyzeWorkflowInput) {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: {
        owner: input.repository.owner,
        name: input.repository.repo,
      },
      workflow: {
        fileName: input.preview.fileName,
        workflowName: input.preview.workflowName,
        branch: input.branch,
        content: input.preview.content,
      },
      runs: input.runs.map((run) => ({
        id: run.id,
        title: run.title,
        status: run.status,
        event: run.event,
        branch: run.branch,
        durationMinutes: run.durationMinutes,
        completedAt: run.completedAt,
      })),
      runJobs: input.runJobs.map((job) => ({
        name: job.name,
        status: job.status,
        steps: job.steps.map((step) => ({
          name: step.name,
          status: step.status,
        })),
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `분석 요청 실패 (${response.status})`);
  }

  const result = (await response.json()) as AnalyzeApiResponse;

  return {
    source: result.source,
    summary: result.summary,
    issues: result.issues.map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      title: issue.title,
      target: [issue.file, issue.job].filter(Boolean).join(' > ') || input.preview.fileName,
      summary: [issue.description, issue.suggestion].filter(Boolean).join(' '),
    })),
  } satisfies AnalysisResult;
}
