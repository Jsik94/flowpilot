import type {
  AnalysisResult,
  BranchComparison,
  CiReviewReport,
  RepoInsight,
  RepositoryEntry,
  RepositoryRef,
  RunSummary,
  WorkflowGraph,
  WorkflowPreview,
  WorkflowSummary,
} from '../types';

export function buildRepoInsight(
  entries: RepositoryEntry[],
  packageJsonText: string | null,
  readmeText: string | null,
) {
  const fileNames = new Set(entries.map((entry) => entry.name));
  const frameworks = detectFrameworks(fileNames, packageJsonText);
  const deploymentSignals = detectDeploymentSignals(fileNames, readmeText);
  const keyFiles = ['package.json', 'Dockerfile', 'docker-compose.yml', 'turbo.json', 'README.md']
    .filter((fileName) => fileNames.has(fileName));

  const confidence =
    frameworks.length >= 2 || deploymentSignals.length >= 2
      ? 'high'
      : frameworks.length > 0 || deploymentSignals.length > 0
        ? 'medium'
        : 'low';

  return {
    summary: buildRepoSummary(frameworks, deploymentSignals, keyFiles),
    frameworks,
    keyFiles,
    deploymentSignals,
    confidence,
  } satisfies RepoInsight;
}

export function buildBranchComparison(
  currentBranch: string,
  baseBranch: string,
  currentWorkflows: WorkflowSummary[],
  baseWorkflows: WorkflowSummary[],
) {
  const currentNames = new Set(currentWorkflows.map((workflow) => workflow.fileName));
  const baseNames = new Set(baseWorkflows.map((workflow) => workflow.fileName));

  const addedWorkflows = [...currentNames].filter((name) => !baseNames.has(name)).sort();
  const removedWorkflows = [...baseNames].filter((name) => !currentNames.has(name)).sort();
  const unchangedCount = [...currentNames].filter((name) => baseNames.has(name)).length;

  const summary =
    currentBranch === baseBranch
      ? `${baseBranch} 브랜치를 기준으로 보고 있습니다.`
      : addedWorkflows.length === 0 && removedWorkflows.length === 0
        ? `${baseBranch} 대비 workflow 파일 구성 차이는 크지 않습니다.`
        : `${baseBranch} 대비 추가 ${addedWorkflows.length}개, 제거 ${removedWorkflows.length}개 workflow가 있습니다.`;

  return {
    baseBranch,
    currentBranch,
    addedWorkflows,
    removedWorkflows,
    unchangedCount,
    summary,
  } satisfies BranchComparison;
}

export function buildReviewMarkdown(input: {
  repository: RepositoryRef;
  selectedBranch: string;
  preview: WorkflowPreview;
  workflowGraph: WorkflowGraph | null;
  repoInsight: RepoInsight | null;
  branchComparison: BranchComparison | null;
  runs: RunSummary[];
  analysisResult: AnalysisResult | null;
  ciReview: CiReviewReport | null;
}) {
  const { repository, selectedBranch, preview, workflowGraph, repoInsight, branchComparison, runs, analysisResult, ciReview } = input;

  return [
    `# FlowPilot Review Report`,
    '',
    `- Repository: ${repository.fullName}`,
    `- Branch: ${selectedBranch}`,
    `- Workflow: ${preview.workflowName} (${preview.fileName})`,
    '',
    '## Overview',
    ciReview?.headline ?? analysisResult?.summary ?? '분석 결과가 아직 생성되지 않았습니다.',
    '',
    ciReview?.summary ?? '',
    '',
    '## CI Scorecard',
    ciReview
      ? ciReview.categoryScores
          .map((category) => `- ${category.label}: ${category.score}/100 - ${category.summary}`)
          .join('\n')
      : '- scorecard unavailable',
    '',
    '## Quick Wins',
    ciReview?.quickWins.length
      ? ciReview.quickWins.map((item) => `- ${item}`).join('\n')
      : '- quick wins unavailable',
    '',
    '## Failure Snapshot',
    ciReview?.failureInsights.items.length
      ? ciReview.failureInsights.items
          .map(
            (item) =>
              `- ${item.workflowName} (${item.fileName}): failures ${item.failureCount}, jobs ${item.latestFailureJobs.join(', ') || 'unknown'}${
                item.recurringFailedJobs.length
                  ? `, recurring ${item.recurringFailedJobs.map((failure) => `${failure.jobName}(${failure.count})`).join(', ')}`
                  : ''
              }`,
          )
          .join('\n')
      : '- failure snapshot unavailable',
    '',
    '## Review Lenses',
    ciReview?.reviewLenses.length
      ? ciReview.reviewLenses
          .map(
            (lens) =>
              `- ${lens.label}: ${lens.summary}\n${lens.findings.map((finding) => `  - ${finding.summary}`).join('\n')}`,
          )
          .join('\n')
      : '- review lenses unavailable',
    '',
    '## Workflow Performance',
    ciReview?.workflowCards.length
      ? ciReview.workflowCards
          .map(
            (workflow) =>
              `- ${workflow.workflowName}: ${workflow.estimatedDurationText}, ${workflow.failureText}\n  ${workflow.analysisSummary}`,
          )
          .join('\n')
      : '- workflow performance unavailable',
    '',
    '## Workflow Deep Dive',
    ciReview?.workflowDeepDives.length
      ? ciReview.workflowDeepDives
          .map(
            (workflow) =>
              `- ${workflow.workflowName} (${workflow.fileName})\n  Trigger: ${workflow.triggerSummary}\n  Flow: ${workflow.jobFlowSummary}\n  Failures: ${workflow.failurePatterns.join(' / ')}\n  Notes: ${workflow.analysisSummary}`,
          )
          .join('\n')
      : '- workflow deep dive unavailable',
    '',
    '## Repository Analysis',
    repoInsight?.summary ?? '레포 분석 정보가 아직 없습니다.',
    '',
    `- Confidence: ${repoInsight?.confidence ?? 'unknown'}`,
    `- Frameworks: ${(repoInsight?.frameworks ?? []).join(', ') || 'none'}`,
    `- Deployment Signals: ${(repoInsight?.deploymentSignals ?? []).join(', ') || 'none'}`,
    `- Key Files: ${(repoInsight?.keyFiles ?? []).join(', ') || 'none'}`,
    '',
    '## Branch Comparison',
    branchComparison?.summary ?? '브랜치 비교 정보가 없습니다.',
    '',
    `- Added workflows: ${(branchComparison?.addedWorkflows ?? []).join(', ') || 'none'}`,
    `- Removed workflows: ${(branchComparison?.removedWorkflows ?? []).join(', ') || 'none'}`,
    '',
    '## Workflow Structure',
    workflowGraph
      ? workflowGraph.jobs.map((job) => `- ${job.title}: needs [${job.needs.join(', ') || 'none'}], steps ${job.steps.length}`).join('\n')
      : '- workflow graph unavailable',
    '',
    '## Recent Runs',
    runs.length > 0
      ? runs.slice(0, 5).map((run) => `- #${run.runNumber} ${run.status} ${run.event} ${run.branch} ${run.title}`).join('\n')
      : '- recent runs unavailable',
    '',
    '## Review Findings',
    ciReview && ciReview.findings.length > 0
      ? ciReview.findings
          .map(
            (issue) =>
              `- [${issue.severity}] ${issue.summary}${issue.workflowName ? ` (${issue.workflowName})` : ''}${
                issue.filePath
                  ? ` [${issue.filePath}${issue.line ? `:${issue.line}` : ''}${issue.lineEnd && issue.lineEnd !== issue.line ? `-${issue.lineEnd}` : ''}]`
                  : ''
              }\n  ${issue.blockLabel ? `블록: ${issue.blockLabel}\n  ` : ''}${issue.impact ? `영향: ${issue.impact}\n  ` : ''}${issue.evidence ? `근거: ${issue.evidence}\n  ` : ''}${issue.recommendation}`,
          )
          .join('\n')
      : analysisResult && analysisResult.issues.length > 0
        ? analysisResult.issues.map((issue) => `- [${issue.severity}] ${issue.title} (${issue.target})\n  ${issue.summary}`).join('\n')
      : '- 아직 분석 이슈가 없습니다.',
  ].join('\n');
}

function detectFrameworks(fileNames: Set<string>, packageJsonText: string | null) {
  const frameworks = new Set<string>();

  if (fileNames.has('package.json')) {
    frameworks.add('Node.js');
  }
  if (fileNames.has('requirements.txt') || fileNames.has('pyproject.toml')) {
    frameworks.add('Python');
  }
  if (fileNames.has('go.mod')) {
    frameworks.add('Go');
  }
  if (fileNames.has('Cargo.toml')) {
    frameworks.add('Rust');
  }
  if (fileNames.has('pom.xml') || fileNames.has('build.gradle')) {
    frameworks.add('Java');
  }

  if (packageJsonText) {
    if (/"next"\s*:/i.test(packageJsonText)) {
      frameworks.add('Next.js');
    }
    if (/"react"\s*:/i.test(packageJsonText)) {
      frameworks.add('React');
    }
    if (/"nestjs"\s*:/i.test(packageJsonText)) {
      frameworks.add('NestJS');
    }
    if (/"vite"\s*:/i.test(packageJsonText)) {
      frameworks.add('Vite');
    }
  }

  return [...frameworks];
}

function detectDeploymentSignals(fileNames: Set<string>, readmeText: string | null) {
  const signals = new Set<string>();

  if (fileNames.has('Dockerfile') || fileNames.has('docker-compose.yml')) {
    signals.add('Docker');
  }
  if (fileNames.has('vercel.json')) {
    signals.add('Vercel');
  }
  if (fileNames.has('netlify.toml')) {
    signals.add('Netlify');
  }
  if (fileNames.has('terraform') || fileNames.has('main.tf')) {
    signals.add('Terraform');
  }
  if (readmeText && /kubernetes|helm|ecs|terraform|vercel|netlify/i.test(readmeText)) {
    signals.add('Deployment docs');
  }

  return [...signals];
}

function buildRepoSummary(
  frameworks: string[],
  deploymentSignals: string[],
  keyFiles: string[],
) {
  if (frameworks.length === 0 && deploymentSignals.length === 0) {
    return '레포 루트 기준으로 뚜렷한 프레임워크/배포 신호는 약합니다. 추가 디렉터리 분석이 필요할 수 있습니다.';
  }

  return `레포는 ${frameworks.join(', ') || 'unknown stack'} 중심으로 보이며, ${deploymentSignals.join(', ') || '배포 신호는 제한적'} 흔적이 있습니다. 핵심 파일은 ${keyFiles.join(', ') || '뚜렷하지 않음'} 입니다.`;
}
