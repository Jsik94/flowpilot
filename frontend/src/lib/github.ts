import type {
  BranchSummary,
  RepositoryRef,
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
