import type { AnalysisIssue } from '../../../types';

type AnalysisPanelProps = {
  summary: string | null;
  issues: AnalysisIssue[];
  source: 'gemini' | 'heuristic' | null;
  loading: boolean;
  disabled: boolean;
  errorMessage: string | null;
  onAnalyze: () => void;
};

export function AnalysisPanel({
  summary,
  issues,
  source,
  loading,
  disabled,
  errorMessage,
  onAnalyze,
}: AnalysisPanelProps) {
  return (
    <section className="panel analysis-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2>AI issue summary</h2>
        </div>
        <button
          className="button button-primary"
          disabled={disabled || loading}
          onClick={onAnalyze}
          type="button"
        >
          {loading ? 'Analyzing...' : 'Analyze Workflow'}
        </button>
      </div>

      <p className="panel-note">
        선택한 workflow 파일과 최근 실행 결과를 함께 분석합니다. 먼저 어디를 봐야 할지 우선순위를 잡아주는 용도입니다.
      </p>

      {source ? <p className="panel-note">분석 소스: {source === 'gemini' ? 'Gemini' : 'Heuristic fallback'}</p> : null}
      {summary ? <p className="panel-note">{summary}</p> : null}
      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
      {!loading && !summary && !errorMessage ? (
        <p className="empty-state">워크플로우를 연 뒤 Analyze Workflow를 누르면 분석 결과가 표시됩니다.</p>
      ) : null}

      {issues.length > 0 ? (
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
      ) : null}
    </section>
  );
}
