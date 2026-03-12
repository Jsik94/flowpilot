import type { WorkflowPreview } from '../../../types';

type JobDetailPanelProps = {
  preview: WorkflowPreview | null;
  loading: boolean;
};

export function JobDetailPanel({
  preview,
  loading,
}: JobDetailPanelProps) {
  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow Preview</p>
          <h2>{preview?.workflowName ?? '선택된 워크플로우 없음'}</h2>
        </div>
        {preview ? <span className="badge">{preview.lineCount} lines</span> : null}
      </div>

      {loading ? <p className="empty-state">워크플로우 내용을 불러오는 중입니다.</p> : null}
      {!loading && !preview ? (
        <p className="empty-state">워크플로우를 선택하면 파일 미리보기가 나타납니다.</p>
      ) : null}

      {preview ? (
        <>
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
            <code>{preview.preview.join('\n')}</code>
          </pre>
        </>
      ) : null}
    </section>
  );
}
