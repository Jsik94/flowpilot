import type { CiReviewFinding, CiReviewReport, RepositoryRef } from '../../../types';

type ReviewReportPanelProps = {
  repository: RepositoryRef;
  selectedBranch: string;
  report: CiReviewReport | null;
  onExportMarkdown: () => void;
  onSelectFinding: (finding: CiReviewFinding) => void;
  onSelectWorkflow: (fileName: string) => void;
};

export function ReviewReportPanel({
  repository,
  selectedBranch,
  report,
  onExportMarkdown,
  onSelectFinding,
  onSelectWorkflow,
}: ReviewReportPanelProps) {
  const reviewLensByKey = new Map(report?.reviewLenses.map((lens) => [lens.key, lens]) ?? []);
  const phaseSegments = report ? buildPhaseSegments(report) : [];
  const riskMatrixNodes = report ? buildRiskMatrixNodes(report) : [];
  const failureHighlights = report?.failureInsights.items.slice(0, 3) ?? [];
  const optimizationHighlights = report?.optimizationRows.slice(0, 4) ?? [];

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
          disabled={!report}
          onClick={onExportMarkdown}
          type="button"
        >
          리포트 다운로드
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
            <article className="report-stat-card stat-workflows">
              <span className="report-stat-value">{report.stats.workflowCount}</span>
              <span className="report-stat-label">Workflows</span>
            </article>
            <article className="report-stat-card stat-premerge">
              <span className="report-stat-value">{report.stats.preMergeCount}</span>
              <span className="report-stat-label">Pre-merge</span>
            </article>
            <article className="report-stat-card stat-postmerge">
              <span className="report-stat-value">{report.stats.postMergeCount}</span>
              <span className="report-stat-label">Post-merge</span>
            </article>
            <article className="report-stat-card stat-manual">
              <span className="report-stat-value">{report.stats.manualCount}</span>
              <span className="report-stat-label">Manual / Scheduled</span>
            </article>
            <article className="report-stat-card stat-jobs">
              <span className="report-stat-value">{report.stats.jobCount}</span>
              <span className="report-stat-label">Jobs</span>
            </article>
            <article className="report-stat-card stat-runs">
              <span className="report-stat-value">{report.stats.runCount}</span>
              <span className="report-stat-label">Observed Runs</span>
            </article>
            <article className="report-stat-card stat-failures">
              <span className="report-stat-value">{report.stats.failedWorkflowCount}</span>
              <span className="report-stat-label">Failed Workflows</span>
            </article>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Action Center</p>
                <h2>먼저 볼 것과 바로 할 것</h2>
                <p className="muted">중복되는 목록을 줄이고, 지금 의사결정에 필요한 신호만 상단에 모았습니다.</p>
              </div>
            </div>

            <div className="report-action-layout">
              <div className="report-priority-grid">
                {report.priorityActions.map((action) => (
                  <article key={action.id} className={`report-priority-card is-${action.severity}`}>
                    <div className="report-finding-top">
                      <span className={`pill pill-${action.severity}`}>{action.severity}</span>
                      <strong>{action.title}</strong>
                    </div>
                    {action.workflowName ? <p className="issue-target">{action.workflowName}</p> : null}
                    <p><strong>왜 먼저 봐야 하나</strong> {action.why}</p>
                    <p><strong>기대 효과</strong> {action.expectedImpact}</p>
                  </article>
                ))}
              </div>

              <div className="report-summary-stack">
                <article className="report-card report-summary-card">
                  <div className="report-summary-head">
                    <div>
                      <span className="detail-label">Failure Pulse</span>
                      <strong>{report.failureInsights.summary}</strong>
                    </div>
                    <span className="badge">{report.failureInsights.items.length}</span>
                  </div>

                  {report.failureInsights.patterns.length > 0 ? (
                    <ul className="report-bullet-list report-compact-list">
                      {report.failureInsights.patterns.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  {failureHighlights.length > 0 ? (
                    <div className="report-summary-list">
                      {failureHighlights.map((item) => (
                        <button
                          key={item.fileName}
                          className="report-summary-link-card"
                          onClick={() => onSelectWorkflow(item.fileName)}
                          type="button"
                        >
                          <strong>{item.workflowName}</strong>
                          <p className="report-summary-meta">{item.fileName}</p>
                          <p>최근 실패 {item.failureCount}건</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>

                <article className="report-card report-summary-card">
                  <div>
                    <span className="detail-label">Optimization Highlights</span>
                    <strong>중복과 지연을 줄이는 우선 정리</strong>
                  </div>
                  <p className="muted">전체 표 대신 먼저 효과가 큰 항목만 추렸습니다.</p>

                  <div className="report-summary-list">
                    {optimizationHighlights.map((row) => (
                      <div key={row.id} className="report-summary-item">
                        <div className="report-summary-row">
                          <span className={`report-focus-chip focus-${mapFocusTone(row.focus)}`}>{row.focus}</span>
                          <span className="report-summary-meta">{row.workflowName ?? '브랜치 전체'}</span>
                        </div>
                        <strong>{row.issue}</strong>
                        <p>{row.recommendation}</p>
                        <p className="report-summary-meta">{row.expectedImpact}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Flow Overview</p>
                <h2>브랜치 구조를 한 번에 보는 흐름 요약</h2>
                <p className="muted">시각 요약과 스윔레인을 한 섹션에 모아 흐름 파악이 끊기지 않게 정리했습니다.</p>
              </div>
            </div>

            <div className="report-visual-grid">
              <article className="report-visual-card">
                <div className="report-visual-top">
                  <strong>Phase Distribution</strong>
                  <span className="badge">{report.stats.workflowCount} workflows</span>
                </div>
                <div className="report-phase-stack" aria-label="workflow phase distribution">
                  {phaseSegments.map((segment) => (
                    <div
                      key={segment.label}
                      className={`report-phase-segment phase-${segment.tone}`}
                      style={{ width: `${segment.width}%` }}
                      title={`${segment.label}: ${segment.count}`}
                    />
                  ))}
                </div>
                <div className="report-phase-legend">
                  {phaseSegments.map((segment) => (
                    <span key={segment.label} className="report-phase-legend-item">
                      <span className={`legend-dot ${mapPhaseLegendClass(segment.tone)}`} />
                      {segment.label} {segment.count}
                    </span>
                  ))}
                </div>
              </article>

              <article className="report-visual-card">
                <div className="report-visual-top">
                  <strong>Workflow Risk Matrix</strong>
                  <span className="badge">jobs vs risk</span>
                </div>
                <svg
                  className="report-risk-matrix"
                  viewBox="0 0 540 280"
                  role="img"
                  aria-label="workflow risk matrix"
                >
                  <line x1="64" y1="24" x2="64" y2="228" className="report-risk-axis" />
                  <line x1="64" y1="228" x2="504" y2="228" className="report-risk-axis" />
                  {[0, 1, 2, 3].map((step) => (
                    <line
                      key={`h-${step}`}
                      x1="64"
                      y1={24 + step * 68}
                      x2="504"
                      y2={24 + step * 68}
                      className="report-risk-grid"
                    />
                  ))}
                  {[0, 1, 2, 3, 4].map((step) => (
                    <line
                      key={`v-${step}`}
                      x1={64 + step * 110}
                      y1="24"
                      x2={64 + step * 110}
                      y2="228"
                      className="report-risk-grid"
                    />
                  ))}
                  <text x="16" y="28" className="report-risk-axis-label">risk</text>
                  <text x="464" y="264" className="report-risk-axis-label">jobs</text>
                  {riskMatrixNodes.map((node) => (
                    <g key={node.filePath}>
                      <title>{`${node.fullLabel} · jobs ${node.jobCount} · risk ${node.riskCount} · ${node.phaseLabel}`}</title>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius}
                        className={`report-risk-node phase-${node.tone}`}
                      />
                    </g>
                  ))}
                </svg>
                <p className="muted">
                  오른쪽일수록 job 수가 많고, 위로 갈수록 위험도 경고가 많은 workflow입니다.
                </p>
              </article>
            </div>

            <div className="report-subsection-header">
              <div>
                <span className="detail-label">Swimlanes</span>
                <strong>트리거 기준 흐름 정리</strong>
              </div>
              <p className="muted">force graph와 별개로, 각 workflow를 레인별로 묶어 전체 구성을 읽기 쉽게 정리합니다.</p>
            </div>

            <div className="report-swimlane-grid">
              {report.flowLanes.map((lane) => (
                <article key={lane.key} className="report-swimlane-card">
                  <div className="report-swimlane-header">
                    <strong>{lane.label}</strong>
                    <span className="badge">{lane.items.length}</span>
                  </div>
                  <p className="muted">{lane.description}</p>
                  <div className="report-swimlane-list">
                    {lane.items.length > 0 ? (
                      lane.items.map((item) => (
                        <button
                          key={`${lane.key}-${item.fileName}`}
                          className="report-swimlane-item"
                          onClick={() => onSelectWorkflow(item.fileName)}
                          type="button"
                        >
                          <strong>{item.workflowName}</strong>
                          <span>{item.fileName}</span>
                          <p>{item.summary}</p>
                        </button>
                      ))
                    ) : (
                      <p className="empty-state">해당 레인에 분류된 workflow가 없습니다.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workflow Focus</p>
                <h2>먼저 훑어볼 workflow 카드</h2>
                <p className="muted">표 대신 카드형으로 정리해, 위험도와 역할이 높은 workflow부터 빠르게 읽을 수 있게 했습니다.</p>
              </div>
            </div>

            <div className="report-workflow-grid">
              {report.workflowCards.map((workflow) => (
                <button
                  key={workflow.filePath}
                  className="report-workflow-card"
                  onClick={() => onSelectWorkflow(workflow.fileName)}
                  type="button"
                >
                  <div className="report-workflow-top">
                    <div>
                      <strong>{workflow.workflowName}</strong>
                      <p className="report-table-subtext">{workflow.fileName}</p>
                    </div>
                    <span className={`report-phase-chip phase-${mapPhaseTone(workflow.phaseLabel)}`}>
                      {workflow.phaseLabel}
                    </span>
                  </div>

                  <div className="report-role-badges">
                    {workflow.roles.map((role) => (
                      <span key={`${workflow.filePath}-${role}`} className="report-role-badge">
                        {role}
                      </span>
                    ))}
                  </div>

                  <p>{workflow.headline}</p>
                  <p className="report-workflow-analysis">{workflow.analysisSummary}</p>

                  <div className="report-workflow-meta">
                    <span>{workflow.triggerSummary}</span>
                    <span>{workflow.estimatedDurationText}</span>
                    <span>{workflow.failureText}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">CI Evaluation</p>
                <h2>평가 관점과 heatmap</h2>
              </div>
            </div>

            <div className="report-category-grid">
              {report.categoryScores.map((category) => {
                const lens = reviewLensByKey.get(category.key);

                return (
                  <article key={category.key} className={`report-category-card category-${category.key}`}>
                    <div className="report-category-top">
                      <strong>{category.label}</strong>
                      <span className="badge">{category.score}점</span>
                    </div>
                    <div className="report-category-chip-row">
                      <span className={`report-category-chip category-${category.key}`}>{category.label}</span>
                    </div>
                    <div className="report-progress-track">
                      <div className="report-progress-fill" style={{ width: `${category.score}%` }} />
                    </div>
                    <p>{category.summary}</p>
                    {lens?.findings.length ? (
                      <ul className="report-bullet-list report-compact-list">
                        {lens.findings.slice(0, 2).map((finding) => (
                          <li key={finding.id}>
                            <button
                              className="report-inline-link"
                              onClick={() => onSelectFinding(finding)}
                              type="button"
                            >
                              {finding.summary}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="report-table-shell report-heatmap-shell">
              <table className="report-table report-heatmap-table">
                <thead>
                  <tr>
                    <th>Workflow</th>
                    {report.categoryScores.map((category) => (
                      <th key={category.key}>{category.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.heatmapRows.map((row) => (
                    <tr key={row.filePath}>
                      <td>
                        <button
                          className="report-table-link"
                          onClick={() => onSelectWorkflow(row.fileName)}
                          type="button"
                        >
                          {row.workflowName}
                        </button>
                        <p className="report-table-subtext">{row.fileName}</p>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={`${row.filePath}-${cell.key}`}>
                          <span className={`report-heatmap-cell level-${cell.level}`}>
                            {cell.count > 0 ? cell.count : '·'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Repository Context</p>
                <h2>레포 맥락과 커버리지 매트릭스</h2>
              </div>
            </div>

            <article className="report-card">
              <span className="detail-label">Repository Summary</span>
              <strong>{report.repoSummary}</strong>
            </article>

            <div className="report-stage-grid">
              {report.repoStages.map((stage) => (
                <article key={stage.title} className="report-card">
                  <span className="detail-label">{stage.title}</span>
                  <strong>{stage.summary}</strong>
                  <ul className="report-bullet-list report-compact-list">
                    {stage.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="report-table-shell">
              <table className="report-table report-coverage-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Signal</th>
                    <th>Expectation</th>
                    <th>Current</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {report.repoCoverageRows.map((row) => (
                    <tr key={row.area}>
                      <td>{row.area}</td>
                      <td>{row.signal}</td>
                      <td>{row.expectation}</td>
                      <td>{row.currentState}</td>
                      <td>
                        <span className={`report-status-pill status-${row.status}`}>
                          {mapCoverageStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-role-grid">
              <article className="report-card">
                <span className="detail-label">Overlaps</span>
                <strong>역할 중복</strong>
                {report.roleAnalysis.overlaps.length > 0 ? (
                  <div className="report-role-list">
                    {report.roleAnalysis.overlaps.map((item) => (
                      <div key={item.role} className="report-role-item">
                        <strong>{item.role}</strong>
                        <p>{item.summary}</p>
                        <p className="issue-target">{item.workflows.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>눈에 띄는 역할 중복은 크지 않습니다.</p>
                )}
              </article>

              <article className="report-card">
                <span className="detail-label">Gaps</span>
                <strong>역할 누락</strong>
                {report.roleAnalysis.gaps.length > 0 ? (
                  <div className="report-role-list">
                    {report.roleAnalysis.gaps.map((item) => (
                      <div key={item.role} className="report-role-item">
                        <strong>{item.role}</strong>
                        <p>{item.summary}</p>
                        <p>{item.recommendation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>핵심 역할 누락은 상대적으로 적습니다.</p>
                )}
              </article>
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workflow Deep Dive</p>
                <h2>workflow별 상세 분석</h2>
              </div>
            </div>

            <div className="report-deep-dive-list">
              {report.workflowDeepDives.map((workflow) => (
                <article key={workflow.filePath} className="report-deep-dive-card">
                  <div className="report-deep-dive-header">
                    <div>
                      <strong>{workflow.workflowName}</strong>
                      <p className="issue-target">{workflow.fileName}</p>
                    </div>
                    <div className="report-workflow-meta-pill-group">
                      <span className="badge">{workflow.phaseLabel}</span>
                      <button
                        className="button button-secondary report-open-workflow-button"
                        onClick={() => onSelectWorkflow(workflow.fileName)}
                        type="button"
                      >
                        Open workflow
                      </button>
                    </div>
                  </div>

                  <div className="report-workflow-meta">
                    <span>{workflow.triggerSummary}</span>
                    <span>{workflow.estimatedDurationText}</span>
                    <span>{workflow.failureText}</span>
                  </div>

                  <div className="report-role-badges">
                    {workflow.roles.map((role) => (
                      <span key={`${workflow.filePath}-${role}`} className="report-role-badge">
                        {role}
                      </span>
                    ))}
                  </div>

                  <p className="report-workflow-analysis">{workflow.analysisSummary}</p>
                  <p>{workflow.headline}</p>
                  <p>{workflow.jobFlowSummary}</p>

                  <div className="report-role-grid">
                    <div className="report-card report-deep-dive-subcard">
                      <span className="detail-label">Failure Patterns</span>
                      <strong>반복 실패/위험 패턴</strong>
                      <ul className="report-bullet-list report-compact-list">
                        {workflow.failurePatterns.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="report-card report-deep-dive-subcard">
                      <span className="detail-label">Top Findings</span>
                      <strong>이 workflow에서 먼저 볼 포인트</strong>
                      {workflow.topFindings.length > 0 ? (
                        <ul className="report-bullet-list report-compact-list">
                          {workflow.topFindings.map((finding) => (
                            <li key={finding.id}>
                              <button
                                className="report-inline-link"
                                onClick={() => onSelectFinding(finding)}
                                type="button"
                              >
                                {finding.summary}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>현재 workflow 단위에서 뚜렷한 경고는 많지 않습니다.</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section report-section-spacious">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Deep Review</p>
                <h2>세부 발견 사항</h2>
              </div>
            </div>

            <div className="report-findings-list">
              {report.findings.map((finding) => (
                <button
                  key={finding.id}
                  className={`report-finding-card is-${finding.severity}`}
                  onClick={() => onSelectFinding(finding)}
                  type="button"
                >
                  <div className="report-finding-top">
                    <span className={`pill pill-${finding.severity}`}>{finding.severity}</span>
                    <strong>{finding.summary}</strong>
                  </div>
                  <p className="issue-target">
                    {finding.workflowName ? `${finding.workflowName} · ` : ''}
                    {finding.category}
                  </p>
                  <div className="report-category-chip-row">
                    <span className={`report-category-chip category-${finding.category}`}>{finding.category}</span>
                  </div>
                  {finding.filePath ? (
                    <p className="report-finding-location">
                      {finding.filePath}
                      {finding.line ? `:${finding.line}` : ''}
                      {finding.lineEnd && finding.lineEnd !== finding.line ? `-${finding.lineEnd}` : ''}
                      {finding.blockLabel ? ` · ${finding.blockLabel} block` : ''}
                    </p>
                  ) : null}
                  {finding.impact ? <p><strong>영향</strong> {finding.impact}</p> : null}
                  {finding.evidence ? <p><strong>근거</strong> {finding.evidence}</p> : null}
                  <p>{finding.recommendation}</p>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function mapPhaseTone(phaseLabel: string) {
  switch (phaseLabel) {
    case '머지 이전':
      return 'pre';
    case '머지 이후':
      return 'post';
    default:
      return 'manual';
  }
}

function mapCoverageStatusLabel(status: 'good' | 'watch' | 'gap') {
  switch (status) {
    case 'good':
      return '적합';
    case 'watch':
      return '검토';
    default:
      return '부족';
  }
}

function mapFocusTone(focus: '중복 작업' | '지연 시간' | '효율화') {
  switch (focus) {
    case '중복 작업':
      return 'duplication';
    case '지연 시간':
      return 'latency';
    default:
      return 'efficiency';
  }
}

function buildPhaseSegments(report: CiReviewReport) {
  const total = Math.max(1, report.stats.workflowCount);

  return [
    {
      label: '머지 이전',
      count: report.stats.preMergeCount,
      width: (report.stats.preMergeCount / total) * 100,
      tone: 'pre' as const,
    },
    {
      label: '머지 이후',
      count: report.stats.postMergeCount,
      width: (report.stats.postMergeCount / total) * 100,
      tone: 'post' as const,
    },
    {
      label: '수동/기타',
      count: report.stats.manualCount,
      width: (report.stats.manualCount / total) * 100,
      tone: 'manual' as const,
    },
  ].filter((segment) => segment.count > 0);
}

function buildRiskMatrixNodes(report: CiReviewReport) {
  const maxJobs = Math.max(1, ...report.inventoryRows.map((row) => row.jobCount));
  const maxRisk = Math.max(1, ...report.inventoryRows.map((row) => row.riskCount));

  return report.inventoryRows.slice(0, 12).map((row) => ({
    filePath: row.filePath,
    x: 64 + (row.jobCount / maxJobs) * 440,
    y: 228 - (row.riskCount / maxRisk) * 180,
    radius: 8 + Math.min(10, row.roles.length * 2),
    tone: mapPhaseTone(row.phaseLabel),
    fullLabel: row.workflowName,
    jobCount: row.jobCount,
    riskCount: row.riskCount,
    phaseLabel: row.phaseLabel,
  }));
}

function mapPhaseLegendClass(tone: 'pre' | 'post' | 'manual') {
  switch (tone) {
    case 'pre':
      return 'legend-pre-merge-dot';
    case 'post':
      return 'legend-post-merge-dot';
    default:
      return 'legend-manual-dot';
  }
}
