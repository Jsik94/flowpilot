export type AnalyzeRequest = {
  repo?: {
    owner?: string;
    name?: string;
    language?: string;
  };
  workflow?: {
    fileName?: string;
    workflowName?: string;
    branch?: string;
    content?: string;
  };
  runs?: Array<{
    id?: number;
    title?: string;
    status?: string;
    event?: string;
    branch?: string;
  }>;
  runJobs?: Array<{
    name?: string;
    status?: string;
    steps?: Array<{
      name?: string;
      status?: string;
    }>;
  }>;
};

export type AnalyzeResponse = {
  source: 'gemini' | 'heuristic';
  summary: string;
  issues: AnalysisIssue[];
};

type AnalysisIssue = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category?: string;
  file?: string;
  job?: string;
  title: string;
  description?: string;
  suggestion?: string;
};

export class AnalyzeService {
  async analyze(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
    const heuristic = buildHeuristicAnalysis(payload);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return heuristic;
    }

    try {
      const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: buildPrompt(payload),
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const rawText = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('\n')
        .trim();

      const parsed = rawText ? parseGeminiJson(rawText) : null;

      if (!parsed) {
        return heuristic;
      }

      return {
        source: 'gemini',
        summary: parsed.summary || heuristic.summary,
        issues: normalizeIssues(parsed.issues, payload.workflow?.fileName ?? 'workflow.yml'),
      };
    } catch {
      return heuristic;
    }
  }
}

function buildPrompt(payload: AnalyzeRequest) {
  const workflow = payload.workflow;
  const runSummary = (payload.runs ?? [])
    .slice(0, 5)
    .map((run) => `- #${run.id} ${run.status} ${run.event} ${run.branch} ${run.title ?? ''}`.trim())
    .join('\n');
  const failedJobs = (payload.runJobs ?? [])
    .filter((job) => job.status === 'failure')
    .map((job) => `- ${job.name}: ${(job.steps ?? []).filter((step) => step.status === 'failure').map((step) => step.name).join(', ') || 'step 정보 없음'}`)
    .join('\n');

  return [
    'You are reviewing a GitHub Actions workflow for an engineering team.',
    'Return JSON only with this shape:',
    '{"summary":"string","issues":[{"severity":"critical|warning|info","title":"string","job":"string","description":"string","suggestion":"string"}]}',
    'Focus on actionable problems only. Limit to at most 5 issues.',
    '',
    `Repository: ${payload.repo?.owner ?? 'unknown'}/${payload.repo?.name ?? 'unknown'}`,
    `Workflow file: ${workflow?.fileName ?? 'workflow.yml'}`,
    `Workflow name: ${workflow?.workflowName ?? workflow?.fileName ?? 'workflow.yml'}`,
    `Branch: ${workflow?.branch ?? 'unknown'}`,
    '',
    'Recent runs:',
    runSummary || '- none',
    '',
    'Failed jobs from selected run:',
    failedJobs || '- none',
    '',
    'Workflow YAML:',
    workflow?.content ?? '',
  ].join('\n');
}

function parseGeminiJson(rawText: string) {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? rawText;

  try {
    return JSON.parse(candidate) as {
      summary?: string;
      issues?: unknown[];
    };
  } catch {
    return null;
  }
}

function normalizeIssues(rawIssues: unknown[] | undefined, fileName: string) {
  return (rawIssues ?? [])
    .map<AnalysisIssue | null>((issue, index) => {
      if (!issue || typeof issue !== 'object') {
        return null;
      }

      const record = issue as Record<string, unknown>;
      const severity = normalizeSeverity(record.severity);

      return {
        id: `gemini-${index + 1}`,
        severity,
        category: 'ai',
        file: fileName,
        job: asString(record.job),
        title: asString(record.title) || '분석 이슈',
        description: asString(record.description) || '',
        suggestion: asString(record.suggestion) || '',
      };
    })
    .filter((issue): issue is AnalysisIssue => issue !== null);
}

function buildHeuristicAnalysis(payload: AnalyzeRequest): AnalyzeResponse {
  const fileName = payload.workflow?.fileName ?? 'workflow.yml';
  const content = payload.workflow?.content ?? '';
  const issues: AnalyzeResponse['issues'] = [];
  const failedJobs = (payload.runJobs ?? []).filter((job) => job.status === 'failure');

  if (/permissions:\s*write-all/i.test(content) || /contents:\s*write/i.test(content)) {
    issues.push({
      id: 'heuristic-permissions',
      severity: 'critical',
      category: 'security',
      file: fileName,
      title: '권한 범위가 넓습니다',
      description: 'workflow 또는 job 수준에서 write 권한이 넓게 열려 있습니다.',
      suggestion: '실제로 필요한 scope만 남기고 permissions를 축소하세요.',
    });
  }

  if (!/timeout-minutes:/i.test(content)) {
    issues.push({
      id: 'heuristic-timeout',
      severity: 'info',
      category: 'reliability',
      file: fileName,
      title: 'timeout 설정이 없습니다',
      description: '실행이 멈출 때 runner가 오래 점유될 수 있습니다.',
      suggestion: 'workflow 또는 job에 timeout-minutes를 추가하세요.',
    });
  }

  if (/setup-node/i.test(content) && !/(actions\/cache|cache:\s*['"]?(npm|pnpm|yarn))/i.test(content)) {
    issues.push({
      id: 'heuristic-cache',
      severity: 'warning',
      category: 'performance',
      file: fileName,
      title: '의존성 캐시가 보이지 않습니다',
      description: 'Node 계열 워크플로우에서 캐시가 없으면 실행 시간이 반복적으로 길어질 수 있습니다.',
      suggestion: 'setup-node cache 또는 actions/cache를 적용하세요.',
    });
  }

  if (failedJobs.length > 0) {
    issues.push({
      id: 'heuristic-failed-run',
      severity: 'warning',
      category: 'execution',
      file: fileName,
      job: failedJobs[0]?.name,
      title: '최근 실행에서 실패한 job이 있습니다',
      description: failedJobs.map((job) => job.name).join(', ') + ' job이 최근 실행에서 실패했습니다.',
      suggestion: '실패한 job의 step 상태를 먼저 확인하고, flaky step이 반복되는지 점검하세요.',
    });
  }

  return {
    source: 'heuristic',
    summary:
      issues.length > 0
        ? `${fileName} 기준으로 우선 확인할 이슈 ${issues.length}건을 정리했습니다.`
        : `${fileName} 기준으로 큰 구조 이슈는 두드러지지 않았습니다.`,
    issues: issues.slice(0, 5),
  };
}

function normalizeSeverity(value: unknown): 'critical' | 'warning' | 'info' {
  if (value === 'critical' || value === 'warning' || value === 'info') {
    return value;
  }

  return 'info';
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}
