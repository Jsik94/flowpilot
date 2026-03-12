import type { RecommendationResult, RepoInsight, RepositoryRef, WorkflowPreview } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function recommendWorkflowChange(input: {
  repository: RepositoryRef;
  branch: string;
  preview: WorkflowPreview;
  repoInsight: RepoInsight | null;
  template: string;
  details: string;
}) {
  const response = await fetch(`${API_URL}/api/recommend`, {
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
      repoInsight: input.repoInsight,
      changeRequest: {
        template: input.template,
        details: input.details,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `추천 요청 실패 (${response.status})`);
  }

  return (await response.json()) as RecommendationResult;
}
