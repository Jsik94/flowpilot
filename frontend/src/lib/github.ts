import type {
  BranchSummary,
  RepositoryEntry,
  RepositoryRef,
  RunJobSummary,
  RunStepSummary,
  RunSummary,
  WorkflowPreview,
  WorkflowSummary,
} from '../types';

type GitHubContentItem = {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
};

type GitHubRepoResponse = {
  name: string;
  owner: {
    login: string;
  };
  full_name: string;
  private: boolean;
  default_branch: string;
};

type GitHubBranchResponse = {
  name: string;
  commit: {
    sha: string;
  };
};

type GitHubFileResponse = {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: 'base64' | string;
};

type GitHubWorkflowRunsResponse = {
  workflow_runs: Array<{
    id: number;
    run_number: number;
    display_title?: string;
    name?: string;
    head_branch: string;
    event: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    run_started_at?: string | null;
    updated_at?: string | null;
  }>;
};

type GitHubRunJobsResponse = {
  jobs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    steps?: Array<{
      number: number;
      name: string;
      status: string;
      conclusion: string | null;
    }>;
  }>;
};

const GITHUB_API_BASE_URL = 'https://api.github.com';

export function parseRepositoryUrl(input: string): RepositoryRef {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('레포 URL을 입력하세요.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('올바른 GitHub 레포 URL 형식이 아닙니다.');
  }

  if (url.hostname !== 'github.com') {
    throw new Error('github.com 레포 URL만 지원합니다.');
  }

  const segments = url.pathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    throw new Error('owner/repo 형식의 GitHub 레포 URL이 필요합니다.');
  }

  const [owner, rawRepo] = segments;
  const repo = rawRepo.replace(/\.git$/, '');

  if (!owner || !repo) {
    throw new Error('owner/repo 형식의 GitHub 레포 URL이 필요합니다.');
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    isPrivate: false,
    defaultBranch: 'main',
  };
}

export function isWorkflowFile(item: Pick<GitHubContentItem, 'name' | 'type'>) {
  return item.type === 'file' && /\.(ya?ml)$/i.test(item.name);
}

export function mapWorkflowItemsToSummaries(items: GitHubContentItem[]) {
  return items
    .filter(isWorkflowFile)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map<WorkflowSummary>((item) => ({
      id: item.path,
      fileName: item.name,
      path: item.path,
      sha: item.sha,
      subtitle: `${item.path} · ${item.sha.slice(0, 7)}`,
      status: 'healthy',
    }));
}

export function mapRepositoryEntries(items: GitHubContentItem[]) {
  return items.map<RepositoryEntry>((item) => ({
    name: item.name,
    path: item.path,
    type: item.type,
  }));
}

export function decodeGitHubFileContent(content: string, encoding: string) {
  if (encoding !== 'base64') {
    return content;
  }

  const normalized = content.replace(/\n/g, '');

  if (typeof atob === 'function') {
    return decodeURIComponent(
      Array.from(atob(normalized))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  }

  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function buildWorkflowPreview(
  file: Pick<GitHubFileResponse, 'name' | 'path' | 'sha' | 'content' | 'encoding'>,
) {
  const decoded = decodeGitHubFileContent(file.content, file.encoding);
  const lines = decoded.replace(/\s+$/, '').split(/\r?\n/);
  const nameLine = lines.find((line) => line.trim().startsWith('name:'));
  const workflowName = nameLine
    ? nameLine.replace(/^name:\s*/, '').trim()
    : file.name;

  return {
    fileName: file.name,
    path: file.path,
    sha: file.sha,
    workflowName,
    lineCount: lines.length,
    preview: lines.slice(0, 18),
    content: decoded,
  } satisfies WorkflowPreview;
}

export function appendRefQuery(path: string, ref?: string) {
  if (!ref) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}ref=${encodeURIComponent(ref)}`;
}

export function mapWorkflowRunsToSummaries(runs: GitHubWorkflowRunsResponse['workflow_runs']) {
  return runs.map<RunSummary>((run) => ({
    id: run.id,
    runNumber: run.run_number,
    title: run.display_title || run.name || `Run #${run.run_number}`,
    branch: run.head_branch,
    event: run.event,
    status: mapExecutionState(run.status, run.conclusion),
    startedAt: run.run_started_at || run.created_at,
    completedAt: run.updated_at ?? null,
    durationMinutes: calculateDurationMinutes(run.run_started_at || run.created_at, run.updated_at ?? null),
  }));
}

export function mapRunJobsToSummaries(jobs: GitHubRunJobsResponse['jobs']) {
  return jobs.map<RunJobSummary>((job) => ({
    id: job.id,
    name: job.name,
    status: mapExecutionState(job.status, job.conclusion),
    startedAt: job.started_at,
    completedAt: job.completed_at,
    steps: (job.steps ?? []).map<RunStepSummary>((step) => ({
      number: step.number,
      name: step.name,
      status: mapExecutionState(step.status, step.conclusion),
    })),
  }));
}

export function mapExecutionState(status?: string | null, conclusion?: string | null) {
  if (status && status !== 'completed') {
    return 'running' as const;
  }

  switch (conclusion) {
    case 'success':
      return 'success' as const;
    case 'failure':
    case 'timed_out':
    case 'cancelled':
    case 'action_required':
    case 'startup_failure':
    case 'stale':
      return 'failure' as const;
    case 'skipped':
    case 'neutral':
      return 'neutral' as const;
    default:
      return 'neutral' as const;
  }
}

function calculateDurationMinutes(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt || !completedAt) {
    return null;
  }

  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();

  if (Number.isNaN(started) || Number.isNaN(completed) || completed <= started) {
    return null;
  }

  return Math.round(((completed - started) / 1000 / 60) * 10) / 10;
}

function createGitHubHeaders(token?: string) {
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function fetchGitHubJson<T>(path: string, token?: string) {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    headers: createGitHubHeaders(token),
  });

  if (!response.ok) {
    const rawText = await response.text();
    let message = rawText;

    try {
      const parsed = JSON.parse(rawText) as { message?: string };
      message = parsed.message ?? rawText;
    } catch {
      // Keep rawText when the payload is not JSON.
    }

    throw new Error(`${response.status} ${message}`.trim());
  }

  return (await response.json()) as T;
}

export async function fetchRepository(
  repoRef: RepositoryRef,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubRepoResponse>(
    `/repos/${repoRef.owner}/${repoRef.repo}`,
    token,
  );

  return {
    owner: response.owner.login,
    repo: response.name,
    fullName: response.full_name,
    isPrivate: response.private,
    defaultBranch: response.default_branch,
  } satisfies RepositoryRef;
}

export async function fetchBranches(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubBranchResponse[]>(
    `/repos/${repoRef.owner}/${repoRef.repo}/branches?per_page=100`,
    token,
  );

  return response.map<BranchSummary>((branch) => ({
    name: branch.name,
    sha: branch.commit.sha,
  }));
}

export async function fetchWorkflowSummaries(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  ref?: string,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubContentItem[]>(
    appendRefQuery(
      `/repos/${repoRef.owner}/${repoRef.repo}/contents/.github/workflows`,
      ref,
    ),
    token,
  );

  return mapWorkflowItemsToSummaries(response);
}

export async function fetchRepositoryEntries(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  path = '',
  ref?: string,
  token?: string,
) {
  const targetPath = path ? `/contents/${path}` : '/contents';
  const response = await fetchGitHubJson<GitHubContentItem[]>(
    appendRefQuery(`/repos/${repoRef.owner}/${repoRef.repo}${targetPath}`, ref),
    token,
  );

  return mapRepositoryEntries(response);
}

export async function fetchWorkflowPreview(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  path: string,
  ref?: string,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubFileResponse>(
    appendRefQuery(
      `/repos/${repoRef.owner}/${repoRef.repo}/contents/${path}`,
      ref,
    ),
    token,
  );

  return buildWorkflowPreview(response);
}

export async function fetchRepositoryFileText(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  path: string,
  ref?: string,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubFileResponse>(
    appendRefQuery(`/repos/${repoRef.owner}/${repoRef.repo}/contents/${path}`, ref),
    token,
  );

  return decodeGitHubFileContent(response.content, response.encoding);
}

export async function fetchOptionalRepositoryFileText(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  path: string,
  ref?: string,
  token?: string,
) {
  try {
    return await fetchRepositoryFileText(repoRef, path, ref, token);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    throw error;
  }
}

export async function fetchWorkflowRuns(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  workflowFileName: string,
  branch: string,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubWorkflowRunsResponse>(
    `/repos/${repoRef.owner}/${repoRef.repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
    token,
  );

  return mapWorkflowRunsToSummaries(response.workflow_runs);
}

export async function fetchRunJobs(
  repoRef: Pick<RepositoryRef, 'owner' | 'repo'>,
  runId: number,
  token?: string,
) {
  const response = await fetchGitHubJson<GitHubRunJobsResponse>(
    `/repos/${repoRef.owner}/${repoRef.repo}/actions/runs/${runId}/jobs?per_page=100`,
    token,
  );

  return mapRunJobsToSummaries(response.jobs);
}
