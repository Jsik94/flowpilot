import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBranchComparison, buildRepoInsight, buildReviewHtml, buildReviewMarkdown } from './repo-insights';
import { buildWorkflowGraph } from './workflow-graph';

test('buildRepoInsight detects frameworks and deployment signals', () => {
  const insight = buildRepoInsight(
    [
      { name: 'package.json', path: 'package.json', type: 'file' },
      { name: 'pnpm-workspace.yaml', path: 'pnpm-workspace.yaml', type: 'file' },
      { name: 'package.json', path: 'apps/web/package.json', type: 'file' },
      { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
      { name: 'README.md', path: 'README.md', type: 'file' },
    ],
    JSON.stringify({
      packageManager: 'pnpm@10.0.0',
      dependencies: {
        react: '^19.0.0',
        next: '^15.0.0',
      },
      scripts: {
        test: 'vitest',
      },
    }),
    'Deploys to Vercel with Docker for preview environments.',
  );

  assert.ok(insight.frameworks.includes('Node.js'));
  assert.ok(insight.frameworks.includes('Next.js'));
  assert.ok(insight.deploymentSignals.includes('Docker'));
  assert.equal(insight.packageManager, 'pnpm');
  assert.equal(insight.monorepo, true);
  assert.ok(insight.analysisStages.length > 0);
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
      packageManager: 'pnpm',
      monorepo: false,
      workspaceRoots: [],
      testSignals: ['Vitest'],
      analysisStages: [
        {
          title: '스택과 패키지 매니저',
          summary: 'Node.js와 pnpm을 사용합니다.',
          details: ['Frameworks: Node.js', 'Package manager: pnpm'],
        },
      ],
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
    ciReview: null,
  });

  assert.match(markdown, /# FlowPilot Review Report/);
  assert.match(markdown, /## Repository Analysis/);
  assert.match(markdown, /## Repository Staged Analysis/);
  assert.match(markdown, /## Review Findings/);
});

test('buildReviewHtml includes repository and workflow sections', () => {
  const html = buildReviewHtml({
    repository: {
      owner: 'octocat',
      repo: 'hello-world',
      fullName: 'octocat/hello-world',
      isPrivate: false,
      defaultBranch: 'main',
    },
    selectedBranch: 'main',
    preview: null,
    workflowGraph: null,
    repoInsight: {
      summary: 'summary',
      frameworks: ['Node.js'],
      keyFiles: ['package.json'],
      deploymentSignals: ['Docker'],
      packageManager: 'pnpm',
      monorepo: false,
      workspaceRoots: [],
      testSignals: ['Vitest'],
      analysisStages: [
        {
          title: '스택과 패키지 매니저',
          summary: 'Node.js와 pnpm을 사용합니다.',
          details: ['Frameworks: Node.js', 'Package manager: pnpm'],
        },
      ],
      confidence: 'high',
    },
    branchComparison: null,
    runs: [],
    analysisResult: null,
    ciReview: null,
  });

  assert.match(html, /Repository Staged Analysis/);
  assert.match(html, /FlowPilot Review Report/);
});
