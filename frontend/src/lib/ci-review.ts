import { buildWorkflowGraph } from './workflow-graph';
import { parseWorkflowMeta } from './workflow-map';
import type {
  AnalysisResult,
  BranchComparison,
  CiReviewFinding,
  CiReviewReport,
  RepoInsight,
  RunSummary,
  WorkflowMap,
  WorkflowGraph,
  WorkflowPreview,
} from '../types';

type BuildCiReviewReportInput = {
  selectedBranch: string;
  previews: WorkflowPreview[];
  workflowMap: WorkflowMap | null;
  repoInsight: RepoInsight | null;
  branchComparison: BranchComparison | null;
  runs: RunSummary[];
  analysisResult: AnalysisResult | null;
};

type WorkflowAssessment = {
  preview: WorkflowPreview;
  graph: WorkflowGraph;
  meta: ReturnType<typeof parseWorkflowMeta>;
  findings: CiReviewFinding[];
  hasTimeout: boolean;
  hasCache: boolean;
  hasManualTrigger: boolean;
  hasPreMergeTrigger: boolean;
  hasPostMergeTrigger: boolean;
};

export function buildWorkflowNarrative(
  preview: WorkflowPreview,
  workflowGraph: WorkflowGraph | null,
  runs: RunSummary[],
) {
  const meta = parseWorkflowMeta(preview.content, preview.workflowName);
  const graph = workflowGraph ?? buildWorkflowGraph(preview.content, preview.workflowName);
  const triggerLabels = meta.triggers.length > 0 ? meta.triggers.map(formatTrigger).join(', ') : '명시적 트리거가 보이지 않는';
  const branchTargets = [...new Set(meta.branchRules.map((rule) => rule.split(':')[1]).filter(Boolean))];
  const flowSummary =
    graph.jobs.length > 0
      ? graph.jobs.slice(0, 4).map((job) => job.title).join(' -> ')
      : 'job 구성이 아직 파악되지 않았습니다';

  const sentences = [
    `${preview.workflowName}은 ${triggerLabels} 이벤트를 기준으로 동작하는 workflow입니다.`,
    branchTargets.length > 0
      ? `주요 브랜치 조건은 ${branchTargets.join(', ')}이며, 내부에는 ${graph.jobs.length}개의 job이 선언되어 있습니다.`
      : `브랜치 조건은 명시적이지 않으며, 내부에는 ${graph.jobs.length}개의 job이 선언되어 있습니다.`,
    graph.jobs.length > 0
      ? `대표 흐름은 ${flowSummary} 순서로 읽을 수 있습니다.`
      : '현재 표시된 그래프는 YAML 내부의 job과 needs 관계를 기준으로 구성됩니다.',
  ];

  if (runs.length > 0) {
    sentences.push(`최근 실행 이력은 ${runs.length}건이 확인되며, 현재 리포트는 선택한 브랜치의 구조와 최근 실행 맥락을 함께 반영합니다.`);
  }

  return sentences.join(' ');
}

export function buildCiReviewReport({
  selectedBranch,
  previews,
  workflowMap,
  repoInsight,
  branchComparison,
  runs,
  analysisResult,
}: BuildCiReviewReportInput): CiReviewReport {
  const assessments = previews.map((preview) => assessWorkflow(preview));
  const findings = assessments.flatMap((assessment) => assessment.findings);
  const preMergeCount = workflowMap?.nodes.filter((node) => node.phaseLabel === 'PR').length ?? 0;
  const postMergeCount =
    workflowMap?.nodes.filter((node) => ['Push', 'Pipeline', 'Release'].includes(node.phaseLabel)).length ?? 0;
  const manualCount =
    workflowMap?.nodes.filter((node) => ['Manual', 'Schedule', 'Other'].includes(node.phaseLabel)).length ?? 0;
  const jobCount = assessments.reduce((count, assessment) => count + assessment.graph.jobs.length, 0);

  if (preMergeCount === 0 && previews.length > 0) {
    findings.push({
      id: 'coverage-pre-merge',
      severity: 'critical',
      category: 'coverage',
      summary: '머지 이전 검증용 workflow가 보이지 않습니다.',
      recommendation: 'pull_request 또는 merge_group 기준 CI workflow를 추가해 머지 전 실패를 더 앞단에서 걸러내세요.',
    });
  }

  if (manualCount === 0 && previews.length > 0) {
    findings.push({
      id: 'coverage-manual',
      severity: 'info',
      category: 'coverage',
      summary: '수동 또는 예약 실행용 workflow가 없어 운영 점검 유연성이 낮을 수 있습니다.',
      recommendation: 'workflow_dispatch 또는 schedule을 활용해 운영 점검용 workflow를 분리하는 것을 검토하세요.',
    });
  }

  const mergedAiFindings = (analysisResult?.issues ?? []).slice(0, 2).map<CiReviewFinding>((issue) => ({
    id: `analysis-${issue.id}`,
    severity: issue.severity,
    category: 'reliability',
    summary: issue.title,
    recommendation: issue.summary || '선택된 workflow 세부 이슈를 확인하세요.',
  }));
  findings.push(...mergedAiFindings);

  const dedupedFindings = dedupeFindings(findings)
    .sort(compareFindingSeverity)
    .slice(0, 8);

  const categoryScores = buildCategoryScores(assessments, dedupedFindings, preMergeCount);
  const score = Math.round(categoryScores.reduce((sum, category) => sum + category.score, 0) / categoryScores.length);
  const strengths = buildStrengths(assessments, repoInsight, preMergeCount, postMergeCount);
  const watchouts = dedupedFindings.slice(0, 3).map((finding) => finding.summary);
  const quickWins = dedupeStrings(dedupedFindings.slice(0, 4).map((finding) => finding.recommendation)).slice(0, 4);

  return {
    headline: buildHeadline(score),
    summary: buildReportSummary({
      selectedBranch,
      workflowCount: previews.length,
      preMergeCount,
      postMergeCount,
      repoInsight,
      branchComparison,
      score,
    }),
    score,
    stats: {
      workflowCount: previews.length,
      preMergeCount,
      postMergeCount,
      manualCount,
      jobCount,
      runCount: runs.length,
    },
    strengths,
    watchouts,
    quickWins,
    categoryScores,
    architecture: {
      preMerge: workflowMap?.nodes.filter((node) => node.phaseLabel === 'PR').map((node) => node.workflowName) ?? [],
      postMerge:
        workflowMap?.nodes
          .filter((node) => ['Push', 'Pipeline', 'Release'].includes(node.phaseLabel))
          .map((node) => node.workflowName) ?? [],
      manual:
        workflowMap?.nodes
          .filter((node) => ['Manual', 'Schedule', 'Other'].includes(node.phaseLabel))
          .map((node) => node.workflowName) ?? [],
    },
    workflowCards: assessments
      .map((assessment) => ({
        workflowName: assessment.preview.workflowName,
        fileName: assessment.preview.fileName,
        triggerSummary:
          assessment.meta.triggers.length > 0
            ? assessment.meta.triggers.map(formatTrigger).join(', ')
            : 'trigger 정보 없음',
        phaseLabel: mapPhaseLabel(assessment.meta.triggers),
        jobCount: assessment.graph.jobs.length,
        riskCount: assessment.findings.filter((finding) => finding.severity !== 'info').length,
        headline: buildWorkflowCardHeadline(assessment),
      }))
      .sort((left, right) => right.riskCount - left.riskCount)
      .slice(0, 8),
    findings: dedupedFindings,
  };
}

function assessWorkflow(preview: WorkflowPreview): WorkflowAssessment {
  const graph = buildWorkflowGraph(preview.content, preview.workflowName);
  const meta = parseWorkflowMeta(preview.content, preview.workflowName);
  const findings: CiReviewFinding[] = [];
  const content = preview.content;
  const hasTimeout = /timeout-minutes:/i.test(content);
  const hasCache = /(actions\/cache|cache:\s*['"]?(npm|pnpm|yarn))/i.test(content);
  const hasManualTrigger = meta.triggers.includes('workflow_dispatch') || meta.triggers.includes('schedule');
  const hasPreMergeTrigger = meta.triggers.some((trigger) => ['pull_request', 'pull_request_target', 'merge_group'].includes(trigger));
  const hasPostMergeTrigger = meta.triggers.some((trigger) => ['push', 'workflow_run', 'workflow_call', 'release'].includes(trigger));

  if (/permissions:\s*write-all/i.test(content) || /contents:\s*write/i.test(content)) {
    const location = findLine(content, /(permissions:\s*write-all|contents:\s*write)/i);
    findings.push({
      id: `${preview.fileName}-permissions`,
      severity: 'critical',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: location?.snippet,
      impact: '기본 GITHUB_TOKEN이 넓은 쓰기 권한을 가지면 PR이나 외부 action과 결합될 때 변경 범위가 과도해질 수 있습니다.',
      summary: `${preview.workflowName}의 권한 범위가 넓습니다.`,
      recommendation: 'workflow 또는 job 수준 permissions를 최소 권한으로 축소하세요.',
    });
  } else if (!/permissions:/i.test(content)) {
    const location = findLine(content, /^on:/im);
    findings.push({
      id: `${preview.fileName}-permissions-missing`,
      severity: 'info',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: 'permissions 블록이 보이지 않습니다.',
      impact: '기본 토큰 권한에 의존하면 어떤 scope를 쓰는지 리뷰 단계에서 드러나지 않아 보안 검토가 어려워집니다.',
      summary: `${preview.workflowName}에 명시적 permissions 설정이 없습니다.`,
      recommendation: '기본 토큰 권한에 기대기보다 필요한 scope만 명시하는 편이 안전합니다.',
    });
  }

  if (!hasTimeout) {
    const location = findLine(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-timeout`,
      severity: 'warning',
      category: 'reliability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: 'timeout-minutes 선언이 없습니다.',
      impact: 'hang이나 외부 API 지연이 발생했을 때 runner 점유 시간이 길어지고, queue 병목이 생길 수 있습니다.',
      summary: `${preview.workflowName}에는 timeout 제한이 없습니다.`,
      recommendation: 'job 또는 workflow에 timeout-minutes를 추가해 stuck runner를 줄이세요.',
    });
  }

  if (/setup-node/i.test(content) && !hasCache) {
    const location = findLine(content, /setup-node/i);
    findings.push({
      id: `${preview.fileName}-cache`,
      severity: 'warning',
      category: 'performance',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: location?.snippet,
      impact: '의존성 설치가 매 실행마다 반복되면 PR 검증 시간이 길어지고, 리뷰 피드백 루프가 느려집니다.',
      summary: `${preview.workflowName}는 Node 의존성 캐시가 보이지 않습니다.`,
      recommendation: 'actions/setup-node cache 또는 actions/cache로 설치 비용을 줄이세요.',
    });
  }

  if (/(deploy|release|publish)/i.test(`${preview.fileName} ${preview.workflowName}`) && !/concurrency:/i.test(content)) {
    const location = findLine(content, /(deploy|release|publish)/i);
    findings.push({
      id: `${preview.fileName}-concurrency`,
      severity: 'warning',
      category: 'reliability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: 'concurrency 블록이 보이지 않습니다.',
      impact: '같은 브랜치나 환경에 대한 배포가 겹치면 이전 실행 결과를 덮어쓰거나 순서 역전이 생길 수 있습니다.',
      summary: `${preview.workflowName}는 배포 성격인데 concurrency 보호가 없습니다.`,
      recommendation: '같은 환경 배포가 겹치지 않도록 concurrency 그룹을 설정하세요.',
    });
  }

  const unpinnedActions = extractUnpinnedActions(content);
  if (unpinnedActions.length > 0) {
    const location = findLine(content, /uses:\s*[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@/i);
    findings.push({
      id: `${preview.fileName}-unpinned-actions`,
      severity: 'info',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: unpinnedActions.slice(0, 3).join(', '),
      impact: '태그 기반 action 참조는 상위 버전 변경에 따라 실행 결과가 바뀔 수 있어 재현성이 약해집니다.',
      summary: `${preview.workflowName}에서 SHA로 고정되지 않은 action 참조가 있습니다.`,
      recommendation: `${unpinnedActions.slice(0, 3).join(', ')} 같은 action은 SHA pinning을 검토하세요.`,
    });
  }

  if (graph.jobs.length >= 6 && !/workflow_call:/i.test(content)) {
    const location = findLine(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-split`,
      severity: 'info',
      category: 'maintainability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: `job ${graph.jobs.length}개`,
      impact: '역할이 많은 workflow가 한 파일에 모이면 변경 리뷰 시 영향 범위 추적과 재사용이 어려워집니다.',
      summary: `${preview.workflowName}는 job 수가 많아 단일 workflow로 읽기 부담이 있습니다.`,
      recommendation: 'reusable workflow 또는 역할별 파일 분리로 구조를 단순화하는 것을 검토하세요.',
    });
  }

  if (hasPostMergeTrigger && !hasPreMergeTrigger && /test|build|lint|check/i.test(`${preview.workflowName} ${preview.fileName}`)) {
    const location = findLine(content, /^on:/im);
    findings.push({
      id: `${preview.fileName}-late-validation`,
      severity: 'warning',
      category: 'coverage',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      evidence: location?.snippet,
      impact: '검증성 workflow가 머지 이후에만 실행되면 문제를 늦게 발견하게 되어 롤백 비용이 커집니다.',
      summary: `${preview.workflowName}는 검증 workflow로 보이지만 머지 이후에만 실행됩니다.`,
      recommendation: '가능하면 pull_request 또는 merge_group 트리거를 추가해 앞단에서 검증하세요.',
    });
  }

  return {
    preview,
    graph,
    meta,
    findings,
    hasTimeout,
    hasCache,
    hasManualTrigger,
    hasPreMergeTrigger,
    hasPostMergeTrigger,
  };
}

function extractUnpinnedActions(content: string) {
  const matches = [...content.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s#]+)/g)];

  return matches
    .map((match) => `${match[1]}@${match[2]}`)
    .filter((value) => {
      const [, version = ''] = value.split('@');
      return !/^[a-f0-9]{40}$/i.test(version);
    });
}

function buildCategoryScores(
  assessments: WorkflowAssessment[],
  findings: CiReviewFinding[],
  preMergeCount: number,
) {
  const categories = [
    {
      key: 'security',
      label: '보안',
      base: 82,
      summary:
        findings.some((finding) => finding.category === 'security')
          ? '토큰 권한 범위와 외부 action pinning을 먼저 점검할 필요가 있습니다.'
          : '명시적으로 드러난 보안 위험은 상대적으로 적습니다.',
    },
    {
      key: 'reliability',
      label: '안정성',
      base: 84,
      summary:
        findings.some((finding) => finding.category === 'reliability')
          ? 'timeout, concurrency, 실패 복구 관점의 보완 여지가 남아 있습니다.'
          : '현재 구조상 기본적인 안정성 장치는 비교적 잘 갖춰져 있습니다.',
    },
    {
      key: 'performance',
      label: 'CI 최적화',
      base: assessments.some((assessment) => assessment.hasCache) ? 84 : 72,
      summary:
        assessments.some((assessment) => assessment.hasCache)
          ? '일부 workflow는 캐시 전략을 이미 활용하고 있습니다.'
          : '반복 설치 비용을 줄일 캐시 전략이 부족해 보입니다.',
    },
    {
      key: 'maintainability',
      label: '유지보수성',
      base: 80,
      summary:
        findings.some((finding) => finding.category === 'maintainability')
          ? '역할이 많은 workflow가 있어 분리와 문서화가 필요합니다.'
          : '파일 역할이 비교적 분리되어 있고 구조 해석이 어렵지 않습니다.',
    },
    {
      key: 'coverage',
      label: '검증 범위',
      base: preMergeCount > 0 ? 86 : 58,
      summary:
        preMergeCount > 0
          ? '머지 이전 검증 체인이 존재해 앞단 검증 체계는 갖춰져 있습니다.'
          : '머지 이전 검증 체인이 약해 문제가 기본 브랜치로 늦게 유입될 수 있습니다.',
    },
  ] as const;

  return categories.map((category) => {
    const relatedFindings = findings.filter((finding) => finding.category === category.key);
    const penalty = relatedFindings.reduce((sum, finding) => sum + severityPenalty(finding.severity), 0);

    return {
      key: category.key,
      label: category.label,
      score: Math.max(32, category.base - penalty),
      summary: category.summary,
    };
  });
}

function buildStrengths(
  assessments: WorkflowAssessment[],
  repoInsight: RepoInsight | null,
  preMergeCount: number,
  postMergeCount: number,
) {
  const strengths: string[] = [];

  if (preMergeCount > 0) {
    strengths.push('pull_request 계열 workflow가 있어 머지 이전 검증 체인이 존재합니다.');
  }

  if (postMergeCount > 0) {
    strengths.push('push/workflow_run/release 계열 흐름이 있어 머지 이후 파이프라인 구성이 보입니다.');
  }

  if (assessments.some((assessment) => assessment.hasCache)) {
    strengths.push('일부 workflow에서 캐시 전략이 보이며 반복 실행 비용을 줄일 여지가 있습니다.');
  }

  if (assessments.filter((assessment) => assessment.hasTimeout).length >= Math.max(1, Math.ceil(assessments.length / 2))) {
    strengths.push('절반 이상의 workflow가 timeout 설정을 사용해 장시간 점유 위험을 줄이고 있습니다.');
  }

  if (repoInsight?.frameworks.length) {
    strengths.push(`레포 기술 스택이 ${repoInsight.frameworks.join(', ')} 수준까지 드러나 있어 workflow 역할 추론이 가능합니다.`);
  }

  return strengths.slice(0, 4);
}

function buildHeadline(score: number) {
  if (score >= 85) {
    return '전반적으로 잘 구성된 CI 체계입니다.';
  }

  if (score >= 72) {
    return '기본 구조는 갖춰졌지만 몇 가지 핵심 보완이 필요합니다.';
  }

  return 'CI 구조를 한 번 정리하고 핵심 보호 장치를 보강할 시점입니다.';
}

function buildReportSummary(input: {
  selectedBranch: string;
  workflowCount: number;
  preMergeCount: number;
  postMergeCount: number;
  repoInsight: RepoInsight | null;
  branchComparison: BranchComparison | null;
  score: number;
}) {
  const branchDelta =
    input.branchComparison && input.branchComparison.currentBranch !== input.branchComparison.baseBranch
      ? `${input.branchComparison.baseBranch} 대비 workflow 차이가 존재합니다.`
      : '기본 브랜치와 비교했을 때 큰 구조 차이는 제한적입니다.';

  return `브랜치 ${input.selectedBranch}에는 총 ${input.workflowCount}개의 workflow가 있고, 머지 이전 ${input.preMergeCount}개 / 머지 이후 ${input.postMergeCount}개 흐름이 보입니다. 현재 CI 평가는 ${input.score}점 수준이며, ${input.repoInsight?.summary ?? '레포 신호는 아직 제한적입니다.'} ${branchDelta}`;
}

function dedupeFindings(findings: CiReviewFinding[]) {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.category}:${finding.summary}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function compareFindingSeverity(left: CiReviewFinding, right: CiReviewFinding) {
  return severityPenalty(right.severity) - severityPenalty(left.severity);
}

function severityPenalty(severity: 'critical' | 'warning' | 'info') {
  switch (severity) {
    case 'critical':
      return 22;
    case 'warning':
      return 12;
    default:
      return 6;
  }
}

function formatTrigger(trigger: string) {
  switch (trigger) {
    case 'pull_request':
      return 'PR';
    case 'pull_request_target':
      return 'PR target';
    case 'merge_group':
      return 'merge queue';
    case 'push':
      return 'push';
    case 'workflow_run':
      return 'workflow run';
    case 'workflow_call':
      return 'reusable workflow';
    case 'workflow_dispatch':
      return 'manual';
    case 'schedule':
      return 'schedule';
    default:
      return trigger;
  }
}

function findLine(content: string, pattern: RegExp) {
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      return {
        line: index + 1,
        snippet: line.trim(),
      };
    }
  }

  return null;
}

function mapPhaseLabel(triggers: string[]) {
  if (triggers.some((trigger) => ['pull_request', 'pull_request_target', 'merge_group'].includes(trigger))) {
    return '머지 이전';
  }

  if (triggers.some((trigger) => ['push', 'workflow_run', 'workflow_call', 'release'].includes(trigger))) {
    return '머지 이후';
  }

  return '수동/기타';
}

function buildWorkflowCardHeadline(assessment: WorkflowAssessment) {
  if (assessment.findings.some((finding) => finding.severity === 'critical')) {
    return '보안 또는 검증 관점에서 먼저 손봐야 할 항목이 있습니다.';
  }

  if (assessment.findings.some((finding) => finding.severity === 'warning')) {
    return '기본 구조는 보이지만 안정성/성능 튜닝 포인트가 남아 있습니다.';
  }

  return '현재 구조상 큰 경고는 적고, 역할이 비교적 분명한 workflow입니다.';
}
