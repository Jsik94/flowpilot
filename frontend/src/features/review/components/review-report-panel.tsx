import type { CiReviewFinding, CiReviewReport, RepositoryRef, WorkflowPreview } from '../../../types';

type ReviewReportPanelProps = {
  repository: RepositoryRef;
  selectedBranch: string;
  preview: WorkflowPreview | null;
  report: CiReviewReport | null;
  onExportMarkdown: () => void;
  onSelectFinding: (finding: CiReviewFinding) => void;
  onSelectWorkflow: (fileName: string) => void;
};

export function ReviewReportPanel({
  repository,
  selectedBranch,
  preview,
  report,
  onExportMarkdown,
  onSelectFinding,
  onSelectWorkflow,
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
            <article className="report-stat-card">
              <span className="report-stat-value">{report.stats.failedWorkflowCount}</span>
              <span className="report-stat-label">Failed Workflows</span>
            </article>
          </section>

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Failure Snapshot</p>
                <h2>현재 브랜치 실패 요약</h2>
              </div>
            </div>

            <article className="report-card">
              <span className="detail-label">Recent Failures</span>
              <strong>{report.failureInsights.summary}</strong>
              {report.failureInsights.items.length > 0 ? (
                <div className="report-role-list">
                  {report.failureInsights.items.map((item) => (
                    <div key={item.fileName} className="report-role-item">
                      <strong>{item.workflowName}</strong>
                      <p>{item.fileName}</p>
                      <p>최근 실패 {item.failureCount}건</p>
                      <p className="issue-target">
                        {item.latestFailureJobs.length > 0
                          ? `실패 job: ${item.latestFailureJobs.join(', ')}`
                          : '최근 실패 job 상세 없음'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          </section>

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workflow Structure</p>
                <h2>브랜치 흐름 구성</h2>
              </div>
            </div>

            <div className="report-architecture-grid">
              <article className="report-card">
                <span className="detail-label">Pre-merge</span>
                <strong>머지 이전 검증</strong>
                <p>{report.architecture.preMerge.length ? report.architecture.preMerge.join(', ') : '등록된 workflow 없음'}</p>
              </article>
              <article className="report-card">
                <span className="detail-label">Post-merge</span>
                <strong>머지 이후 파이프라인</strong>
                <p>{report.architecture.postMerge.length ? report.architecture.postMerge.join(', ') : '등록된 workflow 없음'}</p>
              </article>
              <article className="report-card">
                <span className="detail-label">Manual / Scheduled</span>
                <strong>운영성 보조 흐름</strong>
                <p>{report.architecture.manual.length ? report.architecture.manual.join(', ') : '등록된 workflow 없음'}</p>
              </article>
            </div>
          </section>

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Role Analysis</p>
                <h2>역할 중복과 누락</h2>
              </div>
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

          <section className="report-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Optimization</p>
                <h2>최적화 관점 인사이트</h2>
              </div>
            </div>

            <div className="report-role-grid">
              <article className="report-card">
                <span className="detail-label">Duplicate Work</span>
                <strong>중복 작업</strong>
                {report.optimizationInsights.duplicateWork.length > 0 ? (
                  <ul className="report-bullet-list">
                    {report.optimizationInsights.duplicateWork.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>크게 보이는 중복 작업은 많지 않습니다.</p>
                )}
              </article>

              <article className="report-card">
                <span className="detail-label">Latency Risks</span>
                <strong>지연 시간 위험</strong>
                {report.optimizationInsights.latencyRisks.length > 0 ? (
                  <ul className="report-bullet-list">
                    {report.optimizationInsights.latencyRisks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>눈에 띄는 직렬 병목은 적습니다.</p>
                )}
              </article>

              <article className="report-card">
                <span className="detail-label">Efficiency Tips</span>
                <strong>효율화 팁</strong>
                {report.optimizationInsights.efficiencyTips.length > 0 ? (
                  <ul className="report-bullet-list">
                    {report.optimizationInsights.efficiencyTips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>현재 구조 기준으로 빠르게 적용할 효율화 팁은 제한적입니다.</p>
                )}
              </article>
            </div>
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
                <p className="eyebrow">Workflow Cards</p>
                <h2>workflow별 읽기 포인트</h2>
              </div>
            </div>

            <div className="report-workflow-grid">
              {report.workflowCards.map((workflow) => (
                <button
                  key={workflow.fileName}
                  className="report-workflow-card"
                  onClick={() => onSelectWorkflow(workflow.fileName)}
                  type="button"
                >
                  <div className="report-workflow-top">
                    <div>
                      <strong>{workflow.workflowName}</strong>
                      <p className="issue-target">{workflow.fileName}</p>
                    </div>
                    <span className="badge">{workflow.phaseLabel}</span>
                  </div>
                  <div className="report-workflow-meta">
                    <span>Trigger: {workflow.triggerSummary}</span>
                    <span>Jobs: {workflow.jobCount}</span>
                    <span>Risks: {workflow.riskCount}</span>
                  </div>
                  <p className="report-workflow-inline-meta">{workflow.estimatedDurationText}</p>
                  <p className="report-workflow-inline-meta">{workflow.failureText}</p>
                  <p className="report-workflow-analysis">{workflow.analysisSummary}</p>
                  <p>{workflow.headline}</p>
                </button>
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
