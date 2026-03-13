import { useEffect, useMemo, useRef } from 'react';
import type { WorkflowPreview } from '../../../types';

type JobDetailPanelProps = {
  preview: WorkflowPreview | null;
  loading: boolean;
  onExport: () => void;
  sourceFocus: {
    path: string;
    line: number;
    lineEnd?: number;
    blockLabel?: string;
  } | null;
};

export function JobDetailPanel({
  preview,
  loading,
  onExport,
  sourceFocus,
}: JobDetailPanelProps) {
  const lineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const lines = useMemo(() => preview?.content.split(/\r?\n/) ?? [], [preview?.content]);
  const activeRange =
    preview && sourceFocus?.path === preview.path && sourceFocus.line
      ? {
          start: sourceFocus.line,
          end: sourceFocus.lineEnd ?? sourceFocus.line,
          label: sourceFocus.blockLabel ?? null,
        }
      : null;

  useEffect(() => {
    if (!activeRange) {
      return;
    }

    const element = lineRefs.current[activeRange.start];
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeRange]);

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow Source</p>
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
          {activeRange ? (
            <div className="source-focus-banner">
              <strong>현재 포커스</strong>
              <span>
                {activeRange.label ? `${activeRange.label} block · ` : ''}
                {preview.path}:{activeRange.start}
                {activeRange.end !== activeRange.start ? `-${activeRange.end}` : ''}
              </span>
            </div>
          ) : null}

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
            <code>
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const isActive =
                  activeRange !== null &&
                  lineNumber >= activeRange.start &&
                  lineNumber <= activeRange.end;

                return (
                  <span
                    key={`${preview.path}-${lineNumber}`}
                    className={`code-line ${isActive ? 'is-active' : ''}`}
                    ref={(element) => {
                      lineRefs.current[lineNumber] = element;
                    }}
                  >
                    <span className="code-line-number">{lineNumber}</span>
                    <span className="code-line-text">{line || ' '}</span>
                  </span>
                );
              })}
            </code>
          </pre>
        </>
      ) : null}
    </section>
  );
}
