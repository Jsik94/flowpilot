import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBranchComparison, buildRepoInsight, buildReviewMarkdown } from './repo-insights';
import { buildWorkflowGraph } from './workflow-graph';

test('buildRepoInsight detects frameworks and deployment signals', () => {
  const insight = buildRepoInsight(
    [
      { name: 'package.json', path: 'package.json', type: 'file' },
      { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ],
    JSON.stringify({
      dependencies: {
        react: '^19.0.0',
        next: '^15.0.0',
      },
    }),
    'Deploys to Vercel with Docker for preview environments.',
  );

  assert.ok(insight.frameworks.includes('Node.js'));
  assert.ok(insight.frameworks.includes('Next.js'));
  assert.ok(insight.deploymentSignals.includes('Docker'));
  assert.equal(insight.confidence, 'high');
});

test('buildBranchComparison detects added and removed workflows', () => {
  const comparison = buildBranchComparison(
    'feat/report',
    'main',
    [
      { id: 'a', fileName: 'ci.yml', path: 'ci.yml', sha: '1', subtitle: '', status: 'healthy' },
      { id: 'b', fileName: 'deploy.yml', path: 'deploy.yml', sha: '2', subtitle: '', status: 'healthy' },
    ],
    [
      { id: 'a', fileName: 'ci.yml', path: 'ci.yml', sha: '1', subtitle: '', status: 'healthy' },
      { id: 'c', fileName: 'release.yml', path: 'release.yml', sha: '3', subtitle: '', status: 'healthy' },
    ],
  );

  assert.deepEqual(comparison.addedWorkflows, ['deploy.yml']);
  assert.deepEqual(comparison.removedWorkflows, ['release.yml']);
  assert.equal(comparison.unchangedCount, 1);
});

test('buildReviewMarkdown includes key report sections', () => {
  const markdown = buildReviewMarkdown({
    repository: {
      owner: 'octocat',
      repo: 'hello-world',
      fullName: 'octocat/hello-world',
      isPrivate: false,
      defaultBranch: 'main',
    },
    selectedBranch: 'main',
    preview: {
      fileName: 'ci.yml',
      path: '.github/workflows/ci.yml',
      sha: 'abc',
      workflowName: 'CI',
      lineCount: 10,
      preview: ['name: CI'],
      content: 'name: CI',
    },
    workflowGraph: buildWorkflowGraph('name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n', 'CI'),
    repoInsight: {
      summary: 'summary',
      frameworks: ['Node.js'],
      keyFiles: ['package.json'],
      deploymentSignals: ['Docker'],
      confidence: 'high',
    },
    branchComparison: {
      baseBranch: 'main',
      currentBranch: 'main',
      addedWorkflows: [],
      removedWorkflows: [],
      unchangedCount: 1,
      summary: 'same branch',
    },
    runs: [],
    analysisResult: null,
  });

  assert.match(markdown, /# FlowPilot Review Report/);
  assert.match(markdown, /## Repository Analysis/);
  assert.match(markdown, /## Review Findings/);
});
