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
  const weakEdges: GraphEdge[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
      const left = nodes[index];
      const right = nodes[nextIndex];

      if (!left || !right) {
        continue;
      }

      const sharesTrigger = left.triggers.some((trigger) => right.triggers.includes(trigger));
      const sharesBranchRule = left.branchRules.some((rule) => right.branchRules.includes(rule));
      const sharesBranchTarget = hasSharedBranchTarget(left.branchRules, right.branchRules);
      const relatedIntent = hasRelatedWorkflowIntent(left, right);
      const sequentialPhase = hasSequentialPhaseFlow(left, right);

      if (
        !(sharesTrigger && sharesBranchRule) &&
        !(sharesBranchTarget && relatedIntent && sequentialPhase)
      ) {
        continue;
      }

      const [from, to] = getDirectionalPair(left, right);
      const directionalKey = toEdgeKey(from, to);

      if (seenEdgeKeys.has(directionalKey)) {
        continue;
      }

      seenEdgeKeys.add(directionalKey);
      weakEdges.push({
        from,
        to,
        kind: 'weak',
      });
    }
  }

  return weakEdges;
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

function hasSharedBranchTarget(leftRules: string[], rightRules: string[]) {
  const leftBranches = new Set(leftRules.map(extractBranchTarget).filter(Boolean));
  const rightBranches = new Set(rightRules.map(extractBranchTarget).filter(Boolean));

  return [...leftBranches].some((branch) => rightBranches.has(branch));
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

function hasRelatedWorkflowIntent(left: WorkflowMapNode, right: WorkflowMapNode) {
  const leftTokens = extractIntentTokens(`${left.workflowName} ${left.fileName}`);
  const rightTokens = extractIntentTokens(`${right.workflowName} ${right.fileName}`);

  return [...leftTokens].some((token) => rightTokens.has(token));
}

function extractIntentTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3)
      .filter((token) => !GENERIC_WORKFLOW_TOKENS.has(token)),
  );
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
