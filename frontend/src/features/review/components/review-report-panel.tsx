import type { AnalysisResult, BranchComparison, RepoInsight, RepositoryRef, RunSummary, WorkflowGraph, WorkflowPreview } from '../../../types';

type ReviewReportPanelProps = {
  repository: RepositoryRef;
  selectedBranch: string;
  workflowCount: number;
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
  workflowCount,
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
          <h2>브랜치 전체 CI 리뷰</h2>
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
          <p>브랜치 `{selectedBranch}` 기준 workflow {workflowCount}개와 레포 신호를 함께 검토합니다.</p>
          <p>{analysisResult?.summary ?? '선택된 workflow의 AI 요약은 드로어 안에서 확인할 수 있습니다.'}</p>
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
          <span className="detail-label">CI Perspective</span>
          <strong>현재 CI 흐름 평가</strong>
          <p>Jobs {workflowGraph?.jobs.length ?? 0}개, 최근 runs {runs.length}개를 기준으로 현재 CI 흐름을 요약합니다.</p>
          <p>{workflowGraph?.jobs.map((job) => job.title).slice(0, 4).join(', ') || '아직 선택된 workflow가 없습니다.'}</p>
        </article>
      </div>

      <div className="report-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">CI Review</p>
            <h2>평가와 개선 포인트</h2>
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
          <p className="empty-state">선택한 workflow를 기준으로 CI 관점의 평가와 개선 포인트를 정리합니다.</p>
        )}
      </div>
    </section>
  );
}
