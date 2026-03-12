import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRunJobsToWorkflowGraph } from './workflow-execution';
import { buildWorkflowGraph } from './workflow-graph';

test('applyRunJobsToWorkflowGraph maps run job states onto graph nodes', () => {
  const graph = buildWorkflowGraph(
    `
name: CI
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
  lint:
    name: Lint
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Install
        run: npm ci
`,
    'CI',
  );

  const hydrated = applyRunJobsToWorkflowGraph(graph, [
    {
      id: 1,
      name: 'build',
      status: 'success',
      startedAt: '2026-03-13T10:00:00Z',
      completedAt: '2026-03-13T10:01:00Z',
      steps: [
        {
          number: 1,
          name: 'Checkout',
          status: 'success',
        },
      ],
    },
    {
      id: 2,
      name: 'Lint',
      status: 'failure',
      startedAt: '2026-03-13T10:01:00Z',
      completedAt: '2026-03-13T10:02:00Z',
      steps: [
        {
          number: 1,
          name: 'Install',
          status: 'failure',
        },
      ],
    },
  ]);

  assert.equal(hydrated.nodes.find((node) => node.id === 'build')?.state, 'success');
  assert.equal(hydrated.nodes.find((node) => node.id === 'lint')?.state, 'failure');
  assert.equal(hydrated.jobs.find((job) => job.id === 'lint')?.steps[0]?.executionState, 'failure');
});

test('applyRunJobsToWorkflowGraph tolerates matrix-style run names', () => {
  const graph = buildWorkflowGraph(
    `
name: CI
jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`,
    'CI',
  );

  const hydrated = applyRunJobsToWorkflowGraph(graph, [
    {
      id: 1,
      name: 'Build (18.x)',
      status: 'success',
      startedAt: '2026-03-13T10:00:00Z',
      completedAt: '2026-03-13T10:01:00Z',
      steps: [],
    },
  ]);

  assert.equal(hydrated.nodes[0]?.state, 'success');
});
