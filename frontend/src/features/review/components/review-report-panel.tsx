import type { AnalysisResult, BranchComparison, RepoInsight, RepositoryRef, RunSummary, WorkflowGraph, WorkflowPreview } from '../../../types';

type ReviewReportPanelProps = {
  repository: RepositoryRef;
  selectedBranch: string;
  preview: WorkflowPreview | null;
  workflowGraph: WorkflowGraph | null;
  repoInsight: RepoInsight | null;
  branchComparison: BranchComparison | null;
  runs: RunSummary[];
  analysisResult: AnalysisResult | null;
  onExportMarkdown: () => void;
};

export function ReviewReportPanel({
  repository,
  selectedBranch,
  preview,
  workflowGraph,
  repoInsight,
  branchComparison,
  runs,
  analysisResult,
  onExportMarkdown,
}: ReviewReportPanelProps) {
  return (
    <section className="panel report-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review Report</p>
          <h2>{preview?.workflowName ?? '워크플로우 리뷰 준비 중'}</h2>
        </div>
        <button
          className="button button-secondary"
          disabled={!preview}
          onClick={onExportMarkdown}
          type="button"
        >
          Export Markdown
        </button>
      </div>

      <div className="report-grid">
        <article className="report-card">
          <span className="detail-label">Overview</span>
          <strong>{repository.fullName}</strong>
          <p>브랜치 `{selectedBranch}` 기준 workflow 구조와 레포 분석을 함께 요약합니다.</p>
          <p>{analysisResult?.summary ?? 'Analyze Workflow를 누르면 리뷰 요약이 더 정교해집니다.'}</p>
        </article>

        <article className="report-card">
          <span className="detail-label">Repository Analysis</span>
          <strong>레포 신호</strong>
          <p>{repoInsight?.summary ?? '레포 분석 정보를 수집하는 중입니다.'}</p>
          <p>Confidence: {repoInsight?.confidence ?? 'unknown'}</p>
        </article>

        <article className="report-card">
          <span className="detail-label">Branch Comparison</span>
          <strong>{branchComparison?.baseBranch ?? repository.defaultBranch} 대비 차이</strong>
          <p>{branchComparison?.summary ?? '브랜치 비교 정보를 계산하는 중입니다.'}</p>
          <p>추가 {branchComparison?.addedWorkflows.length ?? 0} / 제거 {branchComparison?.removedWorkflows.length ?? 0}</p>
        </article>

        <article className="report-card">
          <span className="detail-label">Workflow Structure</span>
          <strong>현재 구조 요약</strong>
          <p>Jobs {workflowGraph?.jobs.length ?? 0}개, 최근 runs {runs.length}개를 기준으로 검토합니다.</p>
          <p>{workflowGraph?.jobs.map((job) => job.title).slice(0, 4).join(', ') || '선택된 workflow 없음'}</p>
        </article>
      </div>

      <div className="report-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Top Actions</p>
            <h2>우선순위 액션</h2>
          </div>
        </div>

        {analysisResult?.issues.length ? (
          <div className="issue-list">
            {analysisResult.issues.slice(0, 3).map((issue) => (
              <article key={issue.id} className={`issue-card issue-${issue.severity}`}>
                <div className="issue-top">
                  <span className={`pill pill-${issue.severity}`}>{issue.severity}</span>
                  <strong>{issue.title}</strong>
                </div>
                <p className="issue-target">{issue.target}</p>
                <p>{issue.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">AI 분석을 실행하면 우선순위 액션을 이 리포트 상단에 요약합니다.</p>
        )}
      </div>
    </section>
  );
}
