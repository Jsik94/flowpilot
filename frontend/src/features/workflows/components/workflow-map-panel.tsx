import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphEdge, WorkflowMap, WorkflowMapNode } from '../../../types';

type WorkflowMapPanelProps = {
  map: WorkflowMap | null;
  loading: boolean;
  showWeakLinks: boolean;
  selectedId: string;
  onSelect: (workflowId: string) => void;
  onToggleWeakLinks: () => void;
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
  showWeakLinks,
  selectedId,
  onSelect,
  onToggleWeakLinks,
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
            links: (showWeakLinks ? map.edges : map.strongEdges).map<ForceLink>((edge) => ({
              ...edge,
              source: edge.from,
              target: edge.to,
            })),
          }
        : { nodes: [], links: [] },
    [map, showWeakLinks],
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

    const alignToCenter = window.setTimeout(() => {
      graph.zoomToFit(500, 90);
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
        </div>
        <div className="map-panel-actions">
          <button
            className="button button-secondary map-toggle-button"
            onClick={onToggleWeakLinks}
            type="button"
          >
            {showWeakLinks ? 'Weak Link Off' : 'Weak Link On'}
          </button>
          {map ? <span className="badge">{map.nodes.length} workflows</span> : null}
        </div>
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

              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, isSelected ? 8 : 5.5, 0, 2 * Math.PI, false);
              ctx.fillStyle = isSelected ? '#5bd1a5' : '#d6deef';
              ctx.shadowBlur = isSelected ? 22 : 12;
              ctx.shadowColor = isSelected
                ? 'rgba(91, 209, 165, 0.58)'
                : 'rgba(143, 184, 255, 0.24)';
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
            }}
            nodeLabel={(node) => {
              const workflowNode = node as ForceNode;
              return `${workflowNode.workflowName}\n${workflowNode.fileName}\n${workflowNode.triggers.join(', ')}`;
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

              graph.zoomToFit(350, 90);
              graph.centerAt(0, 0, 250);
            }}
            width={size.width}
          />
        ) : null}
      </div>
    </section>
  );
}
