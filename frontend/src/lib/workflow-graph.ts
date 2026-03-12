import type { GraphNode, WorkflowGraph, WorkflowJob, WorkflowStep } from '../types';

export function buildWorkflowGraph(yamlContent: string, fallbackName = 'Workflow') {
  const lines = yamlContent.replace(/\t/g, '  ').split(/\r?\n/);
  const workflowName = parseWorkflowName(lines) ?? fallbackName;
  const jobs = parseJobs(lines);
  const jobsWithLevels = assignLevels(jobs);

  return {
    workflowName,
    jobs: jobsWithLevels,
    nodes: jobsWithLevels.map<GraphNode>((job) => ({
      id: job.id,
      title: job.title,
      level: job.level,
      state: 'neutral',
      meta: `${job.runsOn || 'unknown runner'} · ${job.steps.length} steps`,
    })),
    edges: jobsWithLevels.flatMap((job) =>
      job.needs.map((dependency) => ({
        from: dependency,
        to: job.id,
      })),
    ),
  } satisfies WorkflowGraph;
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

function parseJobs(lines: string[]) {
  const jobsIndex = lines.findIndex((line) => stripComment(line).trim() === 'jobs:');

  if (jobsIndex === -1) {
    return [];
  }

  const jobsIndent = getIndent(lines[jobsIndex]);
  const jobs: WorkflowJob[] = [];

  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = stripComment(rawLine).trim();

    if (!trimmed) {
      continue;
    }

    const indent = getIndent(rawLine);
    if (indent <= jobsIndent) {
      break;
    }

    if (indent !== jobsIndent + 2) {
      continue;
    }

    const jobKeyMatch = trimmed.match(/^([A-Za-z0-9_.-]+):\s*$/);
    if (!jobKeyMatch) {
      continue;
    }

    const jobId = jobKeyMatch[1];
    const blockEnd = findBlockEnd(lines, index + 1, jobsIndent + 2);
    jobs.push(parseJobBlock(jobId, lines.slice(index + 1, blockEnd), jobsIndent + 2));
    index = blockEnd - 1;
  }

  return jobs;
}

function parseJobBlock(jobId: string, lines: string[], jobIndent: number): WorkflowJob {
  let title = jobId;
  let runsOn = '';
  let needs: string[] = [];
  let steps: WorkflowStep[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = stripComment(rawLine).trim();

    if (!trimmed) {
      continue;
    }

    const indent = getIndent(rawLine);
    if (indent !== jobIndent + 2) {
      continue;
    }

    if (trimmed.startsWith('name:')) {
      title = stripQuotes(trimmed.replace(/^name:\s*/, '').trim()) || jobId;
      continue;
    }

    if (trimmed.startsWith('runs-on:')) {
      runsOn = normalizeScalarValue(trimmed.replace(/^runs-on:\s*/, '').trim());
      continue;
    }

    if (trimmed.startsWith('needs:')) {
      const inline = trimmed.replace(/^needs:\s*/, '').trim();
      if (inline) {
        needs = parseNeedsInline(inline);
      } else {
        const blockEnd = findBlockEnd(lines, index + 1, jobIndent + 2);
        needs = parseNeedsList(lines.slice(index + 1, blockEnd), jobIndent + 4);
        index = blockEnd - 1;
      }
      continue;
    }

    if (trimmed === 'steps:') {
      const blockEnd = findBlockEnd(lines, index + 1, jobIndent + 2);
      steps = parseSteps(lines.slice(index + 1, blockEnd), jobIndent + 4, jobId);
      index = blockEnd - 1;
    }
  }

  return {
    id: jobId,
    title,
    runsOn,
    needs,
    steps,
    level: 0,
  };
}

function parseNeedsInline(value: string) {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [normalizeScalarValue(value)];
}

function parseNeedsList(lines: string[], listIndent: number) {
  return lines
    .map((line) => {
      if (getIndent(line) < listIndent) {
        return null;
      }

      const trimmed = stripComment(line).trim();
      if (!trimmed.startsWith('- ')) {
        return null;
      }

      return normalizeScalarValue(trimmed.slice(2).trim());
    })
    .filter((value): value is string => Boolean(value));
}

function parseSteps(lines: string[], stepsIndent: number, jobId: string) {
  const steps: WorkflowStep[] = [];
  let currentStep: WorkflowStep | null = null;
  let stepCounter = 0;

  const flush = () => {
    if (currentStep) {
      steps.push(currentStep);
    }
  };

  for (const rawLine of lines) {
    const indent = getIndent(rawLine);
    const trimmed = stripComment(rawLine).trim();

    if (!trimmed) {
      continue;
    }

    if (indent === stepsIndent && trimmed.startsWith('- ')) {
      flush();
      stepCounter += 1;

      const initial = trimmed.slice(2).trim();
      currentStep = {
        id: `${jobId}-step-${stepCounter}`,
        title: `Step ${stepCounter}`,
        kind: 'unknown',
        detail: '',
      };

      applyStepProperty(currentStep, initial);
      continue;
    }

    if (!currentStep) {
      continue;
    }

    if (indent >= stepsIndent + 2) {
      applyStepProperty(currentStep, trimmed);
    }
  }

  flush();
  return steps;
}

function applyStepProperty(step: WorkflowStep, line: string) {
  if (!line) {
    return;
  }

  if (line.startsWith('name:')) {
    step.title = stripQuotes(line.replace(/^name:\s*/, '').trim()) || step.title;
    return;
  }

  if (line.startsWith('uses:')) {
    step.kind = 'uses';
    step.detail = normalizeScalarValue(line.replace(/^uses:\s*/, '').trim());
    if (step.title.startsWith('Step ')) {
      step.title = step.detail;
    }
    return;
  }

  if (line.startsWith('run:')) {
    step.kind = 'run';
    step.detail = normalizeScalarValue(line.replace(/^run:\s*/, '').trim());
    if (step.title.startsWith('Step ')) {
      step.title = step.detail || step.title;
    }
  }
}

function assignLevels(jobs: WorkflowJob[]) {
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  const resolveLevel = (job: WorkflowJob, stack = new Set<string>()): number => {
    if (job.level > 0 || job.needs.length === 0) {
      return job.level;
    }

    if (stack.has(job.id)) {
      return 0;
    }

    stack.add(job.id);
    const resolved = job.needs
      .map((need) => jobMap.get(need))
      .filter((dependency): dependency is WorkflowJob => Boolean(dependency))
      .map((dependency) => resolveLevel(dependency, stack))
      .reduce((max, level) => Math.max(max, level), 0);
    stack.delete(job.id);

    job.level = resolved + 1;
    return job.level;
  };

  return jobs.map((job) => ({
    ...job,
    level: resolveLevel(job),
  }));
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

function getIndent(line: string) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function stripQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, '');
}

function normalizeScalarValue(value: string) {
  return stripQuotes(value.trim());
}
