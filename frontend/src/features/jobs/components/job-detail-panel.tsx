import type { WorkflowPreview } from '../../../types';

type JobDetailPanelProps = {
  preview: WorkflowPreview | null;
  loading: boolean;
  summary: string | null;
  onExport: () => void;
};

export function JobDetailPanel({
  preview,
  loading,
  summary,
  onExport,
}: JobDetailPanelProps) {
  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow Preview</p>
          <h2>{preview?.workflowName ?? '선택된 워크플로우 없음'}</h2>
        </div>
        <div className="map-panel-actions">
          {preview ? <span className="badge">{preview.lineCount} lines</span> : null}
          {preview ? (
            <button
              className="button button-secondary"
              onClick={onExport}
              type="button"
            >
              파일 다운로드
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <p className="empty-state">워크플로우 내용을 불러오는 중입니다.</p> : null}
      {!loading && !preview ? (
        <p className="empty-state">워크플로우를 선택하면 파일 미리보기가 나타납니다.</p>
      ) : null}

      {preview ? (
        <>
          <div className="report-card">
            <span className="detail-label">AI Summary</span>
            <strong>이 workflow는 어떤 흐름인가</strong>
            <p>{summary ?? '요약을 생성하는 중이거나 아직 사용할 수 없습니다.'}</p>
          </div>

          <div className="detail-grid">
            <div>
              <span className="detail-label">Path</span>
              <strong>{preview.path}</strong>
            </div>
            <div>
              <span className="detail-label">SHA</span>
              <strong>{preview.sha.slice(0, 12)}</strong>
            </div>
          </div>

          <pre className="code-preview">
            <code>{preview.content}</code>
          </pre>
        </>
      ) : null}
    </section>
  );
}
