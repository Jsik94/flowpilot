import type { CiReviewReport, RepositoryRef, WorkflowPreview } from '../../../types';

type ReviewReportPanelProps = {
  repository: RepositoryRef;
  selectedBranch: string;
  preview: WorkflowPreview | null;
  report: CiReviewReport | null;
  onExportMarkdown: () => void;
};

export function ReviewReportPanel({
  repository,
  selectedBranch,
  preview,
  report,
  onExportMarkdown,
}: ReviewReportPanelProps) {
  return (
    <section className="panel report-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Review Report</p>
          <h2>브랜치 전체 CI 리뷰</h2>
          <p className="muted">
            {repository.fullName} · {selectedBranch}
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={!preview || !report}
          onClick={onExportMarkdown}
          type="button"
        >
          Export Markdown
        </button>
      </div>

      {!report ? (
        <p className="empty-state report-empty">레포를 연결하면 브랜치 단위 CI 리뷰가 생성됩니다.</p>
      ) : (
        <>
          <section className="report-glance-card">
            <div className="report-glance-header">
              <div>
                <span className="report-kicker">At a Glance</span>
                <h3>{report.headline}</h3>
              </div>
              <div className="report-score-badge">
                <strong>{report.score}</strong>
                <span>/ 100</span>
              </div>
            </div>
            <p className="report-glance-summary">{report.summary}</p>

            <div className="glance-columns">
              <article className="glance-column">
                <strong>잘 작동하는 점</strong>
                <ul>
                  {report.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="glance-column is-caution">
                <strong>우선 살펴볼 점</strong>
                <ul>
                  {report.watchouts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="glance-column is-action">
                <strong>빠른 개선 액션</strong>
                <ul>
                  {report.quickWins.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="report-stats-grid">
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.workflowCount}</span>
              <span className="report-stat-label">Workflows</span>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.preMergeCount}</span>
              <span className="report-stat-label">Pre-merge</span>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.postMergeCount}</span>
              <span className="report-stat-label">Post-merge</span>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.manualCount}</span>
              <span className="report-stat-label">Manual / Scheduled</span>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.jobCount}</span>
              <span className="report-stat-label">Jobs</span>
            </article>
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.runCount}</span>
              <span className="report-stat-label">Observed Runs</span>
            </article>
          </section>

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">CI Evaluation</p>
                <h2>평가 관점별 점수</h2>
              </div>
            </div>

            <div className="report-category-grid">
              {report.categoryScores.map((category) => (
                <article key={category.key} className="report-category-card">
                  <div className="report-category-top">
                    <strong>{category.label}</strong>
                    <span className="badge">{category.score}점</span>
                  </div>
                  <div className="report-progress-track">
                    <div className="report-progress-fill" style={{ width: `${category.score}%` }} />
                  </div>
                  <p>{category.summary}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Deep Review</p>
                <h2>세부 발견 사항</h2>
              </div>
            </div>

            <div className="report-findings-list">
              {report.findings.map((finding) => (
                <article key={finding.id} className={`report-finding-card is-${finding.severity}`}>
                  <div className="report-finding-top">
                    <span className={`pill pill-${finding.severity}`}>{finding.severity}</span>
                    <strong>{finding.summary}</strong>
                  </div>
                  <p className="issue-target">
                    {finding.workflowName ? `${finding.workflowName} · ` : ''}
                    {finding.category}
                  </p>
                  <p>{finding.recommendation}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
