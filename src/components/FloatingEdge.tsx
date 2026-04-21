import { useCallback } from 'react';
import { useStore, type EdgeProps, EdgeLabelRenderer, BaseEdge } from 'reactflow';

import { getEdgeParams, getSelfLoopParams } from './utils';

export function FloatingEdge({ id, source, target, markerEnd, style, label, interactionWidth = 10 }: EdgeProps) {
  const sourceNode = useStore(useCallback((store) => store.nodeInternals.get(source), [source]));
  const targetNode = useStore(useCallback((store) => store.nodeInternals.get(target), [target]));

  if (!sourceNode || !targetNode) {
    return null;
  }

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (source === target) {
    const loop = getSelfLoopParams(sourceNode);
    edgePath = loop.edgePath;
    labelX = loop.labelX;
    labelY = loop.labelY;
  } else {
    const { sx, sy, tx, ty, mx, my, nx, ny, dist } = getEdgeParams(sourceNode, targetNode);

    edgePath = `M ${sx} ${sy} L ${tx} ${ty}`;
    labelX = mx;
    labelY = my;

    if (dist && dist >= 10) {
      const curveFactor = 0.2;
      const cx = mx + nx * dist * curveFactor;
      const cy = my + ny * dist * curveFactor;

      edgePath = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

      labelX = 0.25 * sx + 0.5 * cx + 0.25 * tx;
      labelY = 0.25 * sy + 0.5 * cy + 0.25 * ty;
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 12,
              fontWeight: 700,
              pointerEvents: 'all',
              background: 'var(--edge-label-bg)',
              padding: '2px 4px',
              borderRadius: 4,
              color: 'var(--edge-label-text)',
              boxShadow: 'var(--edge-label-shadow)',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
