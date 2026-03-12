import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowMap, parseWorkflowMeta } from './workflow-map';

test('parseWorkflowMeta extracts workflow triggers and workflow_run targets', () => {
  const meta = parseWorkflowMeta(
    `
name: Deploy Pipeline
on:
  workflow_run:
    workflows:
      - CI Pipeline
    types:
      - completed
  workflow_dispatch:
`,
    'fallback.yml',
  );

  assert.equal(meta.workflowName, 'Deploy Pipeline');
  assert.deepEqual(meta.triggers, ['workflow_run', 'workflow_dispatch']);
  assert.deepEqual(meta.branchRules, []);
  assert.deepEqual(meta.workflowRunTargets, ['CI Pipeline']);
});

test('buildWorkflowMap creates file-level edges based on workflow_run', () => {
  const map = buildWorkflowMap([
    {
      fileName: 'ci.yml',
      path: '.github/workflows/ci.yml',
      sha: '1111111',
      workflowName: 'CI Pipeline',
      lineCount: 4,
      preview: [],
      content: `
name: CI Pipeline
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
`,
    },
    {
      fileName: 'deploy.yml',
      path: '.github/workflows/deploy.yml',
      sha: '2222222',
      workflowName: 'Deploy Pipeline',
      lineCount: 7,
      preview: [],
      content: `
name: Deploy Pipeline
on:
  workflow_run:
    workflows: [CI Pipeline]
    types: [completed]
jobs:
  deploy:
    runs-on: ubuntu-latest
`,
    },
  ]);

  assert.equal(map.nodes.length, 2);
  assert.deepEqual(map.edges, [
    {
      from: '.github/workflows/ci.yml',
      to: '.github/workflows/deploy.yml',
      kind: 'strong',
    },
  ]);
  assert.equal(
    map.nodes.find((node) => node.fileName === 'deploy.yml')?.level,
    1,
  );
  assert.equal(map.strongEdges.length, 1);
  assert.equal(map.weakEdges.length, 0);
});

test('buildWorkflowMap creates weak edges for same trigger and branch rule', () => {
  const map = buildWorkflowMap([
    {
      fileName: 'ci.yml',
      path: '.github/workflows/ci.yml',
      sha: '1111111',
      workflowName: 'CI Pipeline',
      lineCount: 4,
      preview: [],
      content: `
name: CI Pipeline
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
`,
    },
    {
      fileName: 'lint.yml',
      path: '.github/workflows/lint.yml',
      sha: '2222222',
      workflowName: 'Lint Pipeline',
      lineCount: 4,
      preview: [],
      content: `
name: Lint Pipeline
on:
  push:
    branches:
      - main
jobs:
  lint:
    runs-on: ubuntu-latest
`,
    },
  ]);

  assert.equal(map.strongEdges.length, 0);
  assert.deepEqual(map.weakEdges, [
    {
      from: '.github/workflows/ci.yml',
      to: '.github/workflows/lint.yml',
      kind: 'weak',
    },
  ]);
});
