import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCiReviewReport, buildWorkflowNarrative } from './ci-review';
import { buildWorkflowGraph } from './workflow-graph';
import { buildWorkflowMap } from './workflow-map';
import type { WorkflowPreview } from '../types';

const PREVIEW: WorkflowPreview = {
  fileName: 'ci.yml',
  path: '.github/workflows/ci.yml',
  sha: '1234567890abcdef',
  workflowName: 'CI Pipeline',
  lineCount: 22,
  preview: [],
  content: `
name: CI Pipeline
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test
`,
};

test('buildWorkflowNarrative explains triggers, jobs, and flow', () => {
  const graph = buildWorkflowGraph(PREVIEW.content, PREVIEW.workflowName);
  const summary = buildWorkflowNarrative(PREVIEW, graph, []);

  assert.match(summary, /PR/);
  assert.match(summary, /2개의 job|1개의 job|job/);
  assert.match(summary, /대표 흐름/);
});

test('buildCiReviewReport flags missing timeout and cache strategy', () => {
  const report = buildCiReviewReport({
    selectedBranch: 'main',
    previews: [PREVIEW],
    workflowMap: buildWorkflowMap([PREVIEW]),
    repoInsight: null,
    branchComparison: null,
    runs: [],
    analysisResult: null,
    diagnostics: {},
  });

  assert.equal(report.stats.workflowCount, 1);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.summary.includes('timeout') &&
        typeof finding.line === 'number' &&
        typeof finding.lineEnd === 'number' &&
        Boolean(finding.blockLabel),
    ),
  );
  assert.ok(report.findings.some((finding) => finding.summary.includes('캐시') && typeof finding.line === 'number'));
  assert.ok(report.categoryScores.some((category) => category.key === 'performance'));
  assert.ok(report.workflowCards.length > 0);
  assert.ok(report.roleAnalysis.gaps.some((gap) => gap.role === 'Release / Deploy Guard'));
  assert.ok(report.priorityActions.length > 0);
});

test('buildCiReviewReport detects overlapping workflow roles', () => {
  const now = new Date();
  const report = buildCiReviewReport({
    selectedBranch: 'main',
    previews: [
      PREVIEW,
      {
        ...PREVIEW,
        fileName: 'build.yml',
        path: '.github/workflows/build.yml',
        workflowName: 'Build Checks',
      },
    ],
    workflowMap: buildWorkflowMap([
      PREVIEW,
      {
        ...PREVIEW,
        fileName: 'build.yml',
        path: '.github/workflows/build.yml',
        workflowName: 'Build Checks',
      },
    ]),
    repoInsight: null,
    branchComparison: null,
    runs: [],
    analysisResult: null,
    diagnostics: {
      [PREVIEW.path]: {
        workflowId: PREVIEW.path,
        workflowName: PREVIEW.workflowName,
        fileName: PREVIEW.fileName,
        runs: [
          {
            id: 1,
            runNumber: 12,
            title: 'CI failure',
            branch: 'main',
            event: 'pull_request',
            status: 'failure',
            startedAt: now.toISOString(),
            completedAt: now.toISOString(),
            durationMinutes: 6.4,
          },
          {
            id: 2,
            runNumber: 13,
            title: 'CI success',
            branch: 'main',
            event: 'pull_request',
            status: 'success',
            startedAt: now.toISOString(),
            completedAt: now.toISOString(),
            durationMinutes: 5.2,
          },
        ],
        latestRunJobs: [],
        runAccessMessage: null,
        analysis: null,
        estimatedDurationMinutes: 6.4,
        failureCount: 2,
        latestFailureJobs: ['build'],
        failureRuns: [
          {
            runId: 1,
            runNumber: 12,
            title: 'CI failure',
            startedAt: '2026-03-13T00:00:00Z',
            durationMinutes: 6.4,
            event: 'pull_request',
            failedJobs: ['build'],
          },
        ],
        recurringFailedJobs: [
          {
            jobName: 'build',
            count: 2,
          },
        ],
      },
    },
  });

  assert.ok(report.roleAnalysis.overlaps.some((overlap) => overlap.role === 'PR Validation'));
  assert.ok(report.optimizationInsights.duplicateWork.length > 0);
  assert.ok(
    report.categoryScores.some(
      (category) => category.key === 'duplication' || category.key === 'latency',
    ),
  );
  assert.ok(report.failureInsights.items.length > 0);
  assert.ok(report.failureInsights.patterns.length > 0);
  assert.ok(report.reviewLenses.length > 0);
  assert.ok(report.workflowDeepDives.length > 0);
});
