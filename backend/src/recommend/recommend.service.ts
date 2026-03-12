export type RecommendRequest = {
  repo?: {
    owner?: string;
    name?: string;
  };
  workflow?: {
    fileName?: string;
    workflowName?: string;
    branch?: string;
    content?: string;
  };
  repoInsight?: {
    summary?: string;
    frameworks?: string[];
    deploymentSignals?: string[];
  };
  changeRequest?: {
    template?: string;
    details?: string;
  };
};

export type RecommendResponse = {
  source: 'gemini' | 'heuristic';
  summary: string;
  suggestions: Array<{
    id: string;
    title: string;
    target: string;
    reason: string;
    pseudoDiff: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
};

export class RecommendService {
  async recommend(payload: RecommendRequest): Promise<RecommendResponse> {
    const heuristic = buildHeuristicRecommendation(payload);
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
                    text: buildRecommendPrompt(payload),
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
        suggestions: normalizeSuggestions(parsed.suggestions),
      };
    } catch {
      return heuristic;
    }
  }
}

function buildRecommendPrompt(payload: RecommendRequest) {
  return [
    'You are recommending where a requested CI/CD change should be placed in an existing GitHub Actions workflow.',
    'Return JSON only with this shape:',
    '{"summary":"string","suggestions":[{"title":"string","target":"string","reason":"string","pseudoDiff":"string","confidence":"high|medium|low"}]}',
    'At most 3 suggestions. Be concrete about file, trigger, job, step, permission or cache strategy.',
    '',
    `Repository: ${payload.repo?.owner ?? 'unknown'}/${payload.repo?.name ?? 'unknown'}`,
    `Workflow file: ${payload.workflow?.fileName ?? 'workflow.yml'}`,
    `Workflow name: ${payload.workflow?.workflowName ?? payload.workflow?.fileName ?? 'workflow.yml'}`,
    `Branch: ${payload.workflow?.branch ?? 'unknown'}`,
    `Repo insight: ${payload.repoInsight?.summary ?? 'none'}`,
    `Frameworks: ${(payload.repoInsight?.frameworks ?? []).join(', ') || 'none'}`,
    `Deployment signals: ${(payload.repoInsight?.deploymentSignals ?? []).join(', ') || 'none'}`,
    `Template: ${payload.changeRequest?.template ?? 'freeform'}`,
    `Request: ${payload.changeRequest?.details ?? ''}`,
    '',
    'Workflow YAML:',
    payload.workflow?.content ?? '',
  ].join('\n');
}

function parseGeminiJson(rawText: string) {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? rawText;

  try {
    return JSON.parse(candidate) as {
      summary?: string;
      suggestions?: unknown[];
    };
  } catch {
    return null;
  }
}

function normalizeSuggestions(rawSuggestions: unknown[] | undefined) {
  return (rawSuggestions ?? [])
    .map((suggestion, index) => {
      if (!suggestion || typeof suggestion !== 'object') {
        return null;
      }

      const record = suggestion as Record<string, unknown>;

      return {
        id: `suggestion-${index + 1}`,
        title: asString(record.title) || '변경 위치 추천',
        target: asString(record.target) || '.github/workflows/*.yml',
        reason: asString(record.reason) || '',
        pseudoDiff: asString(record.pseudoDiff) || '',
        confidence: normalizeConfidence(record.confidence),
      };
    })
    .filter(
      (
        suggestion,
      ): suggestion is RecommendResponse['suggestions'][number] => suggestion !== null,
    );
}

function buildHeuristicRecommendation(payload: RecommendRequest): RecommendResponse {
  const template = (payload.changeRequest?.template ?? '').toLowerCase();
  const details = (payload.changeRequest?.details ?? '').toLowerCase();
  const fileName = payload.workflow?.fileName ?? 'workflow.yml';

  if (template === 'slack_alert' || /slack|discord|notify|notification/.test(details)) {
    return {
      source: 'heuristic',
      summary: '알림 요구사항은 실패 또는 배포 완료 시점에 후행 step으로 넣는 것이 가장 안전합니다.',
      suggestions: [
        {
          id: 'slack-1',
          title: '배포 또는 실패 job 끝단에 알림 step 추가',
          target: `${fileName} > deploy job > final notification step`,
          reason: '가장 의미 있는 이벤트는 배포 완료/실패 결과가 확정된 뒤입니다. 기존 흐름을 건드리지 않고 후행 step으로 넣는 편이 안정적입니다.',
          pseudoDiff: `jobs:\n  deploy:\n    steps:\n      - name: Notify Slack\n        if: always()\n        run: ./scripts/notify-slack.sh`,
          confidence: 'high',
        },
      ],
    };
  }

  if (template === 'approval_gate' || /approval|approve|manual gate|승인/.test(details)) {
    return {
      source: 'heuristic',
      summary: '승인 요구는 배포 trigger 앞단이 아니라 배포 job 또는 production environment 보호 정책에 거는 것이 적절합니다.',
      suggestions: [
        {
          id: 'approval-1',
          title: 'production environment 보호 규칙 사용',
          target: `${fileName} > deploy job > environment`,
          reason: 'GitHub Actions 기본 보호 기능을 쓰면 manual approval을 workflow 안에 억지로 구현할 필요가 없습니다.',
          pseudoDiff: `jobs:\n  deploy:\n    environment: production\n    runs-on: ubuntu-latest`,
          confidence: 'high',
        },
      ],
    };
  }

  if (template === 'nightly_scan' || /nightly|schedule|security scan|scan/.test(details)) {
    return {
      source: 'heuristic',
      summary: '야간 스캔은 기존 push 흐름과 분리된 schedule trigger workflow로 두는 편이 운영상 명확합니다.',
      suggestions: [
        {
          id: 'scan-1',
          title: '별도 schedule workflow 추가',
          target: `.github/workflows/nightly-scan.yml > on.schedule`,
          reason: 'PR/push 경로를 느리게 만들지 않고, 결과 해석도 분리할 수 있습니다.',
          pseudoDiff: `name: Nightly Scan\non:\n  schedule:\n    - cron: '0 2 * * *'\njobs:\n  security-scan:\n    runs-on: ubuntu-latest`,
          confidence: 'high',
        },
      ],
    };
  }

  if (template === 'cache_opt' || /cache|pnpm|npm|yarn/.test(details)) {
    return {
      source: 'heuristic',
      summary: '캐시 요구는 install/build job의 setup 단계에 붙이는 것이 가장 자연스럽습니다.',
      suggestions: [
        {
          id: 'cache-1',
          title: 'setup-node 또는 package manager 캐시 추가',
          target: `${fileName} > build/test job > dependency setup step`,
          reason: '의존성 설치 직전에 캐시를 복구해야 효과가 크고, 이후 step에는 영향이 적습니다.',
          pseudoDiff: `- uses: actions/setup-node@v4\n  with:\n    node-version: 20\n    cache: pnpm`,
          confidence: 'medium',
        },
      ],
    };
  }

  return {
    source: 'heuristic',
    summary: '변경 요구를 가장 덜 침습적으로 반영하려면 기존 workflow의 trigger와 핵심 job 경계를 유지하면서 후행 step 또는 별도 workflow로 분리하는 편이 안전합니다.',
    suggestions: [
      {
        id: 'generic-1',
        title: '기존 workflow 끝단에 후행 step 추가 검토',
        target: `${fileName} > existing job tail step`,
        reason: '현재 구조를 크게 바꾸지 않으면서 요구사항을 반영하기 쉬운 위치입니다.',
        pseudoDiff: `steps:\n  - name: New requested action\n    run: echo "implement request"`,
        confidence: 'medium',
      },
      {
        id: 'generic-2',
        title: 'trigger가 다르면 별도 workflow 분리 검토',
        target: `.github/workflows/new-${template || 'change'}.yml`,
        reason: '실행 조건이 다르면 한 workflow에 억지로 넣는 것보다 분리하는 편이 가독성과 유지보수성이 좋습니다.',
        pseudoDiff: `name: Requested Change\non:\n  workflow_dispatch:\njobs:\n  requested-change:\n    runs-on: ubuntu-latest`,
        confidence: 'medium',
      },
    ],
  };
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  return 'medium';
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}
