import type { AnalysisIssue } from '../../../types';

type AnalysisPanelProps = {
  issues: AnalysisIssue[];
};

export function AnalysisPanel({ issues }: AnalysisPanelProps) {
  return (
    <section className="panel analysis-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2>AI issue summary</h2>
        </div>
      </div>

      <div className="issue-list">
        {issues.map((issue) => (
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
    </section>
  );
}
