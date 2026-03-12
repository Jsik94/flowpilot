import type { RunJobSummary, RunSummary } from '../../../types';

type RunHistoryPanelProps = {
  runs: RunSummary[];
  selectedRunId: number | null;
  selectedRunJobs: RunJobSummary[];
  loading: boolean;
  onSelectRun: (runId: number) => void;
};

export function RunHistoryPanel({
  runs,
  selectedRunId,
  selectedRunJobs,
  loading,
  onSelectRun,
}: RunHistoryPanelProps) {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <section className="panel timeline-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Runs</p>
          <h2>최근 실행 이력</h2>
        </div>
        {selectedRun ? <span className={`pill pill-${selectedRun.status}`}>{selectedRun.status}</span> : null}
      </div>

      <p className="panel-note">
        선택한 workflow 파일의 최근 GitHub Actions 실행을 보여줍니다. run을 고르면 어떤 job이 성공하거나 실패했는지 바로 확인할 수 있습니다.
      </p>

      {loading ? <p className="empty-state">최근 실행 이력을 불러오는 중입니다.</p> : null}
      {!loading && runs.length === 0 ? (
        <p className="empty-state">이 브랜치에서 확인된 최근 실행 이력이 없습니다.</p>
      ) : null}

      <div className="run-list">
        {runs.map((run) => (
          <button
            key={run.id}
            className={`run-item ${run.id === selectedRunId ? 'is-active' : ''}`}
            onClick={() => onSelectRun(run.id)}
            type="button"
          >
            <div className="run-main">
              <strong>#{run.runNumber}</strong>
              <span>{run.title}</span>
            </div>
            <div className="run-meta">
              <span className={`pill pill-${run.status}`}>{run.status}</span>
              <span>{run.branch}</span>
              <span>{run.event}</span>
              <span>{formatRunTime(run.startedAt)}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedRun ? (
        <div className="step-flow-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Run</p>
              <h2>{selectedRun.title}</h2>
            </div>
            <span className="badge">{selectedRunJobs.length} jobs</span>
          </div>

          {selectedRunJobs.length === 0 ? (
            <p className="empty-state">선택한 run의 job 상세를 불러오는 중이거나, 표시할 job이 없습니다.</p>
          ) : (
            <div className="steps-list">
              {selectedRunJobs.map((job) => (
                <div key={job.id} className="step-item">
                  <div>
                    <strong>{job.name}</strong>
                    <p>{job.steps.length} steps</p>
                  </div>
                  <span className={`pill pill-${job.status}`}>{job.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatRunTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
