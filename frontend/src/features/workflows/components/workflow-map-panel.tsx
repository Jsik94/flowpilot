import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphEdge, WorkflowDiagnostic, WorkflowMap, WorkflowMapNode } from '../../../types';

type WorkflowMapPanelProps = {
  map: WorkflowMap | null;
  loading: boolean;
  diagnostics: Record<string, WorkflowDiagnostic>;
  selectedId: string;
  onSelect: (workflowId: string) => void;
};

type ForceNode = WorkflowMapNode & {
  id: string;
};

type ForceLink = GraphEdge & {
  source: string;
  target: string;
};

export function WorkflowMapPanel({
  map,
  loading,
  diagnostics,
  selectedId,
  onSelect,
}: WorkflowMapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(undefined);
  const [size, setSize] = useState({ width: 960, height: 560 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setSize({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(420, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const graphData = useMemo(
    () =>
      map
        ? {
            nodes: map.nodes.map((node) => ({ ...node })) as ForceNode[],
            links: map.edges.map<ForceLink>((edge) => ({
              ...edge,
              source: edge.from,
              target: edge.to,
            })),
          }
        : { nodes: [], links: [] },
    [map],
  );

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph || !map) {
      return;
    }

    graph.d3Force('charge')?.strength?.(-320);
    graph.d3Force('link')?.distance?.((link: ForceLink) =>
      link.kind === 'weak' ? 180 : 240,
    );
    graph.d3Force('x')?.strength?.(0.1);
    graph.d3Force('x')?.x?.((node: ForceNode) => {
      const maxOrder = Math.max(1, ...map.nodes.map((item) => item.phaseOrder));
      const segment = size.width / (maxOrder + 2);
      return segment * (node.phaseOrder + 1);
    });
    graph.d3Force('y')?.strength?.(0.04);
    graph.d3Force('y')?.y?.((node: ForceNode) => size.height / 2 + (node.level - 1) * 90);

    const alignToCenter = window.setTimeout(() => {
      graph.zoomToFit(500, 14);
      graph.centerAt(0, 0, 350);
    }, 60);

    return () => {
      window.clearTimeout(alignToCenter);
    };
  }, [graphData, map, size.height, size.width]);

  return (
    <section className="panel map-overview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow Map</p>
          <h2>브랜치 전체 흐름</h2>
          <p className="map-panel-subtitle">현재 워크플로우를 시각화한 예시입니다.</p>
        </div>
        <div className="map-panel-actions">
          {map ? <span className="badge">{map.nodes.length} workflows</span> : null}
        </div>
      </div>

      <div className="map-legend-row">
        <span className="legend-chip"><span className="legend-dot legend-pre-merge-dot" /> 머지 이전</span>
        <span className="legend-chip"><span className="legend-dot legend-post-merge-dot" /> 머지 이후</span>
        <span className="legend-chip"><span className="legend-dot legend-manual-dot" /> 수동/기타</span>
      </div>

      {loading ? <p className="empty-state">브랜치 기준으로 워크플로우를 스캔하는 중입니다.</p> : null}
      {!loading && !map ? (
        <p className="empty-state">브랜치를 선택하면 워크플로우 전반 흐름이 표시됩니다.</p>
      ) : null}

      <div ref={containerRef} className="workflow-force-container">
        {map ? (
          <ForceGraph2D
            autoPauseRedraw={false}
            backgroundColor="transparent"
            cooldownTicks={120}
            graphData={graphData}
            height={size.height}
            ref={graphRef}
            linkColor={(link) =>
              (link as ForceLink).kind === 'weak'
                ? 'rgba(143, 184, 255, 0.18)'
                : 'rgba(91, 209, 165, 0.42)'
            }
            linkDirectionalParticles={(link) => ((link as ForceLink).kind === 'strong' ? 2 : 0)}
            linkDirectionalParticleColor={() => 'rgba(91, 209, 165, 0.7)'}
            linkDirectionalParticleWidth={2}
            linkWidth={(link) => ((link as ForceLink).kind === 'weak' ? 1 : 2.2)}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const workflowNode = node as ForceNode;
              const label = workflowNode.workflowName;
              const fileName = workflowNode.fileName;
              const isSelected = workflowNode.id === selectedId;
              const fontSize = Math.max(10, 15 / globalScale);
              const subFontSize = Math.max(8, 11 / globalScale);
              const metaFontSize = Math.max(7.5, 9.5 / globalScale);
              const phaseColor = getPhaseColor(workflowNode.phaseLabel);
              const diagnostic = diagnostics[workflowNode.id];
              const diagnosticLabel = buildNodeDiagnosticLabel(diagnostic);

              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, isSelected ? 8 : 5.5, 0, 2 * Math.PI, false);
              ctx.fillStyle = isSelected ? '#5bd1a5' : phaseColor;
              ctx.shadowBlur = isSelected ? 22 : 12;
              ctx.shadowColor = isSelected
                ? 'rgba(91, 209, 165, 0.58)'
                : `${phaseColor}44`;
              ctx.fill();
              ctx.restore();

              ctx.font = `600 ${fontSize}px "Avenir Next", sans-serif`;
              ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(239, 245, 255, 0.92)';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 18);

              ctx.font = `400 ${subFontSize}px "Avenir Next", sans-serif`;
              ctx.fillStyle = 'rgba(153, 171, 198, 0.92)';
              ctx.fillText(fileName, node.x ?? 0, (node.y ?? 0) + 34);

              if (diagnosticLabel) {
                ctx.font = `500 ${metaFontSize}px "Avenir Next", sans-serif`;
                ctx.fillStyle = diagnostic?.failureCount
                  ? 'rgba(255, 173, 182, 0.94)'
                  : 'rgba(143, 184, 255, 0.86)';
                ctx.fillText(diagnosticLabel, node.x ?? 0, (node.y ?? 0) + 47);
              }
            }}
            nodePointerAreaPaint={(node, color, ctx, globalScale) => {
              const workflowNode = node as ForceNode;
              const label = workflowNode.workflowName;
              const fileName = workflowNode.fileName;
              const diagnosticLabel = buildNodeDiagnosticLabel(diagnostics[workflowNode.id]);
              const x = node.x ?? 0;
              const y = node.y ?? 0;
              const fontSize = Math.max(10, 15 / globalScale);
              const subFontSize = Math.max(8, 11 / globalScale);
              const metaFontSize = Math.max(7.5, 9.5 / globalScale);

              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(x, y, 11, 0, 2 * Math.PI, false);
              ctx.fill();

              ctx.font = `600 ${fontSize}px "Avenir Next", sans-serif`;
              const labelWidth = ctx.measureText(label).width;
              ctx.font = `400 ${subFontSize}px "Avenir Next", sans-serif`;
              const fileWidth = ctx.measureText(fileName).width;
              ctx.font = `500 ${metaFontSize}px "Avenir Next", sans-serif`;
              const metaWidth = diagnosticLabel ? ctx.measureText(diagnosticLabel).width : 0;
              const hitWidth = Math.max(labelWidth, fileWidth, metaWidth) + 18;
              const hitHeight = fontSize + subFontSize + (diagnosticLabel ? metaFontSize + 10 : 0) + 18;

              ctx.fillRect(x - hitWidth / 2, y + 8, hitWidth, hitHeight);
            }}
            nodeLabel={(node) => {
              const workflowNode = node as ForceNode;
              const diagnostic = diagnostics[workflowNode.id];
              const diagnosticText = buildNodeDiagnosticLabel(diagnostic);
              return [
                workflowNode.workflowName,
                getMergeMarkerLabel(workflowNode.phaseLabel),
                workflowNode.fileName,
                workflowNode.triggers.join(', '),
                diagnosticText,
              ]
                .filter(Boolean)
                .join('\n');
            }}
            nodeRelSize={6}
            onNodeClick={(node) => {
              onSelect(String((node as ForceNode).id));
            }}
            onEngineStop={() => {
              const graph = graphRef.current;
              if (!graph) {
                return;
              }

              graph.zoomToFit(350, 14);
              graph.centerAt(0, 0, 250);
            }}
            width={size.width}
          />
        ) : null}
      </div>
    </section>
  );
}

function buildNodeDiagnosticLabel(diagnostic?: WorkflowDiagnostic) {
  if (!diagnostic) {
    return '';
  }

  const duration = diagnostic.estimatedDurationMinutes != null ? `~${diagnostic.estimatedDurationMinutes}m` : null;
  const failure = diagnostic.failureCount > 0 ? `fail ${diagnostic.failureCount}` : 'stable';
  return [duration, failure].filter(Boolean).join(' · ');
}

function getPhaseColor(phaseLabel: string) {
  switch (phaseLabel) {
    case 'PR':
      return '#8fb8ff';
    case 'Push':
    case 'Pipeline':
    case 'Release':
      return '#5bd1a5';
    case 'Manual':
    case 'Schedule':
    case 'Other':
      return '#d6deef';
    default:
      return '#d6deef';
  }
}

function getMergeMarkerLabel(phaseLabel: string) {
  switch (phaseLabel) {
    case 'PR':
      return '머지 전';
    case 'Push':
    case 'Pipeline':
    case 'Release':
      return '머지 후';
    default:
      return '수동/기타';
  }
}
