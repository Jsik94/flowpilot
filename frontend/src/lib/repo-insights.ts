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
  const paths = entries.map((entry) => entry.path);
  const fileNames = new Set(entries.map((entry) => entry.name));
  const frameworks = detectFrameworks(fileNames, paths, packageJsonText);
  const deploymentSignals = detectDeploymentSignals(paths, readmeText);
  const packageManager = detectPackageManager(fileNames, packageJsonText);
  const workspaceRoots = detectWorkspaceRoots(paths);
  const monorepo =
    workspaceRoots.length >= 2 ||
    fileNames.has('pnpm-workspace.yaml') ||
    fileNames.has('turbo.json') ||
    fileNames.has('nx.json');
  const testSignals = detectTestSignals(fileNames, paths, packageJsonText, readmeText);
  const keyFiles = [
    'package.json',
    'pnpm-workspace.yaml',
    'turbo.json',
    'nx.json',
    'Dockerfile',
    'docker-compose.yml',
    'README.md',
  ].filter((fileName) => fileNames.has(fileName));
  const analysisStages = buildRepoAnalysisStages({
    frameworks,
    packageManager,
    monorepo,
    workspaceRoots,
    testSignals,
    deploymentSignals,
    keyFiles,
  });

  const confidence =
    frameworks.length >= 2 || deploymentSignals.length >= 2 || testSignals.length >= 2
      ? 'high'
      : frameworks.length > 0 || deploymentSignals.length > 0 || testSignals.length > 0
        ? 'medium'
        : 'low';

  return {
    summary: buildRepoSummary({
      frameworks,
      deploymentSignals,
      keyFiles,
      packageManager,
      monorepo,
      testSignals,
    }),
    frameworks,
    keyFiles,
    deploymentSignals,
    packageManager,
    monorepo,
    workspaceRoots,
    testSignals,
    analysisStages,
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
    '## Priority Actions',
    ciReview?.priorityActions.length
      ? ciReview.priorityActions
          .map(
            (action) =>
              `- [${action.severity}] ${action.title}${action.workflowName ? ` (${action.workflowName})` : ''}\n  Why: ${action.why}\n  Expected impact: ${action.expectedImpact}`,
          )
          .join('\n')
      : '- priority actions unavailable',
    '',
    '## Workflow Inventory',
    ciReview?.inventoryRows.length
      ? [
          '| Workflow | Phase | Trigger | Roles | Jobs | Risk | ETA | Failure |',
          '| --- | --- | --- | --- | ---: | ---: | --- | --- |',
          ...ciReview.inventoryRows.map(
            (row) =>
              `| ${row.workflowName} | ${row.phaseLabel} | ${row.triggerSummary} | ${row.roles.join(', ')} | ${row.jobCount} | ${row.riskCount} | ${row.estimatedDurationText} | ${row.failureText} |`,
          ),
        ].join('\n')
      : '- workflow inventory unavailable',
    '',
    '## Flow Lanes',
    ciReview?.flowLanes.length
      ? ciReview.flowLanes
          .map(
            (lane) =>
              `- ${lane.label}: ${lane.description}\n${lane.items.map((item) => `  - ${item.workflowName} (${item.fileName}) - ${item.summary}`).join('\n') || '  - none'}`,
          )
          .join('\n')
      : '- flow lanes unavailable',
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
    '## Category Heatmap',
    ciReview?.heatmapRows.length
      ? ciReview.heatmapRows
          .map(
            (row) =>
              `- ${row.workflowName}: ${row.cells.map((cell) => `${cell.label} ${cell.level}${cell.count ? `(${cell.count})` : ''}`).join(' / ')}`,
          )
          .join('\n')
      : '- category heatmap unavailable',
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
    '## Optimization Table',
    ciReview?.optimizationRows.length
      ? ciReview.optimizationRows
          .map(
            (row) =>
              `- ${row.focus}: ${row.issue}${row.workflowName ? ` (${row.workflowName})` : ''}\n  Evidence: ${row.evidence}\n  Recommendation: ${row.recommendation}\n  Expected impact: ${row.expectedImpact}`,
          )
          .join('\n')
      : '- optimization table unavailable',
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
    '## Repository Coverage Matrix',
    ciReview?.repoCoverageRows.length
      ? ciReview.repoCoverageRows
          .map(
            (row) =>
              `- ${row.area} [${row.status}]\n  Signal: ${row.signal}\n  Expectation: ${row.expectation}\n  Current: ${row.currentState}\n  Note: ${row.note}`,
          )
          .join('\n')
      : '- repository coverage matrix unavailable',
    '',
    `- Confidence: ${repoInsight?.confidence ?? 'unknown'}`,
    `- Frameworks: ${(repoInsight?.frameworks ?? []).join(', ') || 'none'}`,
    `- Package Manager: ${repoInsight?.packageManager ?? 'unknown'}`,
    `- Monorepo: ${repoInsight?.monorepo ? 'yes' : 'no'}`,
    `- Workspace Roots: ${(repoInsight?.workspaceRoots ?? []).join(', ') || 'none'}`,
    `- Test Signals: ${(repoInsight?.testSignals ?? []).join(', ') || 'none'}`,
    `- Deployment Signals: ${(repoInsight?.deploymentSignals ?? []).join(', ') || 'none'}`,
    `- Key Files: ${(repoInsight?.keyFiles ?? []).join(', ') || 'none'}`,
    '',
    '## Repository Staged Analysis',
    repoInsight?.analysisStages.length
      ? repoInsight.analysisStages
          .map(
            (stage, index) =>
              `- Stage ${index + 1} ${stage.title}: ${stage.summary}\n${stage.details.map((detail) => `  - ${detail}`).join('\n')}`,
          )
          .join('\n')
      : '- staged repository analysis unavailable',
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

export function buildReviewHtml(input: {
  repository: RepositoryRef;
  selectedBranch: string;
  preview: WorkflowPreview | null;
  workflowGraph: WorkflowGraph | null;
  repoInsight: RepoInsight | null;
  branchComparison: BranchComparison | null;
  runs: RunSummary[];
  analysisResult: AnalysisResult | null;
  ciReview: CiReviewReport | null;
}) {
  const { repository, selectedBranch, preview, branchComparison, ciReview, repoInsight, runs, workflowGraph, analysisResult } = input;
  const title = ciReview?.headline ?? analysisResult?.summary ?? 'FlowPilot Review Report';

  const stats = ciReview
    ? [
        ['Workflows', ciReview.stats.workflowCount],
        ['Jobs', ciReview.stats.jobCount],
        ['Observed Runs', ciReview.stats.runCount],
        ['Failed Workflows', ciReview.stats.failedWorkflowCount],
      ]
    : [];

  const repoStages = (ciReview?.repoStages ?? repoInsight?.analysisStages ?? [])
    .map(
      (stage) => `
        <section class="stage-card">
          <h3>${escapeHtml(stage.title)}</h3>
          <p>${escapeHtml(stage.summary)}</p>
          <ul>${stage.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
        </section>`,
    )
    .join('');

  const failureRows = ciReview?.failureInsights.items.length
    ? ciReview.failureInsights.items
        .map(
          (item) => `
            <article class="detail-card">
              <h3>${escapeHtml(item.workflowName)}</h3>
              <p class="muted">${escapeHtml(item.fileName)}</p>
              <p>최근 실패 ${item.failureCount}건</p>
              <p>${escapeHtml(item.latestFailureJobs.join(', ') || '실패 job 확인 필요')}</p>
              ${
                item.recurringFailedJobs.length
                  ? `<p class="muted">반복 실패: ${escapeHtml(item.recurringFailedJobs.map((failure) => `${failure.jobName}(${failure.count})`).join(', '))}</p>`
                  : ''
              }
            </article>`
        )
        .join('')
    : '<p class="muted">현재 브랜치 기준으로 뚜렷한 실패 패턴은 많지 않습니다.</p>';

  const lensRows = ciReview?.reviewLenses.length
    ? ciReview.reviewLenses
        .map(
          (lens) => `
            <article class="detail-card">
              <h3>${escapeHtml(lens.label)}</h3>
              <p>${escapeHtml(lens.summary)}</p>
              <ul>${lens.findings.map((finding) => `<li>${escapeHtml(finding.summary)}</li>`).join('')}</ul>
            </article>`,
        )
        .join('')
    : '<p class="muted">관점별 요약을 아직 생성하지 못했습니다.</p>';

  const inventoryRows = ciReview?.inventoryRows.length
    ? ciReview.inventoryRows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.workflowName)}<br /><span class="muted">${escapeHtml(row.fileName)}</span></td>
              <td>${escapeHtml(row.phaseLabel)}</td>
              <td>${escapeHtml(row.triggerSummary)}</td>
              <td>${escapeHtml(row.roles.join(', '))}</td>
              <td>${escapeHtml(String(row.jobCount))}</td>
              <td>${escapeHtml(String(row.riskCount))}</td>
              <td>${escapeHtml(row.estimatedDurationText)}</td>
              <td>${escapeHtml(row.failureText)}</td>
            </tr>`,
        )
        .join('')
    : '';

  const heatmapRows = ciReview?.heatmapRows.length
    ? ciReview.heatmapRows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.workflowName)}<br /><span class="muted">${escapeHtml(row.fileName)}</span></td>
              ${row.cells
                .map(
                  (cell) =>
                    `<td><span class="heatmap heatmap-${escapeHtml(cell.level)}">${escapeHtml(String(cell.count || '·'))}</span></td>`,
                )
                .join('')}
            </tr>`,
        )
        .join('')
    : '';

  const coverageRows = ciReview?.repoCoverageRows.length
    ? ciReview.repoCoverageRows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.area)}</td>
              <td>${escapeHtml(row.signal)}</td>
              <td>${escapeHtml(row.expectation)}</td>
              <td>${escapeHtml(row.currentState)}</td>
              <td><span class="badge status-${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
              <td>${escapeHtml(row.note)}</td>
            </tr>`,
        )
        .join('')
    : '';

  const optimizationRows = ciReview?.optimizationRows.length
    ? ciReview.optimizationRows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.focus)}</td>
              <td>${escapeHtml(row.workflowName ?? '브랜치 전체')}</td>
              <td>${escapeHtml(row.issue)}</td>
              <td>${escapeHtml(row.evidence)}</td>
              <td>${escapeHtml(row.recommendation)}</td>
              <td>${escapeHtml(row.expectedImpact)}</td>
            </tr>`,
        )
        .join('')
    : '';

  const flowLanes = ciReview?.flowLanes.length
    ? ciReview.flowLanes
        .map(
          (lane) => `
            <article class="detail-card">
              <h3>${escapeHtml(lane.label)}</h3>
              <p>${escapeHtml(lane.description)}</p>
              <ul>${lane.items.map((item) => `<li>${escapeHtml(`${item.workflowName} (${item.fileName}) - ${item.summary}`)}</li>`).join('')}</ul>
            </article>`,
        )
        .join('')
    : '<p class="muted">flow lanes unavailable</p>';

  const deepDives = ciReview?.workflowDeepDives.length
    ? ciReview.workflowDeepDives
        .map(
          (workflow) => `
            <article class="deep-card">
              <div class="deep-top">
                <div>
                  <h3>${escapeHtml(workflow.workflowName)}</h3>
                  <p class="muted">${escapeHtml(workflow.fileName)}</p>
                </div>
                <span class="badge">${escapeHtml(workflow.phaseLabel)}</span>
              </div>
              <p>${escapeHtml(workflow.analysisSummary)}</p>
              <p>${escapeHtml(workflow.jobFlowSummary)}</p>
              <p class="muted">${escapeHtml(workflow.triggerSummary)} · ${escapeHtml(workflow.estimatedDurationText)} · ${escapeHtml(workflow.failureText)}</p>
              <ul>${workflow.failurePatterns.map((pattern) => `<li>${escapeHtml(pattern)}</li>`).join('')}</ul>
            </article>`,
        )
        .join('')
    : '<p class="muted">workflow별 상세 분석이 아직 없습니다.</p>';

  const findings = ciReview?.findings.length
    ? ciReview.findings
        .map(
          (finding) => `
            <article class="finding-card severity-${escapeHtml(finding.severity)}">
              <h3>${escapeHtml(finding.summary)}</h3>
              <p class="muted">${escapeHtml(finding.workflowName ?? '')} ${escapeHtml(finding.filePath ?? '')}</p>
              ${finding.impact ? `<p><strong>영향</strong> ${escapeHtml(finding.impact)}</p>` : ''}
              ${finding.evidence ? `<p><strong>근거</strong> ${escapeHtml(finding.evidence)}</p>` : ''}
              <p><strong>권장 조치</strong> ${escapeHtml(finding.recommendation)}</p>
            </article>`,
        )
        .join('')
    : '<p class="muted">리뷰 finding이 없습니다.</p>';

  const priorityActions = ciReview?.priorityActions.length
    ? ciReview.priorityActions
        .map(
          (action) => `
            <article class="detail-card severity-${escapeHtml(action.severity)}">
              <h3>${escapeHtml(action.title)}</h3>
              ${action.workflowName ? `<p class="muted">${escapeHtml(action.workflowName)}</p>` : ''}
              <p><strong>왜 먼저 봐야 하나</strong> ${escapeHtml(action.why)}</p>
              <p><strong>기대 효과</strong> ${escapeHtml(action.expectedImpact)}</p>
            </article>`,
        )
        .join('')
    : '<p class="muted">우선순위 액션이 아직 없습니다.</p>';

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(repository.fullName)} CI Review</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f7fb; color: #243446; line-height: 1.6; }
      main { max-width: 1100px; margin: 0 auto; padding: 48px 24px 64px; }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 34px; margin-top: 8px; }
      h2 { font-size: 20px; margin-bottom: 16px; }
      h3 { font-size: 16px; margin-bottom: 8px; }
      .muted { color: #66788a; }
      .hero { padding: 28px 32px; border-radius: 18px; background: linear-gradient(135deg, #0f2742, #17375c); color: white; }
      .hero p { margin-top: 12px; color: rgba(255,255,255,0.82); }
      .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0 34px; }
      .stat, .section, .detail-card, .deep-card, .finding-card, .stage-card { background: white; border: 1px solid #e4ebf3; border-radius: 14px; }
      .stat { padding: 18px; text-align: center; }
      .stat strong { display: block; font-size: 26px; color: #0f2742; }
      .stat span { font-size: 12px; color: #66788a; text-transform: uppercase; }
      .section { padding: 22px; margin-top: 18px; }
      .section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .stage-grid, .detail-grid, .deep-grid, .finding-grid { display: grid; gap: 14px; }
      .stage-grid, .detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .deep-grid, .finding-grid { grid-template-columns: 1fr; }
      .detail-card, .stage-card, .deep-card, .finding-card { padding: 18px; }
      .badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: #eaf1ff; color: #274c7c; font-size: 12px; font-weight: 700; }
      .status-good { background: #e7fbf2; color: #156c52; }
      .status-watch { background: #fff5dd; color: #8a5a00; }
      .status-gap { background: #ffe8eb; color: #9a3041; }
      .table-shell { overflow-x: auto; border: 1px solid #e4ebf3; border-radius: 14px; background: #fff; }
      table { width: 100%; min-width: 880px; border-collapse: collapse; }
      th, td { padding: 14px 16px; border-bottom: 1px solid #e4ebf3; text-align: left; vertical-align: top; }
      th { color: #66788a; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; background: #f8fbff; }
      .heatmap { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; font-weight: 700; }
      .heatmap-none { background: #f1f5fb; color: #8da0b5; }
      .heatmap-info { background: #eaf1ff; color: #385a8c; }
      .heatmap-warning { background: #fff3d6; color: #8a5a00; }
      .heatmap-critical { background: #ffe5e9; color: #9a3041; }
      .deep-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      ul { margin: 10px 0 0; padding-left: 18px; }
      li + li { margin-top: 6px; }
      .severity-critical { border-color: #ffc2c8; }
      .severity-warning { border-color: #ffe2a8; }
      @media (max-width: 900px) {
        .stats, .section-grid, .stage-grid, .detail-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p>FlowPilot Review Report</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(repository.fullName)} · ${escapeHtml(selectedBranch)}${preview ? ` · ${escapeHtml(preview.workflowName)}` : ''}</p>
        <p>${escapeHtml(ciReview?.summary ?? repoInsight?.summary ?? '리포트 요약이 아직 없습니다.')}</p>
      </section>

      ${stats.length ? `<section class="stats">${stats.map(([label, value]) => `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(String(label))}</span></div>`).join('')}</section>` : ''}

      <section class="section">
        <h2>Repository Staged Analysis</h2>
        <div class="stage-grid">${repoStages}</div>
      </section>

      <section class="section">
        <h2>Workflow Inventory</h2>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Phase</th>
                <th>Trigger</th>
                <th>Roles</th>
                <th>Jobs</th>
                <th>Risk</th>
                <th>ETA</th>
                <th>Failure</th>
              </tr>
            </thead>
            <tbody>${inventoryRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>Flow Lanes</h2>
        <div class="detail-grid">${flowLanes}</div>
      </section>

      <section class="section">
        <h2>Priority Actions</h2>
        <div class="detail-grid">${priorityActions}</div>
      </section>

      <section class="section">
        <h2>Failure Snapshot</h2>
        <p class="muted">${escapeHtml(ciReview?.failureInsights.summary ?? '실패 스냅샷을 아직 생성하지 못했습니다.')}</p>
        ${ciReview?.failureInsights.patterns.length ? `<ul>${ciReview.failureInsights.patterns.map((pattern) => `<li>${escapeHtml(pattern)}</li>`).join('')}</ul>` : ''}
        <div class="detail-grid" style="margin-top: 16px;">${failureRows}</div>
      </section>

      <section class="section">
        <h2>Category Heatmap</h2>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                ${ciReview?.categoryScores.map((category) => `<th>${escapeHtml(category.label)}</th>`).join('') ?? ''}
              </tr>
            </thead>
            <tbody>${heatmapRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>Review Lenses</h2>
        <div class="detail-grid">${lensRows}</div>
      </section>

      <section class="section">
        <h2>Optimization Table</h2>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Focus</th>
                <th>Workflow</th>
                <th>Issue</th>
                <th>Evidence</th>
                <th>Recommendation</th>
                <th>Expected Impact</th>
              </tr>
            </thead>
            <tbody>${optimizationRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>Repository Coverage Matrix</h2>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th>Signal</th>
                <th>Expectation</th>
                <th>Current</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>${coverageRows}</tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>Workflow Deep Dive</h2>
        <div class="deep-grid">${deepDives}</div>
      </section>

      <section class="section">
        <h2>Review Findings</h2>
        <div class="finding-grid">${findings}</div>
      </section>

      <section class="section">
        <h2>Branch Comparison</h2>
        <p>${escapeHtml(branchComparison?.summary ?? '브랜치 비교 정보가 없습니다.')}</p>
        <p class="muted" style="margin-top: 8px;">Added: ${escapeHtml((branchComparison?.addedWorkflows ?? []).join(', ') || 'none')} · Removed: ${escapeHtml((branchComparison?.removedWorkflows ?? []).join(', ') || 'none')}</p>
      </section>

      ${
        preview && workflowGraph
          ? `<section class="section">
              <h2>Selected Workflow Structure</h2>
              <p class="muted">${escapeHtml(preview.workflowName)} · ${escapeHtml(preview.fileName)}</p>
              <ul>${workflowGraph.jobs.map((job) => `<li>${escapeHtml(job.title)}: needs [${escapeHtml(job.needs.join(', ') || 'none')}], steps ${job.steps.length}</li>`).join('')}</ul>
              ${
                runs.length
                  ? `<p class="muted" style="margin-top: 12px;">Recent runs: ${escapeHtml(runs.slice(0, 5).map((run) => `#${run.runNumber} ${run.status} ${run.event}`).join(' / '))}</p>`
                  : ''
              }
            </section>`
          : ''
      }
    </main>
  </body>
</html>`;
}

function detectFrameworks(fileNames: Set<string>, paths: string[], packageJsonText: string | null) {
  const frameworks = new Set<string>();
  const hasPath = (pattern: RegExp) => paths.some((path) => pattern.test(path));

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
  if (hasPath(/(^|\/)(Chart\.ya?ml|helm\/|k8s\/|kubernetes\/)/i)) {
    frameworks.add('Kubernetes');
  }
  if (hasPath(/\.tf$/i) || hasPath(/(^|\/)(terraform|terragrunt)\//i)) {
    frameworks.add('Terraform');
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

function detectDeploymentSignals(paths: string[], readmeText: string | null) {
  const signals = new Set<string>();
  const hasPath = (pattern: RegExp) => paths.some((path) => pattern.test(path));

  if (hasPath(/(^|\/)Dockerfile$/) || hasPath(/(^|\/)docker-compose\.ya?ml$/i)) {
    signals.add('Docker');
  }
  if (hasPath(/(^|\/)vercel\.json$/i)) {
    signals.add('Vercel');
  }
  if (hasPath(/(^|\/)netlify\.toml$/i)) {
    signals.add('Netlify');
  }
  if (hasPath(/\.tf$/i) || hasPath(/(^|\/)(terraform|terragrunt)\//i)) {
    signals.add('Terraform');
  }
  if (hasPath(/(^|\/)(k8s|kubernetes|helm)\//i)) {
    signals.add('Kubernetes');
  }
  if (readmeText && /kubernetes|helm|ecs|terraform|vercel|netlify/i.test(readmeText)) {
    signals.add('Deployment docs');
  }

  return [...signals];
}

function detectPackageManager(fileNames: Set<string>, packageJsonText: string | null) {
  if (fileNames.has('pnpm-lock.yaml') || fileNames.has('pnpm-workspace.yaml')) {
    return 'pnpm';
  }
  if (fileNames.has('yarn.lock')) {
    return 'yarn';
  }
  if (fileNames.has('bun.lockb') || fileNames.has('bun.lock')) {
    return 'bun';
  }
  if (fileNames.has('package-lock.json')) {
    return 'npm';
  }
  if (fileNames.has('poetry.lock')) {
    return 'poetry';
  }
  if (fileNames.has('requirements.txt') || fileNames.has('pyproject.toml')) {
    return 'pip';
  }
  if (packageJsonText && /"packageManager"\s*:\s*"pnpm@/i.test(packageJsonText)) {
    return 'pnpm';
  }

  return null;
}

function detectWorkspaceRoots(paths: string[]) {
  const roots = new Set<string>();

  for (const path of paths) {
    const match = path.match(/^(apps|packages|services|workers|libs)\/([^/]+)/);
    if (match) {
      roots.add(`${match[1]}/${match[2]}`);
    }
  }

  return [...roots].slice(0, 8);
}

function detectTestSignals(
  fileNames: Set<string>,
  paths: string[],
  packageJsonText: string | null,
  readmeText: string | null,
) {
  const signals = new Set<string>();
  const hasPath = (pattern: RegExp) => paths.some((path) => pattern.test(path));

  if (packageJsonText && /"test"\s*:/i.test(packageJsonText)) {
    signals.add('package.json test script');
  }
  if (packageJsonText && /vitest/i.test(packageJsonText)) {
    signals.add('Vitest');
  }
  if (packageJsonText && /jest/i.test(packageJsonText)) {
    signals.add('Jest');
  }
  if (fileNames.has('playwright.config.ts') || fileNames.has('playwright.config.js')) {
    signals.add('Playwright');
  }
  if (fileNames.has('cypress.config.ts') || fileNames.has('cypress.config.js')) {
    signals.add('Cypress');
  }
  if (fileNames.has('pytest.ini') || fileNames.has('tox.ini') || hasPath(/(^|\/)tests?\//i)) {
    signals.add('Python test layout');
  }
  if (fileNames.has('go.mod')) {
    signals.add('Go testable module');
  }
  if (fileNames.has('Cargo.toml')) {
    signals.add('Rust crate tests');
  }
  if (readmeText && /test|coverage|e2e|integration/i.test(readmeText)) {
    signals.add('README quality hints');
  }

  return [...signals];
}

function buildRepoAnalysisStages(input: {
  frameworks: string[];
  packageManager: string | null;
  monorepo: boolean;
  workspaceRoots: string[];
  testSignals: string[];
  deploymentSignals: string[];
  keyFiles: string[];
}) {
  return [
    {
      title: '스택과 패키지 매니저',
      summary:
        input.frameworks.length > 0
          ? `${input.frameworks.join(', ')} 스택 신호가 보이며, 패키지 매니저는 ${input.packageManager ?? '미상'}로 추정됩니다.`
          : '명확한 런타임/프레임워크 신호는 아직 제한적입니다.',
      details: [
        `Frameworks: ${input.frameworks.join(', ') || 'none'}`,
        `Package manager: ${input.packageManager ?? 'unknown'}`,
      ],
    },
    {
      title: '레포 토폴로지',
      summary: input.monorepo
        ? `monorepo 성격이 있으며 주요 workspace는 ${input.workspaceRoots.join(', ') || '추가 확인 필요'} 입니다.`
        : '단일 앱 또는 얕은 구조의 레포로 보입니다.',
      details: [
        input.monorepo ? 'workspace 분리형 레포로 보입니다.' : 'workspace 분리 신호가 강하지 않습니다.',
        `주요 영역: ${input.workspaceRoots.join(', ') || '루트 중심 구조'}`,
      ],
    },
    {
      title: '검증과 품질 신호',
      summary:
        input.testSignals.length > 0
          ? `${input.testSignals.join(', ')} 신호가 있어 CI에서 검증 대상이 비교적 분명합니다.`
          : '테스트/검증 신호가 약해 workflow coverage 판단이 어려울 수 있습니다.',
      details: input.testSignals.length > 0 ? input.testSignals : ['테스트 설정 파일이나 스크립트 신호가 제한적입니다.'],
    },
    {
      title: '배포와 운영 표면',
      summary:
        input.deploymentSignals.length > 0
          ? `${input.deploymentSignals.join(', ')} 신호가 있어 release/deploy workflow의 필요성을 평가할 수 있습니다.`
          : '배포/인프라 신호가 제한적이라 운영 workflow 필요성은 보수적으로 해석해야 합니다.',
      details: [
        `Deployment signals: ${input.deploymentSignals.join(', ') || 'none'}`,
        `Key files: ${input.keyFiles.join(', ') || 'none'}`,
      ],
    },
  ];
}

function buildRepoSummary(input: {
  frameworks: string[];
  deploymentSignals: string[];
  keyFiles: string[];
  packageManager: string | null;
  monorepo: boolean;
  testSignals: string[];
}) {
  if (input.frameworks.length === 0 && input.deploymentSignals.length === 0 && input.testSignals.length === 0) {
    return '레포 루트 기준으로 뚜렷한 프레임워크/배포 신호는 약합니다. 추가 디렉터리 분석이 필요할 수 있습니다.';
  }

  return `레포는 ${input.frameworks.join(', ') || 'unknown stack'} 중심으로 보이며, 패키지 매니저는 ${input.packageManager ?? '미상'}로 추정됩니다. ${input.monorepo ? 'monorepo 구조 신호가 있고,' : '단일 앱 성격이 강하며,'} ${input.testSignals.join(', ') || '검증 신호 제한적'} 및 ${input.deploymentSignals.join(', ') || '배포 신호 제한적'} 흔적이 있습니다. 핵심 파일은 ${input.keyFiles.join(', ') || '뚜렷하지 않음'} 입니다.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
