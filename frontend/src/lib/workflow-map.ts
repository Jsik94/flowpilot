import type { GraphEdge, WorkflowMap, WorkflowMapNode, WorkflowPreview } from '../types';

type WorkflowMeta = {
  workflowName: string;
  triggers: string[];
  branchRules: string[];
  workflowRunTargets: string[];
};

export function buildWorkflowMap(previews: WorkflowPreview[]) {
  const metadata = previews.map((preview) => ({
    preview,
    meta: parseWorkflowMeta(preview.content, preview.workflowName),
  }));
  const nameToId = new Map(
    metadata.map(({ preview, meta }) => [meta.workflowName, preview.path]),
  );

  const rawNodes = metadata.map<WorkflowMapNode>(({ preview, meta }) => ({
    id: preview.path,
    fileName: preview.fileName,
    workflowName: meta.workflowName,
    triggers: meta.triggers,
    branchRules: meta.branchRules,
    intentTags: extractWorkflowIntentTags(preview),
    primaryTrigger: getPrimaryTrigger(meta.triggers),
    ...getWorkflowPhase(meta.triggers),
    level: 0,
    dependsOnWorkflowIds: meta.workflowRunTargets
      .map((targetName) => nameToId.get(targetName))
      .filter((targetId): targetId is string => Boolean(targetId)),
  }));

  const nodes = assignLevels(rawNodes);
  const strongEdges = nodes.flatMap((node) =>
    node.dependsOnWorkflowIds.map((dependencyId) => ({
      from: dependencyId,
      to: node.id,
      kind: 'strong' as const,
      reason: 'workflow_run 또는 workflow_call로 명시 연결',
      confidence: 1,
    })),
  );
  const weakEdges = buildWeakEdges(nodes, strongEdges);

  return {
    nodes,
    edges: [...strongEdges, ...weakEdges],
    strongEdges,
    weakEdges,
  } satisfies WorkflowMap;
}

export function parseWorkflowMeta(content: string, fallbackName: string): WorkflowMeta {
  const lines = content.replace(/\t/g, '  ').split(/\r?\n/);
  const workflowName = parseWorkflowName(lines) ?? fallbackName;
  const { triggers, branchRules, workflowRunTargets } = parseTriggers(lines);

  return {
    workflowName,
    triggers,
    branchRules,
    workflowRunTargets,
  };
}

function parseWorkflowName(lines: string[]) {
  for (const line of lines) {
    const trimmed = stripComment(line).trim();
    if (!trimmed) {
      continue;
    }

    const match = trimmed.match(/^name:\s*(.+)$/);
    if (match) {
      return stripQuotes(match[1].trim());
    }
  }

  return null;
}

function parseTriggers(lines: string[]) {
  const onIndex = lines.findIndex((line) => stripComment(line).trim().startsWith('on:'));

  if (onIndex === -1) {
    return { triggers: [], branchRules: [], workflowRunTargets: [] };
  }

  const onLine = stripComment(lines[onIndex]).trim();
  const inlineValue = onLine.replace(/^on:\s*/, '').trim();

  if (inlineValue) {
    return {
      triggers: parseInlineEvents(inlineValue),
      branchRules: [],
      workflowRunTargets: [],
    };
  }

  const onIndent = getIndent(lines[onIndex]);
  const triggers: string[] = [];
  const branchRules: string[] = [];
  const workflowRunTargets: string[] = [];
  let currentEvent = '';

  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = stripComment(rawLine).trim();

    if (!trimmed) {
      continue;
    }

    const indent = getIndent(rawLine);
    if (indent <= onIndent) {
      break;
    }

    if (indent === onIndent + 2) {
      const eventMatch = trimmed.match(/^([A-Za-z0-9_-]+):/);
      if (!eventMatch) {
        continue;
      }

      currentEvent = eventMatch[1];
      triggers.push(currentEvent);
      continue;
    }

    if (
      indent === onIndent + 4 &&
      currentEvent &&
      trimmed.startsWith('branches:')
    ) {
      const inlineBranches = trimmed.replace(/^branches:\s*/, '').trim();
      if (inlineBranches) {
        branchRules.push(
          ...parseInlineStringList(inlineBranches).map((branch) => `${currentEvent}:${branch}`),
        );
        continue;
      }

      const listEnd = findBlockEnd(lines, index + 1, onIndent + 4);
      branchRules.push(
        ...parseList(lines.slice(index + 1, listEnd), onIndent + 6).map(
          (branch) => `${currentEvent}:${branch}`,
        ),
      );
      index = listEnd - 1;
      continue;
    }

    if (currentEvent !== 'workflow_run') {
      continue;
    }

    if (indent === onIndent + 4 && trimmed.startsWith('workflows:')) {
      const inlineWorkflows = trimmed.replace(/^workflows:\s*/, '').trim();
      if (inlineWorkflows) {
        workflowRunTargets.push(...parseInlineStringList(inlineWorkflows));
        continue;
      }

      const listEnd = findBlockEnd(lines, index + 1, onIndent + 4);
      workflowRunTargets.push(
        ...parseList(lines.slice(index + 1, listEnd), onIndent + 6),
      );
      index = listEnd - 1;
    }
  }

  return { triggers, branchRules, workflowRunTargets };
}

function parseInlineEvents(value: string) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }

  return [stripQuotes(value)];
}

function parseInlineStringList(value: string) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }

  return [stripQuotes(value)];
}

function parseList(lines: string[], listIndent: number) {
  return lines
    .map((line) => {
      if (getIndent(line) < listIndent) {
        return null;
      }

      const trimmed = stripComment(line).trim();
      if (!trimmed.startsWith('- ')) {
        return null;
      }

      return stripQuotes(trimmed.slice(2).trim());
    })
    .filter((value): value is string => Boolean(value));
}

function assignLevels(nodes: WorkflowMapNode[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const resolveLevel = (node: WorkflowMapNode, stack = new Set<string>()): number => {
    if (node.level > 0 || node.dependsOnWorkflowIds.length === 0) {
      return node.level;
    }

    if (stack.has(node.id)) {
      return 0;
    }

    stack.add(node.id);
    const resolved = node.dependsOnWorkflowIds
      .map((dependencyId) => nodeMap.get(dependencyId))
      .filter((dependency): dependency is WorkflowMapNode => Boolean(dependency))
      .map((dependency) => resolveLevel(dependency, stack))
      .reduce((max, level) => Math.max(max, level), 0);
    stack.delete(node.id);

    node.level = resolved + 1;
    return node.level;
  };

  return nodes.map((node) => ({
    ...node,
    level: resolveLevel(node),
  }));
}

function buildWeakEdges(nodes: WorkflowMapNode[], strongEdges: GraphEdge[]) {
  const strongEdgeKeys = new Set(strongEdges.map((edge) => toEdgeKey(edge.from, edge.to)));
  const seenEdgeKeys = new Set(strongEdgeKeys);
  const candidates: GraphEdge[] = [];
  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();

  for (let index = 0; index < nodes.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
      const left = nodes[index];
      const right = nodes[nextIndex];

      if (!left || !right) {
        continue;
      }

      const analysis = analyzeInferredRelationship(left, right);

      if (!analysis) {
        continue;
      }

      const [from, to] = getDirectionalPair(left, right);
      const directionalKey = toEdgeKey(from, to);

      if (seenEdgeKeys.has(directionalKey)) {
        continue;
      }

      seenEdgeKeys.add(directionalKey);
      candidates.push({
        from,
        to,
        kind: 'weak',
        reason: analysis.reason,
        confidence: analysis.confidence,
      });
    }
  }

  candidates.sort((left, right) => {
    const confidenceGap = (right.confidence ?? 0) - (left.confidence ?? 0);
    if (confidenceGap !== 0) {
      return confidenceGap;
    }

    return toEdgeKey(left.from, left.to).localeCompare(toEdgeKey(right.from, right.to));
  });

  const weakEdges: GraphEdge[] = [];

  for (const candidate of candidates) {
    const outgoing = outgoingCounts.get(candidate.from) ?? 0;
    const incoming = incomingCounts.get(candidate.to) ?? 0;

    if (outgoing >= 2 || incoming >= 2) {
      continue;
    }

    weakEdges.push(candidate);
    outgoingCounts.set(candidate.from, outgoing + 1);
    incomingCounts.set(candidate.to, incoming + 1);
  }

  return weakEdges;
}

function analyzeInferredRelationship(left: WorkflowMapNode, right: WorkflowMapNode) {
  const reasons: string[] = [];
  let score = 0;

  const sharedTriggers = left.triggers.filter((trigger) => right.triggers.includes(trigger));
  const sharedBranchRules = left.branchRules.filter((rule) => right.branchRules.includes(rule));
  const sharedBranchTargets = findSharedBranchTargets(left.branchRules, right.branchRules);
  const sharedIntentTags = left.intentTags.filter((tag) => right.intentTags.includes(tag));
  const sequentialPhase = hasSequentialPhaseFlow(left, right);
  const roleTransition = hasSequentialIntentFlow(left.intentTags, right.intentTags);

  if (sharedTriggers.length > 0) {
    score += 2;
    reasons.push(`공통 trigger: ${sharedTriggers.slice(0, 2).join(', ')}`);
  }

  if (sharedBranchRules.length > 0) {
    score += 3;
    reasons.push(`같은 branch rule: ${sharedBranchRules.slice(0, 1).join(', ')}`);
  }

  if (sharedBranchTargets.length > 0) {
    score += 2;
    reasons.push(`같은 branch target: ${sharedBranchTargets.slice(0, 2).join(', ')}`);
  }

  if (sequentialPhase) {
    score += 2;
    reasons.push(`phase 흐름: ${left.phaseLabel} -> ${right.phaseLabel}`);
  }

  if (sharedIntentTags.length > 0) {
    score += 3;
    reasons.push(`공통 목적: ${sharedIntentTags.slice(0, 2).join(', ')}`);
  }

  if (roleTransition) {
    score += 4;
    reasons.push('검증/빌드 이후 배포·운영 흐름으로 추론');
  }

  const shouldConnect =
    score >= 6 &&
    (
      (sharedTriggers.length > 0 && sharedBranchRules.length > 0) ||
      (sharedBranchTargets.length > 0 && sequentialPhase) ||
      roleTransition ||
      (sharedIntentTags.length > 0 && sequentialPhase)
    );

  if (!shouldConnect) {
    return null;
  }

  const confidence = Math.min(0.95, Number((score / 12).toFixed(2)));

  return {
    reason: reasons.join(' · '),
    confidence,
  };
}

function getDirectionalPair(left: WorkflowMapNode, right: WorkflowMapNode) {
  if (left.phaseOrder !== right.phaseOrder) {
    return left.phaseOrder < right.phaseOrder ? [left.id, right.id] : [right.id, left.id];
  }

  if (left.level !== right.level) {
    return left.level <= right.level ? [left.id, right.id] : [right.id, left.id];
  }

  return left.workflowName.localeCompare(right.workflowName) <= 0
    ? [left.id, right.id]
    : [right.id, left.id];
}

function findSharedBranchTargets(leftRules: string[], rightRules: string[]) {
  const leftBranches = new Set(leftRules.map(extractBranchTarget).filter(Boolean));
  const rightBranches = new Set(rightRules.map(extractBranchTarget).filter(Boolean));

  return [...leftBranches].filter((branch) => rightBranches.has(branch));
}

function extractBranchTarget(rule: string) {
  const [, branch] = rule.split(':');
  return branch?.trim() ?? '';
}

function hasSequentialPhaseFlow(left: WorkflowMapNode, right: WorkflowMapNode) {
  const ordered = [left, right].sort((a, b) => a.phaseOrder - b.phaseOrder);
  const from = ordered[0]?.phaseLabel;
  const to = ordered[1]?.phaseLabel;

  if (!from || !to || from === to) {
    return false;
  }

  return (
    (from === 'PR' && ['Push', 'Pipeline', 'Release'].includes(to)) ||
    (from === 'Push' && ['Pipeline', 'Release'].includes(to)) ||
    (from === 'Pipeline' && to === 'Release')
  );
}

function extractWorkflowIntentTags(preview: WorkflowPreview) {
  const source = `${preview.workflowName} ${preview.fileName} ${preview.content}`.toLowerCase();
  const tags = new Set<string>();

  for (const [tag, keywords] of Object.entries(WORKFLOW_INTENT_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      tags.add(tag);
    }
  }

  const genericTokens = source
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !GENERIC_WORKFLOW_TOKENS.has(token))
    .slice(0, 24);

  for (const token of genericTokens) {
    tags.add(token);
  }

  return [...tags];
}

function hasSequentialIntentFlow(fromTags: string[], toTags: string[]) {
  const from = new Set(fromTags);
  const to = new Set(toTags);

  return INTENT_FLOW_PAIRS.some(([fromGroup, toGroup]) => {
    const fromMatches = fromGroup.some((tag) => from.has(tag));
    const toMatches = toGroup.some((tag) => to.has(tag));
    return fromMatches && toMatches;
  });
}

const GENERIC_WORKFLOW_TOKENS = new Set([
  'github',
  'workflow',
  'workflows',
  'actions',
  'action',
  'pipeline',
  'check',
  'checks',
  'job',
  'jobs',
  'main',
  'yml',
  'yaml',
  'ci',
]);

const WORKFLOW_INTENT_KEYWORDS: Record<string, string[]> = {
  review: ['pull_request', 'review', 'pr'],
  build: ['build', 'compile', 'package'],
  test: ['test', 'unit', 'integration', 'e2e', 'vitest', 'jest'],
  quality: ['lint', 'quality', 'validate', 'validation', 'schema', 'check', 'checks'],
  release: ['release', 'publish', 'tag'],
  deploy: ['deploy', 'delivery', 'rollout', 'promotion'],
  docs: ['docs', 'documentation', 'index'],
  sync: ['sync', 'backmerge', 'label', 'labels'],
  infra: ['terraform', 'helm', 'kubernetes', 'docker'],
  security: ['security', 'codeql', 'scan', 'sast', 'secret'],
  notify: ['notify', 'notification', 'slack', 'discord'],
};

const INTENT_FLOW_PAIRS: Array<[string[], string[]]> = [
  [['review', 'quality', 'test', 'build', 'security'], ['build', 'release', 'deploy']],
  [['build', 'quality', 'infra'], ['release', 'deploy', 'notify']],
  [['release', 'deploy'], ['sync', 'notify', 'docs']],
];

function toEdgeKey(from: string, to: string) {
  return `${from}::${to}`;
}

function getPrimaryTrigger(triggers: string[]) {
  return triggers[0] ?? 'unknown';
}

function getWorkflowPhase(triggers: string[]) {
  const primaryTrigger = getPrimaryTrigger(triggers);

  switch (primaryTrigger) {
    case 'pull_request':
    case 'pull_request_target':
    case 'merge_group':
      return { phaseLabel: 'PR', phaseOrder: 0 };
    case 'push':
      return { phaseLabel: 'Push', phaseOrder: 1 };
    case 'workflow_run':
    case 'workflow_call':
      return { phaseLabel: 'Pipeline', phaseOrder: 2 };
    case 'release':
      return { phaseLabel: 'Release', phaseOrder: 3 };
    case 'workflow_dispatch':
      return { phaseLabel: 'Manual', phaseOrder: 4 };
    case 'schedule':
      return { phaseLabel: 'Schedule', phaseOrder: 5 };
    default:
      return { phaseLabel: 'Other', phaseOrder: 6 };
  }
}

function findBlockEnd(lines: string[], startIndex: number, parentIndent: number) {
  let index = startIndex;

  for (; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = stripComment(rawLine).trim();
    if (!trimmed) {
      continue;
    }

    if (getIndent(rawLine) <= parentIndent) {
      break;
    }
  }

  return index;
}

function stripComment(line: string) {
  const commentIndex = line.indexOf('#');
  return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
}

function stripQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, '');
}

function getIndent(line: string) {
  return line.match(/^ */)?.[0].length ?? 0;
}
