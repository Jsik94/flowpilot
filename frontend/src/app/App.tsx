import { useEffect, useMemo, useState } from 'react';
import { RepositoryForm } from '../features/auth/components/repository-form';
import { GraphCanvas } from '../features/graph/components/graph-canvas';
import { JobDetailPanel } from '../features/jobs/components/job-detail-panel';
import { ReviewReportPanel } from '../features/review/components/review-report-panel';
import { RunHistoryPanel } from '../features/runs/components/run-history-panel';
import { WorkflowMapPanel } from '../features/workflows/components/workflow-map-panel';
import { analyzeWorkflow } from '../lib/analyze';
import { buildCiReviewReport, buildWorkflowNarrative } from '../lib/ci-review';
import {
  fetchRunJobs,
  fetchBranches,
  fetchOptionalRepositoryFileText,
  fetchRepository,
  fetchRepositoryEntries,
  fetchWorkflowPreview,
  fetchWorkflowRuns,
  fetchWorkflowSummaries,
  parseRepositoryUrl,
} from '../lib/github';
import { buildBranchComparison, buildRepoInsight, buildReviewMarkdown } from '../lib/repo-insights';
import { buildWorkflowGraph } from '../lib/workflow-graph';
import { buildWorkflowMap } from '../lib/workflow-map';
import type {
  AnalysisResult,
  BranchComparison,
  BranchSummary,
  RepoInsight,
  RepositoryFormState,
  RepositoryRef,
  RunJobSummary,
  RunSummary,
  WorkflowMap,
  WorkflowGraph,
  WorkflowPreview,
  WorkflowSummary,
} from '../types';

const SESSION_STORAGE_KEY = 'flowpilot.repository-form';
const THEME_STORAGE_KEY = 'flowpilot.theme';
const DEFAULT_FORM_STATE: RepositoryFormState = {
  repoUrl: 'https://github.com/actions/starter-workflows',
  username: '',
  token: '',
};
type ThemeMode = 'dark' | 'light';

export function App() {
  const [formState, setFormState] = useState<RepositoryFormState>(DEFAULT_FORM_STATE);
  const [repository, setRepository] = useState<RepositoryRef | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [workflowItems, setWorkflowItems] = useState<WorkflowSummary[]>([]);
  const [workflowMap, setWorkflowMap] = useState<WorkflowMap | null>(null);
  const [workflowPreviews, setWorkflowPreviews] = useState<Record<string, WorkflowPreview>>({});
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<WorkflowPreview | null>(null);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [workflowRuns, setWorkflowRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedRunJobs, setSelectedRunJobs] = useState<RunJobSummary[]>([]);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [repoInsight, setRepoInsight] = useState<RepoInsight | null>(null);
  const [branchComparison, setBranchComparison] = useState<BranchComparison | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sourceFocus, setSourceFocus] = useState<{
    path: string;
    line: number;
    lineEnd?: number;
    blockLabel?: string;
  } | null>(null);
  const [progressState, setProgressState] = useState<{
    label: string;
    current: number;
    total: number;
  } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const allPreviews = useMemo(() => Object.values(workflowPreviews), [workflowPreviews]);
  const reviewReport = useMemo(
    () =>
      repository
        ? buildCiReviewReport({
            selectedBranch,
            previews: allPreviews,
            workflowMap,
            repoInsight,
            branchComparison,
            runs: workflowRuns,
            analysisResult,
          })
        : null,
    [allPreviews, analysisResult, branchComparison, repoInsight, repository, selectedBranch, workflowMap, workflowRuns],
  );
  const workflowSummary = useMemo(
    () => (selectedPreview ? buildWorkflowNarrative(selectedPreview, workflowGraph, workflowRuns) : null),
    [selectedPreview, workflowGraph, workflowRuns],
  );
  const drawerSummary = useMemo(() => {
    if (analysisResult?.summary && workflowSummary) {
      return `${analysisResult.summary} ${workflowSummary}`;
    }

    return analysisResult?.summary ?? workflowSummary;
  }, [analysisResult?.summary, workflowSummary]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as RepositoryFormState;
      setFormState({
        repoUrl: parsed.repoUrl ?? DEFAULT_FORM_STATE.repoUrl,
        username: parsed.username ?? '',
        token: parsed.token ?? '',
      });
    } catch {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedWorkflowId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      closeDetailDrawer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedWorkflowId]);

  function closeDetailDrawer() {
    setSelectedWorkflowId('');
    setSelectedPreview(null);
    setWorkflowGraph(null);
    setSelectedJobId('');
    setWorkflowRuns([]);
    setSelectedRunId(null);
    setSelectedRunJobs([]);
    setAnalysisResult(null);
    setAnalysisLoading(false);
    setSourceFocus(null);
  }

  function persistFormState(nextState: RepositoryFormState) {
    setFormState(nextState);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextState));
  }

  async function loadRepositoryContext(
    repoRef: RepositoryRef,
    branch: string,
    token: string,
    currentWorkflows: WorkflowSummary[],
  ) {
    const [entries, packageJsonText, readmeText, defaultBranchWorkflows] = await Promise.all([
      fetchRepositoryEntries(repoRef, '', branch, token),
      fetchOptionalRepositoryFileText(repoRef, 'package.json', branch, token),
      fetchOptionalRepositoryFileText(repoRef, 'README.md', branch, token),
      branch === repoRef.defaultBranch
        ? Promise.resolve(currentWorkflows)
        : fetchWorkflowSummaries(repoRef, repoRef.defaultBranch, token),
    ]);

    setRepoInsight(buildRepoInsight(entries, packageJsonText, readmeText));
    setBranchComparison(
      buildBranchComparison(branch, repoRef.defaultBranch, currentWorkflows, defaultBranchWorkflows),
    );
  }

  async function loadRunJobs(runId: number): Promise<RunJobSummary[]> {
    if (!repository) {
      setSelectedRunJobs([]);
      return [];
    }

    const jobs = await fetchRunJobs(repository, runId, formState.token);
    setSelectedRunJobs(jobs);
    return jobs;
  }

  async function runWorkflowSummary(
    preview: WorkflowPreview,
    runs: RunSummary[],
    runJobs: RunJobSummary[],
  ) {
    if (!repository) {
      setAnalysisResult(null);
      return;
    }

    setAnalysisLoading(true);

    try {
      const result = await analyzeWorkflow({
        repository: {
          owner: repository.owner,
          repo: repository.repo,
        },
        branch: selectedBranch,
        preview,
        runs,
        runJobs,
      });
      setAnalysisResult(result);
    } catch {
      setAnalysisResult(null);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function loadWorkflowRunsForSelection(
    workflow: WorkflowSummary,
  ): Promise<{ runs: RunSummary[]; jobs: RunJobSummary[] }> {
    if (!repository || !selectedBranch) {
      setWorkflowRuns([]);
      setSelectedRunId(null);
      setSelectedRunJobs([]);
      return { runs: [], jobs: [] };
    }

    setRunLoading(true);
    setAnalysisResult(null);

    try {
      const runs = await fetchWorkflowRuns(repository, workflow.fileName, selectedBranch, formState.token);
      setWorkflowRuns(runs);

      const firstRun = runs[0] ?? null;
      setSelectedRunId(firstRun?.id ?? null);

      if (firstRun) {
        const jobs = await loadRunJobs(firstRun.id);
        return { runs, jobs };
      } else {
        setSelectedRunJobs([]);
        return { runs, jobs: [] };
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? mapLoadError(error.message)
          : '실행 이력을 불러오지 못했습니다.';

      setErrorMessage(message);
      setWorkflowRuns([]);
      setSelectedRunId(null);
      setSelectedRunJobs([]);
      return { runs: [], jobs: [] };
    } finally {
      setRunLoading(false);
    }
  }

  async function applySelectedWorkflow(
    workflowId: string,
    items: WorkflowSummary[],
    previews: Record<string, WorkflowPreview>,
  ) {
    const selected = items.find((item) => item.id === workflowId);
    const preview = previews[workflowId];

    if (!selected || !preview) {
      return;
    }

    setSelectedWorkflowId(workflowId);
    setSelectedPreview(preview);
    setSourceFocus(null);

    const graph = buildWorkflowGraph(preview.content, preview.workflowName);
    setWorkflowGraph(graph);
    setSelectedJobId(graph.jobs[0]?.id ?? '');
    const { runs, jobs } = await loadWorkflowRunsForSelection(selected);
    await runWorkflowSummary(preview, runs, jobs);
  }

  async function loadBranchWorkflows(
    repoRef: RepositoryRef,
    branch: string,
    token: string,
    preferredWorkflowId?: string,
  ) {
    setWorkflowLoading(true);
    setErrorMessage(null);
    setSelectedBranch(branch);
    setProgressState({
      label: '워크플로우 목록을 불러오는 중입니다.',
      current: 0,
      total: 1,
    });

    try {
      const summaries = await fetchWorkflowSummaries(repoRef, branch, token);
      setWorkflowItems(summaries);
      await loadRepositoryContext(repoRef, branch, token, summaries);

      if (summaries.length === 0) {
        closeDetailDrawer();
        setWorkflowMap(null);
        setWorkflowPreviews({});
        return;
      }

      const previewEntries: Array<[string, WorkflowPreview]> = [];

      for (const [index, workflow] of summaries.entries()) {
        setProgressState({
          label: `워크플로우 파일 ${index + 1}/${summaries.length} 분석 중`,
          current: index + 1,
          total: summaries.length,
        });
        const preview = await fetchWorkflowPreview(repoRef, workflow.path, branch, token);
        previewEntries.push([workflow.id, preview]);
      }

      const previewMap = Object.fromEntries(previewEntries);
      setWorkflowPreviews(previewMap);
      setWorkflowMap(buildWorkflowMap(Object.values(previewMap)));

      const nextWorkflowId =
        preferredWorkflowId && summaries.some((item) => item.id === preferredWorkflowId)
          ? preferredWorkflowId
          : '';

      if (nextWorkflowId) {
        await applySelectedWorkflow(nextWorkflowId, summaries, previewMap);
      } else {
        closeDetailDrawer();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? mapLoadError(error.message)
          : '브랜치 기준 워크플로우를 불러오지 못했습니다.';

      setErrorMessage(message);
      setWorkflowItems([]);
      setWorkflowMap(null);
      setWorkflowPreviews({});
      setRepoInsight(null);
      setBranchComparison(null);
      closeDetailDrawer();
    } finally {
      setWorkflowLoading(false);
      setProgressState(null);
    }
  }

  async function handleLoadRepository() {
    setRepositoryLoading(true);
    setErrorMessage(null);
    closeDetailDrawer();

    try {
      const parsed = parseRepositoryUrl(formState.repoUrl);
      const repoRef = await fetchRepository(parsed, formState.token);
      const repoBranches = await fetchBranches(repoRef, formState.token);
      const orderedBranches = orderBranches(repoBranches, repoRef.defaultBranch);
      const initialBranch = orderedBranches[0]?.name ?? repoRef.defaultBranch;

      setRepository(repoRef);
      setBranches(orderedBranches);
      setSelectedBranch(initialBranch);

      await loadBranchWorkflows(repoRef, initialBranch, formState.token);
    } catch (error) {
      const message =
        error instanceof Error
          ? mapLoadError(error.message)
          : '레포 정보를 불러오지 못했습니다.';

      setErrorMessage(message);
      setRepository(null);
      setBranches([]);
      setSelectedBranch('');
      setWorkflowItems([]);
      setWorkflowMap(null);
      setWorkflowPreviews({});
      setRepoInsight(null);
      setBranchComparison(null);
      closeDetailDrawer();
    } finally {
      setRepositoryLoading(false);
    }
  }

  function handleSelectWorkflow(workflowId: string) {
    if (workflowId === selectedWorkflowId) {
      return;
    }

    void applySelectedWorkflow(
      workflowId,
      workflowItems,
      workflowPreviews,
    );
  }

  function handleSelectWorkflowByFileName(fileName: string) {
    const workflow = workflowItems.find((item) => item.fileName === fileName);
    if (!workflow) {
      return;
    }

    if (workflow.id === selectedWorkflowId) {
      return;
    }

    void applySelectedWorkflow(workflow.id, workflowItems, workflowPreviews);
  }

  function handleSelectFinding(finding: {
    filePath?: string;
    workflowName?: string;
    line?: number;
    lineEnd?: number;
    blockLabel?: string;
  }) {
    const targetPreview = allPreviews.find(
      (preview) =>
        preview.path === finding.filePath ||
        (finding.workflowName ? preview.workflowName === finding.workflowName : false),
    );

    if (!targetPreview || !finding.line) {
      return;
    }

    const targetWorkflow = workflowItems.find((item) => item.path === targetPreview.path);
    if (!targetWorkflow) {
      return;
    }

    setSourceFocus({
      path: targetPreview.path,
      line: finding.line,
      lineEnd: finding.lineEnd,
      blockLabel: finding.blockLabel,
    });

    if (targetWorkflow.id === selectedWorkflowId) {
      return;
    }

    void applySelectedWorkflow(targetWorkflow.id, workflowItems, workflowPreviews).then(() => {
      setSourceFocus({
        path: targetPreview.path,
        line: finding.line ?? 1,
        lineEnd: finding.lineEnd,
        blockLabel: finding.blockLabel,
      });
    });
  }

  function handleSelectBranch(branch: string) {
    if (!repository || branch === selectedBranch) {
      return;
    }

    void loadBranchWorkflows(
      repository,
      branch,
      formState.token,
      selectedWorkflowId || undefined,
    );
  }

  function handleSelectRun(runId: number) {
    if (runId === selectedRunId) {
      return;
    }

    setSelectedRunId(runId);
    setSelectedRunJobs([]);
    setRunLoading(true);
    setAnalysisResult(null);

    void loadRunJobs(runId)
      .then((jobs) => {
        if (!selectedPreview) {
          return;
        }

        return runWorkflowSummary(selectedPreview, workflowRuns, jobs);
      })
      .finally(() => {
        setRunLoading(false);
      });
  }

  function handleExportMarkdown() {
    if (!repository || !selectedPreview) {
      return;
    }

    const markdown = buildReviewMarkdown({
      repository,
      selectedBranch,
      preview: selectedPreview,
      workflowGraph,
      repoInsight,
      branchComparison,
      runs: workflowRuns,
      analysisResult,
      ciReview: reviewReport,
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedPreview.fileName.replace(/\.(ya?ml)$/i, '')}-review.md`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function handleExportWorkflowFile() {
    if (!selectedPreview) {
      return;
    }

    const blob = new Blob([selectedPreview.content], {
      type: 'application/x-yaml;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedPreview.fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <div className="background-grid" />
      <RepositoryForm
        connectedRepo={repository}
        errorMessage={errorMessage}
        branches={branches}
        branchLoading={workflowLoading}
        loading={repositoryLoading}
        onChange={persistFormState}
        onBranchChange={handleSelectBranch}
        onSubmit={() => {
          void handleLoadRepository();
        }}
        onToggleTheme={() => {
          setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
        }}
        progressState={progressState}
        selectedBranch={selectedBranch}
        theme={theme}
        value={formState}
      />

      <main className="workspace-layout">
        <WorkflowMapPanel
          loading={repositoryLoading || workflowLoading}
          map={workflowMap}
          onSelect={handleSelectWorkflow}
          selectedId={selectedWorkflowId}
        />

        {repository ? (
          <ReviewReportPanel
            onExportMarkdown={handleExportMarkdown}
            preview={selectedPreview}
            report={reviewReport}
            repository={repository}
            selectedBranch={selectedBranch}
            onSelectFinding={handleSelectFinding}
            onSelectWorkflow={handleSelectWorkflowByFileName}
          />
        ) : null}

        {selectedWorkflowId ? (
          <>
            <button
              aria-label="Close detail drawer"
              className="detail-backdrop"
              onClick={closeDetailDrawer}
              type="button"
            />
            <aside
              aria-label="workflow detail drawer"
              className={`detail-drawer ${selectedWorkflowId ? 'is-open' : ''}`}
            >
              <div className="detail-workspace">
                <div className="detail-workspace-header">
                  <div>
                    <p className="eyebrow">Selected Workflow</p>
                    <h2>{selectedPreview?.workflowName ?? 'Workflow detail'}</h2>
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={closeDetailDrawer}
                    type="button"
                  >
                    Close Detail
                  </button>
                </div>

                <div className="detail-workspace-grid">
                  <section className="panel detail-summary-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Workflow Summary</p>
                        <h2>이 workflow는 무엇을 하는가</h2>
                      </div>
                    </div>
                    <p className="panel-note">
                      {analysisLoading
                        ? '선택한 workflow를 분석해서 간단한 설명을 정리하는 중입니다.'
                        : drawerSummary ?? '현재 workflow 구조를 요약할 정보가 아직 부족합니다.'}
                    </p>
                  </section>
                  <GraphCanvas
                    graph={workflowGraph}
                    loading={workflowLoading || runLoading}
                    onSelectJob={setSelectedJobId}
                    selectedJobId={selectedJobId}
                  />
                  <RunHistoryPanel
                    loading={runLoading}
                    onSelectRun={handleSelectRun}
                    runs={workflowRuns}
                    selectedRunId={selectedRunId}
                    selectedRunJobs={selectedRunJobs}
                  />
                  <JobDetailPanel
                    loading={workflowLoading}
                    onExport={handleExportWorkflowFile}
                    preview={selectedPreview}
                    sourceFocus={sourceFocus}
                  />
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </main>
    </div>
  );
}

function mapLoadError(message: string) {
  if (message.includes('404')) {
    return '레포 또는 .github/workflows 경로를 찾지 못했습니다.';
  }

  if (message.includes('401')) {
    return 'GitHub 토큰이 유효하지 않습니다.';
  }

  if (message.includes('403')) {
    return 'GitHub 접근 권한이 없거나 rate limit에 걸렸습니다.';
  }

  return message || '레포 정보를 불러오지 못했습니다.';
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function orderBranches(branches: BranchSummary[], defaultBranch: string) {
  return [...branches].sort((left, right) => {
    if (left.name === defaultBranch) {
      return -1;
    }

    if (right.name === defaultBranch) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}
