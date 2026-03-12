import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendRefQuery,
  buildWorkflowPreview,
  decodeGitHubFileContent,
  mapExecutionState,
  mapRunJobsToSummaries,
  mapWorkflowItemsToSummaries,
  mapWorkflowRunsToSummaries,
  parseRepositoryUrl,
} from './github';

test('parseRepositoryUrl extracts owner and repo from github URL', () => {
  const parsed = parseRepositoryUrl('https://github.com/octocat/hello-world');

  assert.equal(parsed.owner, 'octocat');
  assert.equal(parsed.repo, 'hello-world');
  assert.equal(parsed.fullName, 'octocat/hello-world');
});

test('parseRepositoryUrl strips .git suffix', () => {
  const parsed = parseRepositoryUrl('https://github.com/octocat/hello-world.git');

  assert.equal(parsed.repo, 'hello-world');
});

test('parseRepositoryUrl rejects non github hosts', () => {
  assert.throws(
    () => parseRepositoryUrl('https://gitlab.com/octocat/hello-world'),
    /github\.com 레포 URL만 지원합니다/,
  );
});

test('mapWorkflowItemsToSummaries keeps only workflow yaml files', () => {
  const summaries = mapWorkflowItemsToSummaries([
    {
      name: 'ci.yml',
      path: '.github/workflows/ci.yml',
      sha: '1234567890abcdef',
      type: 'file',
    },
    {
      name: 'release.yaml',
      path: '.github/workflows/release.yaml',
      sha: 'fedcba0987654321',
      type: 'file',
    },
    {
      name: 'README.md',
      path: 'README.md',
      sha: 'aaaabbbbccccdddd',
      type: 'file',
    },
  ]);

  assert.deepEqual(
    summaries.map((item) => item.fileName),
    ['ci.yml', 'release.yaml'],
  );
  assert.equal(summaries[0].subtitle, '.github/workflows/ci.yml · 1234567');
});

test('decodeGitHubFileContent decodes base64 payload', () => {
  const decoded = decodeGitHubFileContent('bmFtZTogQ0kK', 'base64');

  assert.equal(decoded, 'name: CI\n');
});

test('buildWorkflowPreview extracts top-level workflow name and line count', () => {
  const preview = buildWorkflowPreview({
    name: 'ci.yml',
    path: '.github/workflows/ci.yml',
    sha: '1234567890abcdef',
    content: 'bmFtZTogQ0kKb246IHB1c2gKam9iczoKICBidWlsZDoKICAgIHJ1bnMtb246IHVidW50dS1sYXRlc3QK',
    encoding: 'base64',
  });

  assert.equal(preview.workflowName, 'CI');
  assert.equal(preview.lineCount, 5);
  assert.deepEqual(preview.preview.slice(0, 2), ['name: CI', 'on: push']);
});

test('appendRefQuery adds encoded branch ref to github contents path', () => {
  const path = appendRefQuery('/repos/octocat/hello-world/contents/.github/workflows', 'feat/graph');

  assert.equal(
    path,
    '/repos/octocat/hello-world/contents/.github/workflows?ref=feat%2Fgraph',
  );
});

test('mapWorkflowRunsToSummaries maps GitHub run status into UI status', () => {
  const runs = mapWorkflowRunsToSummaries([
    {
      id: 101,
      run_number: 21,
      display_title: 'Fix cache key',
      head_branch: 'main',
      event: 'push',
      status: 'completed',
      conclusion: 'success',
      created_at: '2026-03-13T10:00:00Z',
    },
    {
      id: 102,
      run_number: 22,
      name: 'CI',
      head_branch: 'main',
      event: 'workflow_dispatch',
      status: 'in_progress',
      conclusion: null,
      created_at: '2026-03-13T10:05:00Z',
    },
  ]);

  assert.equal(runs[0]?.title, 'Fix cache key');
  assert.equal(runs[0]?.status, 'success');
  assert.equal(runs[1]?.title, 'CI');
  assert.equal(runs[1]?.status, 'running');
});

test('mapRunJobsToSummaries maps jobs and step execution states', () => {
  const jobs = mapRunJobsToSummaries([
    {
      id: 9001,
      name: 'build',
      status: 'completed',
      conclusion: 'failure',
      started_at: '2026-03-13T10:00:00Z',
      completed_at: '2026-03-13T10:02:00Z',
      steps: [
        {
          number: 1,
          name: 'Checkout',
          status: 'completed',
          conclusion: 'success',
        },
        {
          number: 2,
          name: 'Install',
          status: 'completed',
          conclusion: 'failure',
        },
      ],
    },
  ]);

  assert.equal(jobs[0]?.status, 'failure');
  assert.deepEqual(jobs[0]?.steps.map((step) => step.status), ['success', 'failure']);
});

test('mapExecutionState falls back to neutral for skipped executions', () => {
  assert.equal(mapExecutionState('completed', 'skipped'), 'neutral');
});
