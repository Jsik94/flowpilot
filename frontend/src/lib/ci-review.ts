import { buildWorkflowGraph } from './workflow-graph';
import { parseWorkflowMeta } from './workflow-map';
import type {
  AnalysisResult,
  BranchComparison,
  CiReviewFinding,
  CiReviewReport,
  RepoInsight,
  RunSummary,
  WorkflowDiagnostic,
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
  diagnostics: Record<string, WorkflowDiagnostic>;
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
  longestChain: number;
  hasFullySequentialFlow: boolean;
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
  diagnostics,
}: BuildCiReviewReportInput): CiReviewReport {
  const assessments = previews.map((preview) => assessWorkflow(preview));
  const findings = assessments.flatMap((assessment) => assessment.findings);
  const preMergeCount = workflowMap?.nodes.filter((node) => node.phaseLabel === 'PR').length ?? 0;
  const postMergeCount =
    workflowMap?.nodes.filter((node) => ['Push', 'Pipeline', 'Release'].includes(node.phaseLabel)).length ?? 0;
  const manualCount =
    workflowMap?.nodes.filter((node) => ['Manual', 'Schedule', 'Other'].includes(node.phaseLabel)).length ?? 0;
  const jobCount = assessments.reduce((count, assessment) => count + assessment.graph.jobs.length, 0);
  const failedWorkflowCount = Object.values(diagnostics).filter((diagnostic) => diagnostic.failureCount > 0).length;

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

  const mergedAiFindings = Object.values(diagnostics)
    .flatMap((diagnostic) =>
      (diagnostic.analysis?.issues ?? []).slice(0, 2).map<CiReviewFinding>((issue) => ({
        id: `analysis-${diagnostic.workflowId}-${issue.id}`,
        severity: issue.severity,
        category: 'reliability',
        workflowName: diagnostic.workflowName,
        filePath: previews.find((preview) => preview.path === diagnostic.workflowId)?.path,
        summary: issue.title,
        recommendation: issue.summary || '선택된 workflow 세부 이슈를 확인하세요.',
      })),
    )
    .slice(0, 6);

  if (mergedAiFindings.length === 0 && analysisResult?.issues.length) {
    mergedAiFindings.push(
      ...analysisResult.issues.slice(0, 2).map<CiReviewFinding>((issue) => ({
        id: `analysis-${issue.id}`,
        severity: issue.severity,
        category: 'reliability',
        summary: issue.title,
        recommendation: issue.summary || '선택된 workflow 세부 이슈를 확인하세요.',
      })),
    );
  }
  findings.push(...mergedAiFindings);
  const roleAnalysis = analyzeWorkflowRoles(assessments);
  findings.push(
    ...roleAnalysis.overlaps.map<CiReviewFinding>((overlap) => ({
      id: `duplication-${overlap.role}`,
      severity: 'info',
      category: 'duplication',
      summary: `${overlap.role} 역할이 여러 workflow에 분산되어 있습니다.`,
      evidence: overlap.workflows.join(', '),
      impact: '유사한 검증/운영 로직이 여러 파일에 흩어지면 수정 누락과 정책 불일치가 생기기 쉽습니다.',
      recommendation: overlap.summary,
    })),
  );

  const dedupedFindings = dedupeFindings(findings)
    .sort(compareFindingSeverity)
    .slice(0, 8);

  const categoryScores = buildCategoryScores(assessments, dedupedFindings, preMergeCount);
  const score = Math.round(categoryScores.reduce((sum, category) => sum + category.score, 0) / categoryScores.length);
  const strengths = buildStrengths(assessments, repoInsight, preMergeCount, postMergeCount);
  const watchouts = dedupedFindings.slice(0, 3).map((finding) => finding.summary);
  const quickWins = dedupeStrings(dedupedFindings.slice(0, 4).map((finding) => finding.recommendation)).slice(0, 4);
  const optimizationInsights = buildOptimizationInsights(assessments, roleAnalysis);

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
      failedWorkflowCount,
    }),
    score,
    stats: {
      workflowCount: previews.length,
      preMergeCount,
      postMergeCount,
      manualCount,
      jobCount,
      runCount: runs.length,
      failedWorkflowCount,
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
    roleAnalysis,
    optimizationInsights,
    failureInsights: buildFailureInsights(diagnostics),
    workflowCards: assessments
      .map((assessment) => {
        const diagnostic = diagnostics[assessment.preview.path];

        return {
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
          estimatedDurationText:
            diagnostic?.estimatedDurationMinutes != null
              ? `예상 ${diagnostic.estimatedDurationMinutes}분`
              : '예상 시간 정보 없음',
          failureText:
            diagnostic && diagnostic.failureCount > 0
              ? `최근 실패 ${diagnostic.failureCount}건 · ${diagnostic.latestFailureJobs.join(', ') || '실패 job 확인 필요'}`
              : '최근 실패 없음',
          analysisSummary:
            diagnostic?.analysis?.summary ?? '세부 분석 요약이 아직 없습니다.',
        };
      })
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
  const longestChain = getLongestJobChain(graph);
  const hasFullySequentialFlow = isFullySequential(graph);

  if (/permissions:\s*write-all/i.test(content) || /contents:\s*write/i.test(content)) {
    const location = findYamlBlock(content, /(permissions:\s*write-all|contents:\s*write)/i);
    findings.push({
      id: `${preview.fileName}-permissions`,
      severity: 'critical',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: location?.snippet,
      impact: '기본 GITHUB_TOKEN이 넓은 쓰기 권한을 가지면 PR이나 외부 action과 결합될 때 변경 범위가 과도해질 수 있습니다.',
      summary: `${preview.workflowName}의 권한 범위가 넓습니다.`,
      recommendation: 'workflow 또는 job 수준 permissions를 최소 권한으로 축소하세요.',
    });
  } else if (!/permissions:/i.test(content)) {
    const location = findYamlBlock(content, /^on:/im);
    findings.push({
      id: `${preview.fileName}-permissions-missing`,
      severity: 'info',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: 'permissions 블록이 보이지 않습니다.',
      impact: '기본 토큰 권한에 의존하면 어떤 scope를 쓰는지 리뷰 단계에서 드러나지 않아 보안 검토가 어려워집니다.',
      summary: `${preview.workflowName}에 명시적 permissions 설정이 없습니다.`,
      recommendation: '기본 토큰 권한에 기대기보다 필요한 scope만 명시하는 편이 안전합니다.',
    });
  }

  if (!hasTimeout) {
    const location = findYamlBlock(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-timeout`,
      severity: 'warning',
      category: 'reliability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: 'timeout-minutes 선언이 없습니다.',
      impact: 'hang이나 외부 API 지연이 발생했을 때 runner 점유 시간이 길어지고, queue 병목이 생길 수 있습니다.',
      summary: `${preview.workflowName}에는 timeout 제한이 없습니다.`,
      recommendation: 'job 또는 workflow에 timeout-minutes를 추가해 stuck runner를 줄이세요.',
    });
  }

  if (/setup-node/i.test(content) && !hasCache) {
    const location = findYamlBlock(content, /setup-node/i);
    findings.push({
      id: `${preview.fileName}-cache`,
      severity: 'warning',
      category: 'performance',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: location?.snippet,
      impact: '의존성 설치가 매 실행마다 반복되면 PR 검증 시간이 길어지고, 리뷰 피드백 루프가 느려집니다.',
      summary: `${preview.workflowName}는 Node 의존성 캐시가 보이지 않습니다.`,
      recommendation: 'actions/setup-node cache 또는 actions/cache로 설치 비용을 줄이세요.',
    });
  }

  if (/(deploy|release|publish)/i.test(`${preview.fileName} ${preview.workflowName}`) && !/concurrency:/i.test(content)) {
    const location = findYamlBlock(content, /(deploy|release|publish)/i);
    findings.push({
      id: `${preview.fileName}-concurrency`,
      severity: 'warning',
      category: 'reliability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: 'concurrency 블록이 보이지 않습니다.',
      impact: '같은 브랜치나 환경에 대한 배포가 겹치면 이전 실행 결과를 덮어쓰거나 순서 역전이 생길 수 있습니다.',
      summary: `${preview.workflowName}는 배포 성격인데 concurrency 보호가 없습니다.`,
      recommendation: '같은 환경 배포가 겹치지 않도록 concurrency 그룹을 설정하세요.',
    });
  }

  const unpinnedActions = extractUnpinnedActions(content);
  if (unpinnedActions.length > 0) {
    const location = findYamlBlock(content, /uses:\s*[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@/i);
    findings.push({
      id: `${preview.fileName}-unpinned-actions`,
      severity: 'info',
      category: 'security',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: unpinnedActions.slice(0, 3).join(', '),
      impact: '태그 기반 action 참조는 상위 버전 변경에 따라 실행 결과가 바뀔 수 있어 재현성이 약해집니다.',
      summary: `${preview.workflowName}에서 SHA로 고정되지 않은 action 참조가 있습니다.`,
      recommendation: `${unpinnedActions.slice(0, 3).join(', ')} 같은 action은 SHA pinning을 검토하세요.`,
    });
  }

  if (graph.jobs.length >= 6 && !/workflow_call:/i.test(content)) {
    const location = findYamlBlock(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-split`,
      severity: 'info',
      category: 'maintainability',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: `job ${graph.jobs.length}개`,
      impact: '역할이 많은 workflow가 한 파일에 모이면 변경 리뷰 시 영향 범위 추적과 재사용이 어려워집니다.',
      summary: `${preview.workflowName}는 job 수가 많아 단일 workflow로 읽기 부담이 있습니다.`,
      recommendation: 'reusable workflow 또는 역할별 파일 분리로 구조를 단순화하는 것을 검토하세요.',
    });
  }

  if (hasPostMergeTrigger && !hasPreMergeTrigger && /test|build|lint|check/i.test(`${preview.workflowName} ${preview.fileName}`)) {
    const location = findYamlBlock(content, /^on:/im);
    findings.push({
      id: `${preview.fileName}-late-validation`,
      severity: 'warning',
      category: 'coverage',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: location?.snippet,
      impact: '검증성 workflow가 머지 이후에만 실행되면 문제를 늦게 발견하게 되어 롤백 비용이 커집니다.',
      summary: `${preview.workflowName}는 검증 workflow로 보이지만 머지 이후에만 실행됩니다.`,
      recommendation: '가능하면 pull_request 또는 merge_group 트리거를 추가해 앞단에서 검증하세요.',
    });
  }

  if (graph.jobs.length >= 3 && hasFullySequentialFlow) {
    const location = findYamlBlock(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-serial-chain`,
      severity: 'warning',
      category: 'latency',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: `job ${graph.jobs.length}개가 직렬로 연결되어 있습니다.`,
      impact: '독립적으로 병렬 처리할 수 있는 단계까지 한 줄로 묶이면 PR 대기 시간이 불필요하게 길어질 수 있습니다.',
      summary: `${preview.workflowName}는 job 의존성이 길게 직렬화되어 있습니다.`,
      recommendation: '독립 가능한 lint/test/build 단계는 needs를 재검토해 병렬화할 수 있는지 확인하세요.',
    });
  }

  if (graph.jobs.length <= 1 && graph.jobs[0]?.steps.length >= 7) {
    const location = findYamlBlock(content, /^jobs:/im);
    findings.push({
      id: `${preview.fileName}-single-job-heavy`,
      severity: 'info',
      category: 'latency',
      workflowName: preview.workflowName,
      filePath: preview.path,
      line: location?.line,
      lineEnd: location?.lineEnd,
      blockLabel: location?.label,
      evidence: `단일 job에 step ${graph.jobs[0]?.steps.length}개`,
      impact: '한 job에 검증 단계가 과도하게 몰리면 실패 원인 구분과 병렬화 포인트 탐색이 어려워집니다.',
      summary: `${preview.workflowName}는 단일 job에 단계가 몰려 있어 병렬화 여지가 있습니다.`,
      recommendation: 'lint/test/build처럼 독립 가능한 step은 job 분리 후 병렬 실행을 검토하세요.',
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
    longestChain,
    hasFullySequentialFlow,
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
    {
      key: 'duplication',
      label: '중복 작업',
      base: 82,
      summary:
        findings.some((finding) => finding.category === 'duplication')
          ? '비슷한 역할의 workflow가 겹쳐 있어 책임 분리와 재사용 경계를 다시 볼 필요가 있습니다.'
          : '큰 역할 중복은 적어 보이며 workflow 책임이 비교적 구분됩니다.',
    },
    {
      key: 'latency',
      label: '지연 시간',
      base: assessments.some((assessment) => assessment.hasFullySequentialFlow) ? 68 : 84,
      summary:
        findings.some((finding) => finding.category === 'latency')
          ? '직렬 실행과 무거운 단일 job 때문에 전체 리드타임이 길어질 가능성이 있습니다.'
          : '눈에 띄는 병목은 적고, 추가 최적화 여지가 제한적입니다.',
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
  failedWorkflowCount?: number;
}) {
  const branchDelta =
    input.branchComparison && input.branchComparison.currentBranch !== input.branchComparison.baseBranch
      ? `${input.branchComparison.baseBranch} 대비 workflow 차이가 존재합니다.`
      : '기본 브랜치와 비교했을 때 큰 구조 차이는 제한적입니다.';

  return `브랜치 ${input.selectedBranch}에는 총 ${input.workflowCount}개의 workflow가 있고, 머지 이전 ${input.preMergeCount}개 / 머지 이후 ${input.postMergeCount}개 흐름이 보입니다. 현재 CI 평가는 ${input.score}점 수준이며, 최근 실패가 관찰된 workflow는 ${input.failedWorkflowCount ?? 0}개입니다. ${input.repoInsight?.summary ?? '레포 신호는 아직 제한적입니다.'} ${branchDelta}`;
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

function findYamlBlock(content: string, pattern: RegExp) {
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      const startIndent = getIndent(line);
      let blockStart = index;
      while (blockStart > 0) {
        const current = lines[blockStart]?.trim() ?? '';
        if (current) {
          break;
        }
        blockStart -= 1;
      }

      let blockEnd = index;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const current = lines[cursor] ?? '';
        const trimmed = current.trim();
        if (!trimmed) {
          continue;
        }

        if (getIndent(current) <= startIndent) {
          break;
        }

        blockEnd = cursor;
      }

      return {
        line: index + 1,
        lineEnd: blockEnd + 1,
        snippet: lines.slice(index, Math.min(blockEnd + 1, index + 3)).map((item) => item.trim()).join(' | '),
        label: inferBlockLabel(lines, index),
      };
    }
  }

  return null;
}

function inferBlockLabel(lines: string[], index: number) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const trimmed = (lines[cursor] ?? '').trim();
    if (!trimmed || trimmed.startsWith('- ')) {
      continue;
    }

    if (/^[A-Za-z0-9_.-]+:\s*$/.test(trimmed)) {
      return trimmed.replace(/:\s*$/, '');
    }

    if (/^(jobs|on|permissions|steps):/.test(trimmed)) {
      return trimmed.replace(/:\s*.*$/, '');
    }
  }

  return 'workflow';
}

function getIndent(line: string) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function analyzeWorkflowRoles(assessments: WorkflowAssessment[]) {
  const groups = new Map<string, string[]>();

  for (const assessment of assessments) {
    const roles = classifyWorkflowRoles(assessment);

    for (const role of roles) {
      groups.set(role, [...(groups.get(role) ?? []), assessment.preview.workflowName]);
    }
  }

  const overlaps = [...groups.entries()]
    .filter(([, workflows]) => workflows.length >= 2)
    .map(([role, workflows]) => ({
      role,
      workflows,
      summary: `${role} 역할을 가진 workflow가 ${workflows.length}개라 책임이 분산되거나 중복될 수 있습니다.`,
    }))
    .slice(0, 5);

  const requiredRoles = [
    {
      role: 'PR Validation',
      check: () => assessments.some((assessment) => assessment.hasPreMergeTrigger),
      summary: '머지 이전 검증 체인이 약해 변경 리스크를 늦게 발견할 수 있습니다.',
      recommendation: 'pull_request 또는 merge_group 기준 검증 workflow를 명시적으로 두는 편이 좋습니다.',
    },
    {
      role: 'Post-merge CI',
      check: () => assessments.some((assessment) => assessment.hasPostMergeTrigger),
      summary: '머지 이후 기본 브랜치 건강도나 배포 전 파이프라인이 명확하지 않습니다.',
      recommendation: 'push 또는 workflow_run 기준 후속 CI workflow를 구성해 메인 브랜치 상태를 지속적으로 확인하세요.',
    },
    {
      role: 'Release / Deploy Guard',
      check: () => assessments.some((assessment) => classifyWorkflowRoles(assessment).includes('Release / Deploy')),
      summary: '배포 또는 릴리스 전용 workflow가 보이지 않아 운영 단계의 책임이 불명확합니다.',
      recommendation: 'release, deploy, publish 역할을 별도 workflow로 분리해 운영 흐름을 명확히 하세요.',
    },
    {
      role: 'Manual Ops',
      check: () => assessments.some((assessment) => assessment.hasManualTrigger),
      summary: '수동 또는 예약 실행용 workflow가 부족해 긴급 점검, 재색인, 운영성 작업이 모두 자동 흐름에 묶일 수 있습니다.',
      recommendation: 'workflow_dispatch 또는 schedule 기반 운영용 workflow를 분리하는 것이 좋습니다.',
    },
  ];

  const gaps = requiredRoles
    .filter((role) => !role.check())
    .map((role) => ({
      role: role.role,
      summary: role.summary,
      recommendation: role.recommendation,
    }));

  return { overlaps, gaps };
}

function buildOptimizationInsights(
  assessments: WorkflowAssessment[],
  roleAnalysis: ReturnType<typeof analyzeWorkflowRoles>,
) {
  const duplicateWork = roleAnalysis.overlaps.map((overlap) => overlap.summary);
  const latencyRisks = assessments
    .filter((assessment) => assessment.hasFullySequentialFlow || assessment.longestChain >= 4)
    .map(
      (assessment) =>
        `${assessment.preview.workflowName}는 longest chain ${assessment.longestChain} 단계로 이어져 전체 실행 시간이 길어질 수 있습니다.`,
    )
    .slice(0, 4);

  const efficiencyTips = dedupeStrings([
    ...assessments
      .filter((assessment) => !assessment.hasCache && /setup-node/i.test(assessment.preview.content))
      .map((assessment) => `${assessment.preview.workflowName}: setup-node cache 또는 actions/cache 적용`),
    ...assessments
      .filter((assessment) => assessment.hasFullySequentialFlow)
      .map((assessment) => `${assessment.preview.workflowName}: needs 체인을 재검토해 lint/test/build 병렬화 가능성 확인`),
    ...roleAnalysis.overlaps.map((overlap) => `${overlap.role}: reusable workflow 또는 공통 action으로 중복 로직 통합 검토`),
  ]).slice(0, 6);

  return {
    duplicateWork,
    latencyRisks,
    efficiencyTips,
  };
}

function buildFailureInsights(diagnostics: Record<string, WorkflowDiagnostic>) {
  const items = Object.values(diagnostics)
    .filter((diagnostic) => diagnostic.failureCount > 0)
    .sort((left, right) => right.failureCount - left.failureCount)
    .map((diagnostic) => ({
      workflowName: diagnostic.workflowName,
      fileName: diagnostic.fileName,
      failureCount: diagnostic.failureCount,
      latestFailureJobs: diagnostic.latestFailureJobs,
    }))
    .slice(0, 6);

  return {
    summary:
      items.length > 0
        ? `현재 브랜치 기준으로 최근 실패가 관찰된 workflow ${items.length}개를 우선 정리했습니다.`
        : '현재 브랜치 기준으로 최근 실패가 뚜렷하게 관찰된 workflow는 많지 않습니다.',
    items,
  };
}

function classifyWorkflowRoles(assessment: WorkflowAssessment) {
  const source = `${assessment.preview.workflowName} ${assessment.preview.fileName} ${assessment.graph.jobs.map((job) => job.title).join(' ')}`.toLowerCase();
  const roles = new Set<string>();

  if (assessment.hasPreMergeTrigger || /\b(pr|review|lint|test|check)\b/.test(source)) {
    roles.add('PR Validation');
  }

  if (assessment.hasPostMergeTrigger || /\b(ci|build|verify|pipeline)\b/.test(source)) {
    roles.add('Post-merge CI');
  }

  if (/\b(deploy|release|publish|promote|backmerge)\b/.test(source)) {
    roles.add('Release / Deploy');
  }

  if (/\b(label|docs|index|sync|metadata)\b/.test(source)) {
    roles.add('Repository Maintenance');
  }

  if (assessment.hasManualTrigger || /\b(manual|nightly|schedule|ops|dispatch)\b/.test(source)) {
    roles.add('Manual Ops');
  }

  if (roles.size === 0) {
    roles.add('General Automation');
  }

  return [...roles];
}

function getLongestJobChain(graph: WorkflowGraph) {
  const nodeMap = new Map(graph.jobs.map((job) => [job.id, job]));
  const memo = new Map<string, number>();

  const visit = (jobId: string): number => {
    const cached = memo.get(jobId);
    if (cached) {
      return cached;
    }

    const job = nodeMap.get(jobId);
    if (!job) {
      return 0;
    }

    const depth =
      job.needs.length === 0
        ? 1
        : 1 + Math.max(...job.needs.map((dependency) => visit(dependency)).filter(Boolean));

    memo.set(jobId, depth);
    return depth;
  };

  return Math.max(0, ...graph.jobs.map((job) => visit(job.id)));
}

function isFullySequential(graph: WorkflowGraph) {
  if (graph.jobs.length < 3) {
    return false;
  }

  const roots = graph.jobs.filter((job) => job.needs.length === 0);
  if (roots.length !== 1) {
    return false;
  }

  return graph.jobs.every((job) => job.needs.length <= 1);
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
