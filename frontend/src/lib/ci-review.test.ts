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
  });

  assert.equal(report.stats.workflowCount, 1);
  assert.ok(report.findings.some((finding) => finding.summary.includes('timeout') && typeof finding.line === 'number'));
  assert.ok(report.findings.some((finding) => finding.summary.includes('캐시') && typeof finding.line === 'number'));
  assert.ok(report.categoryScores.some((category) => category.key === 'performance'));
  assert.ok(report.workflowCards.length > 0);
});
