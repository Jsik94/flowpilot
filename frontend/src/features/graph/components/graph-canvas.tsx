import type { RunSummary, WorkflowGraph } from '../../../types';

type GraphCanvasProps = {
  graph: WorkflowGraph | null;
  loading: boolean;
  selectedJobId: string;
  selectedRun: RunSummary | null;
  onSelectJob: (jobId: string) => void;
};

export function GraphCanvas({
  graph,
  loading,
  selectedJobId,
  selectedRun,
  onSelectJob,
}: GraphCanvasProps) {
  const levels = graph
    ? [...new Set(graph.nodes.map((node) => node.level))].sort((a, b) => a - b)
    : [];
  const selectedJob = graph?.jobs.find((job) => job.id === selectedJobId) ?? null;

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Graph</p>
          <h2>{graph?.workflowName ?? 'Job dependency view'}</h2>
        </div>
        <div className="graph-legend">
          <span>Jobs</span>
          <span>Dependencies</span>
          <span>Steps</span>
        </div>
      </div>

      {selectedRun ? (
        <p className="panel-note">
          현재 선택된 실행은 <strong>#{selectedRun.runNumber}</strong> 입니다. 아래 Job 카드와 Step Flow는 이 실행 결과를 기준으로 상태를 반영합니다.
        </p>
      ) : (
        <p className="panel-note">
          run을 선택하면 어떤 job과 step이 성공하거나 실패했는지 이 그래프에 바로 반영됩니다.
        </p>
      )}

      {loading ? <p className="empty-state">브랜치 기준 그래프를 구성하는 중입니다.</p> : null}
      {!loading && !graph ? (
        <p className="empty-state">워크플로우를 선택하면 Job 그래프가 표시됩니다.</p>
      ) : null}

      {graph ? (
        <>
          <div className="graph-lanes">
            {levels.map((level) => (
              <div key={level} className="graph-lane">
                <p className="lane-title">LEVEL {level}</p>
                <div className="graph-cards">
                  {graph.nodes
                    .filter((node) => node.level === level)
                    .map((node) => {
                      const job = graph.jobs.find((item) => item.id === node.id);

                      return (
                        <button
                          key={node.id}
                          className={`graph-card state-${node.state} ${selectedJobId === node.id ? 'is-selected' : ''}`}
                          onClick={() => onSelectJob(node.id)}
                          type="button"
                        >
                          <div className="graph-card-line" />
                          <strong>{node.title}</strong>
                          <p>{node.meta}</p>
                          <div className="dependency-list">
                            <span className="dependency-label">needs</span>
                            <span>{job?.needs.length ? job.needs.join(', ') : 'none'}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="step-flow-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Step Flow</p>
                <h2>{selectedJob?.title ?? '선택된 Job 없음'}</h2>
              </div>
            </div>

            {!selectedJob ? (
              <p className="empty-state">Job을 선택하면 step 흐름이 나타납니다.</p>
            ) : (
              <div className="step-flow-list">
                {selectedJob.steps.map((step, index) => (
                  <div key={step.id} className="step-flow-item">
                    <article className="step-flow-card">
                      <div className="step-flow-top">
                        <span className={`pill pill-${step.kind === 'run' ? 'warning' : step.kind === 'uses' ? 'info' : 'neutral'}`}>
                          {step.kind}
                        </span>
                        <span className={`pill pill-${step.executionState ?? 'neutral'}`}>
                          {step.executionState ?? 'neutral'}
                        </span>
                      </div>
                      <strong>{step.title}</strong>
                      <p>{step.detail || 'detail 없음'}</p>
                    </article>
                    {index < selectedJob.steps.length - 1 ? (
                      <span className="step-flow-arrow">→</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
