import { type ConnectionLineComponentProps, type Node } from 'reactflow';
import { getEdgeParams, getSelfLoopParams, isPointInsideNode } from './utils';

export function FloatingConnectionLine({
  fromNode,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  if (!fromNode) {
    return null;
  }

  if (isPointInsideNode(fromNode, { x: toX, y: toY })) {
    const loop = getSelfLoopParams(fromNode);

    return (
      <g>
        <path
          fill="none"
          stroke="var(--graph-edge)"
          strokeWidth={1.5}
          className="animated"
          d={loop.edgePath}
          style={connectionLineStyle}
        />
      </g>
    );
  }

  const targetNode: Node = {
    id: 'connection-target',
    width: 1,
    height: 1,
    // Add small offset to pointer coordinates to prevent the target node
    // from blocking mouse events which prevents onNodeMouseEnter from firing
    position: { x: toX + 5, y: toY + 5 },
    positionAbsolute: { x: toX + 5, y: toY + 5 },
    data: {},
  };

  const { sx, sy, tx, ty, mx, my, nx, ny, dist } = getEdgeParams(fromNode, targetNode);

  let edgePath = `M ${sx} ${sy} L ${tx} ${ty}`;

  if (dist && dist >= 10) {
    const curveFactor = 0.2;
    const cx = mx + nx * dist * curveFactor;
    const cy = my + ny * dist * curveFactor;
    edgePath = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
  }

  return (
    <g>
      <path
        fill="none"
        stroke="var(--graph-edge)"
        strokeWidth={1.5}
        className="animated"
        d={edgePath}
        style={connectionLineStyle}
      />
      <circle cx={toX} cy={toY} fill="var(--dfa-node-bg)" r={3} stroke="var(--graph-edge)" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
    </g>
  );
}
