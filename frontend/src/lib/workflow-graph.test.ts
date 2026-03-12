import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowGraph } from './workflow-graph';

const sampleWorkflow = `
name: CI Pipeline
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: pnpm install
  lint:
    name: Lint Job
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Run ESLint
        run: pnpm lint
  deploy:
    runs-on: ubuntu-latest
    needs: [build, lint]
    steps:
      - run: pnpm deploy
`;

test('buildWorkflowGraph parses jobs and edges from workflow yaml', () => {
  const graph = buildWorkflowGraph(sampleWorkflow, 'Fallback');

  assert.equal(graph.workflowName, 'CI Pipeline');
  assert.equal(graph.jobs.length, 3);
  assert.deepEqual(
    graph.edges,
    [
      { from: 'build', to: 'lint' },
      { from: 'build', to: 'deploy' },
      { from: 'lint', to: 'deploy' },
    ],
  );
});

test('buildWorkflowGraph assigns job levels from needs dependency', () => {
  const graph = buildWorkflowGraph(sampleWorkflow);
  const levels = Object.fromEntries(graph.jobs.map((job) => [job.id, job.level]));

  assert.equal(levels.build, 0);
  assert.equal(levels.lint, 1);
  assert.equal(levels.deploy, 2);
});

test('buildWorkflowGraph extracts step flow for selected job use', () => {
  const graph = buildWorkflowGraph(sampleWorkflow);
  const buildJob = graph.jobs.find((job) => job.id === 'build');

  assert.ok(buildJob);
  assert.equal(buildJob.steps.length, 2);
  assert.deepEqual(buildJob.steps.map((step) => step.kind), ['uses', 'run']);
  assert.equal(buildJob.steps[0]?.title, 'actions/checkout@v4');
  assert.equal(buildJob.steps[1]?.title, 'Install');
});

test('buildWorkflowGraph supports multiline needs list blocks', () => {
  const workflow = `
jobs:
  test:
    runs-on: ubuntu-latest
    needs:
      - build
      - lint
    steps:
      - run: pnpm test
`;
  const graph = buildWorkflowGraph(workflow);

  assert.deepEqual(graph.jobs[0]?.needs, ['build', 'lint']);
});
