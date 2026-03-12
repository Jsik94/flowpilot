import type { RunSummary } from '../../../types';

type RunHistoryPanelProps = {
  runs: RunSummary[];
  selectedRunId: number;
};

export function RunHistoryPanel({
  runs,
  selectedRunId,
}: RunHistoryPanelProps) {
  return (
    <section className="panel timeline-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Runs</p>
          <h2>최근 실행 이력</h2>
        </div>
      </div>

      <div className="run-list">
        {runs.map((run) => (
          <button
            key={run.id}
            className={`run-item ${run.id === selectedRunId ? 'is-active' : ''}`}
            type="button"
          >
            <div className="run-main">
              <strong>#{run.id}</strong>
              <span>{run.branch}</span>
            </div>
            <div className="run-meta">
              <span className={`pill pill-${run.status}`}>{run.status}</span>
              <span>{run.event}</span>
              <span>{run.startedAt}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
