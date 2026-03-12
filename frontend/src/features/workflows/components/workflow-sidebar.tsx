import type { WorkflowSummary } from '../../../types';

type WorkflowSidebarProps = {
  items: WorkflowSummary[];
  selectedId: string;
  loading: boolean;
  onSelect: (workflowId: string) => void;
};

export function WorkflowSidebar({
  items,
  selectedId,
  loading,
  onSelect,
}: WorkflowSidebarProps) {
  return (
    <section className="panel sidebar-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflows</p>
          <h2>선택 가능한 파일</h2>
        </div>
        <span className="badge">{items.length}</span>
      </div>

      <div className="workflow-list">
        {loading ? <p className="empty-state">워크플로우 목록을 불러오는 중입니다.</p> : null}
        {!loading && items.length === 0 ? (
          <p className="empty-state">`.github/workflows` 아래 YAML 파일이 없습니다.</p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            className={`workflow-item ${selectedId === item.id ? 'is-active' : ''}`}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <div>
              <strong>{item.fileName}</strong>
              <p>{item.subtitle}</p>
            </div>
            <span className={`status-dot status-${item.status}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
