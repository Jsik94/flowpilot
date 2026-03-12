import type { RecommendationResult } from '../../../types';

type ChangeRequestPanelProps = {
  template: string;
  details: string;
  loading: boolean;
  result: RecommendationResult | null;
  errorMessage: string | null;
  onTemplateChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onRecommend: () => void;
};

const TEMPLATE_OPTIONS = [
  { value: 'slack_alert', label: 'Slack/알림 추가' },
  { value: 'approval_gate', label: '승인 게이트 추가' },
  { value: 'nightly_scan', label: 'Nightly scan 추가' },
  { value: 'cache_opt', label: '캐시 최적화' },
  { value: 'custom', label: '기타 변경 요청' },
];

export function ChangeRequestPanel({
  template,
  details,
  loading,
  result,
  errorMessage,
  onTemplateChange,
  onDetailsChange,
  onRecommend,
}: ChangeRequestPanelProps) {
  return (
    <section className="panel analysis-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Change Recommendation</p>
          <h2>변경 위치 추천</h2>
        </div>
        <button
          className="button button-primary"
          disabled={loading || !details.trim()}
          onClick={onRecommend}
          type="button"
        >
          {loading ? 'Recommending...' : 'Recommend Placement'}
        </button>
      </div>

      <p className="panel-note">
        템플릿과 자유 입력을 함께 받아서, 어떤 workflow / trigger / job / step / permission 전략에 넣는 게 맞는지 추천합니다.
      </p>

      <div className="recommend-form">
        <label>
          <span>Request Template</span>
          <select
            onChange={(event) => onTemplateChange(event.target.value)}
            value={template}
          >
            {TEMPLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="recommend-textarea">
          <span>Request Details</span>
          <textarea
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="예: main 배포 전에 승인 단계 넣고, 실패 시 Slack 알림도 같이 보내고 싶다."
            value={details}
          />
        </label>
      </div>

      {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
      {result ? <p className="panel-note">{result.summary}</p> : null}

      {result?.suggestions.length ? (
        <div className="issue-list">
          {result.suggestions.map((suggestion) => (
            <article key={suggestion.id} className="issue-card">
              <div className="issue-top">
                <span className={`pill pill-${suggestion.confidence === 'high' ? 'success' : suggestion.confidence === 'low' ? 'warning' : 'info'}`}>
                  {suggestion.confidence}
                </span>
                <strong>{suggestion.title}</strong>
              </div>
              <p className="issue-target">{suggestion.target}</p>
              <p>{suggestion.reason}</p>
              <pre className="code-preview">
                <code>{suggestion.pseudoDiff}</code>
              </pre>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">변경 요구를 입력하면 가장 적절한 삽입 위치와 pseudo diff를 추천합니다.</p>
      )}
    </section>
  );
}
