import type { RunJobSummary, WorkflowGraph, WorkflowJob, WorkflowStep } from '../types';

export function applyRunJobsToWorkflowGraph(
  graph: WorkflowGraph,
  runJobs: RunJobSummary[],
) {
  if (runJobs.length === 0) {
    return graph;
  }

  const jobLookup = new Map(runJobs.map((job) => [normalizeExecutionName(job.name), job]));

  const jobs = graph.jobs.map((job) => {
    const matchedJob = findMatchingRunJob(job, jobLookup, runJobs);

    return {
      ...job,
      steps: job.steps.map((step) => {
        const matchedStep = matchedJob?.steps.find((runStep) =>
          namesRoughlyMatch(step.title, runStep.name),
        );

        return {
          ...step,
          executionState: matchedStep?.status,
        };
      }),
    };
  });

  return {
    ...graph,
    jobs,
    nodes: graph.nodes.map((node) => {
      const matchedJob = jobs.find((job) => job.id === node.id);
      const runJob = matchedJob ? findMatchingRunJob(matchedJob, jobLookup, runJobs) : null;

      return {
        ...node,
        state: runJob?.status ?? node.state,
        meta: runJob
          ? `${node.meta} · last run ${runJob.status}`
          : node.meta,
      };
    }),
  } satisfies WorkflowGraph;
}

function findMatchingRunJob(
  job: WorkflowJob,
  jobLookup: Map<string, RunJobSummary>,
  runJobs: RunJobSummary[],
) {
  const titleKey = normalizeExecutionName(job.title);
  const idKey = normalizeExecutionName(job.id);

  return (
    jobLookup.get(titleKey) ??
    jobLookup.get(idKey) ??
    runJobs.find((runJob) => namesRoughlyMatch(job.title, runJob.name)) ??
    runJobs.find((runJob) => namesRoughlyMatch(job.id, runJob.name)) ??
    null
  );
}

function namesRoughlyMatch(left: string, right: string) {
  const normalizedLeft = normalizeExecutionName(left);
  const normalizedRight = normalizeExecutionName(right);

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  );
}

function normalizeExecutionName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function getSelectedRunStepState(
  selectedJob: WorkflowJob | null,
  step: WorkflowStep,
) {
  if (!selectedJob) {
    return 'neutral' as const;
  }

  return step.executionState ?? 'neutral';
}
