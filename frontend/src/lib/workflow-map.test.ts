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
  assert.equal(
    map.nodes.find((node) => node.fileName === 'ci.yml')?.phaseLabel,
    'Push',
  );
  assert.equal(
    map.nodes.find((node) => node.fileName === 'deploy.yml')?.phaseLabel,
    'Pipeline',
  );
  assert.equal(map.edges.length, 1);
  assert.equal(map.edges[0]?.from, '.github/workflows/ci.yml');
  assert.equal(map.edges[0]?.to, '.github/workflows/deploy.yml');
  assert.equal(map.edges[0]?.kind, 'strong');
  assert.equal(map.edges[0]?.reason, 'workflow_run 또는 workflow_call로 명시 연결');
  assert.equal(map.edges[0]?.confidence, 1);
  assert.equal(
    map.nodes.find((node) => node.fileName === 'deploy.yml')?.level,
    1,
  );
  assert.equal(map.strongEdges.length, 1);
  assert.equal(map.weakEdges.length, 0);
});

test('buildWorkflowMap assigns review phase for pull request workflows', () => {
  const map = buildWorkflowMap([
    {
      fileName: 'pr.yml',
      path: '.github/workflows/pr.yml',
      sha: '1111111',
      workflowName: 'PR Pipeline',
      lineCount: 4,
      preview: [],
      content: `
name: PR Pipeline
on:
  pull_request:
    branches:
      - main
jobs:
  review:
    runs-on: ubuntu-latest
`,
    },
  ]);

  assert.equal(map.nodes[0]?.phaseLabel, 'PR');
  assert.equal(map.nodes[0]?.phaseOrder, 0);
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
  assert.equal(map.weakEdges.length, 1);
  assert.equal(map.weakEdges[0]?.from, '.github/workflows/ci.yml');
  assert.equal(map.weakEdges[0]?.to, '.github/workflows/lint.yml');
  assert.equal(map.weakEdges[0]?.kind, 'weak');
  assert.match(map.weakEdges[0]?.reason ?? '', /공통 trigger|같은 branch rule|공통 목적/);
  assert.equal(typeof map.weakEdges[0]?.confidence, 'number');
});

test('buildWorkflowMap infers weak edges across pre-merge and post-merge workflows with shared branch target', () => {
  const map = buildWorkflowMap([
    {
      fileName: 'build-pr.yml',
      path: '.github/workflows/build-pr.yml',
      sha: '1111111',
      workflowName: 'Build Review',
      lineCount: 6,
      preview: [],
      content: `
name: Build Review
on:
  pull_request:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
`,
    },
    {
      fileName: 'build-main.yml',
      path: '.github/workflows/build-main.yml',
      sha: '2222222',
      workflowName: 'Build Main',
      lineCount: 6,
      preview: [],
      content: `
name: Build Main
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
`,
    },
  ]);

  assert.equal(map.weakEdges.length, 1);
  assert.equal(map.weakEdges[0]?.from, '.github/workflows/build-pr.yml');
  assert.equal(map.weakEdges[0]?.to, '.github/workflows/build-main.yml');
  assert.equal(map.weakEdges[0]?.kind, 'weak');
  assert.match(map.weakEdges[0]?.reason ?? '', /phase 흐름|branch target|공통 목적/);
  assert.ok((map.weakEdges[0]?.confidence ?? 0) >= 0.5);
});
