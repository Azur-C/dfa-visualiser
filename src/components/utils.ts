import { Position, type Node } from 'reactflow';
import { DFA_NODE_SIZE } from './DfaNode';

const START_NODE_RADIUS = 9;

// We want lines to point from the center of node A to the center of node B,
// and intersect with the circle boundary.
export function getEdgeParams(source: Node, target: Node) {
  const centerA = getNodeCenter(source);
  const centerB = getNodeCenter(target);

  const rA = getNodeRadius(source);
  const rB = getNodeRadius(target);

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // If distance is 0, just fallback to center
  if (dist === 0) {
    return {
      sx: centerA.x,
      sy: centerA.y,
      tx: centerB.x,
      ty: centerB.y,
      mx: centerA.x,
      my: centerA.y,
      nx: 0,
      ny: -1,
      dist: 0,
      sourcePos: Position.Right,
      targetPos: Position.Left,
    };
  }

  // Unit vector from A to B
  const ux = dx / dist;
  const uy = dy / dist;

  // For a curved edge, we want the line to be slightly offset from the direct center-to-center line
  // To achieve a natural curve, we'll calculate a control point perpendicular to the line connecting centers
  // Normal vector (perpendicular to unit vector)
  const nx = -uy;
  const ny = ux;

  // We want the curve to enter/exit the nodes slightly offset from the direct center line
  // So the connection points will be shifted along the normal vector
  const offsetAngle = Math.PI / 12; // 15 degrees offset
  
  // Calculate new unit vectors for source and target points rotated by offsetAngle
  const cosA = Math.cos(offsetAngle);
  const sinA = Math.sin(offsetAngle);
  
  // Rotate ux, uy by +offsetAngle for source
  const s_ux = ux * cosA - uy * sinA;
  const s_uy = ux * sinA + uy * cosA;

  // Source point on circle A
  const sx = centerA.x + s_ux * rA;
  const sy = centerA.y + s_uy * rA;

  // Target point on circle B (incoming angle is symmetric, so we rotate the other way)
  const t_ux = ux * cosA + uy * sinA;
  const t_uy = -ux * sinA + uy * cosA;
  const tx = centerB.x - t_ux * rB;
  const ty = centerB.y - t_uy * rB;

  return {
    sx,
    sy,
    tx,
    ty,
    // Midpoint between sx, sy and tx, ty
    mx: (sx + tx) / 2,
    my: (sy + ty) / 2,
    // The normal vector multiplied by a factor based on distance to create a control point for bezier
    nx,
    ny,
    dist,
    sourcePos: Position.Right,
    targetPos: Position.Left,
  };
}

export function getSelfLoopParams(node: Node) {
  const center = getNodeCenter(node);
  const radius = getNodeRadius(node);

  const startX = center.x + radius * 0.48;
  const startY = center.y - radius * 0.82;
  const control1X = center.x + radius * 1.8;
  const control1Y = center.y - radius * 2.35;
  const control2X = center.x - radius * 1.8;
  const control2Y = center.y - radius * 2.35;
  const endX = center.x - radius * 0.48;
  const endY = center.y - radius * 0.82;

  return {
    edgePath: `M ${startX} ${startY} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${endX} ${endY}`,
    labelX: center.x,
    labelY: center.y - radius * 2.18,
  };
}

export function isPointInsideNode(node: Node, point: { x: number; y: number }) {
  const center = getNodeCenter(node);
  const radius = getNodeRadius(node);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return dx * dx + dy * dy <= (radius * 1.1) * (radius * 1.1);
}

export function getNodeCenter(node: Node) {
  return {
    x: (node.positionAbsolute?.x ?? node.position.x) + (node.width ?? DFA_NODE_SIZE) / 2,
    y: (node.positionAbsolute?.y ?? node.position.y) + (node.height ?? DFA_NODE_SIZE) / 2,
  };
}

export function getNodeRadius(node: Node) {
  return node.id === "__start__" ? START_NODE_RADIUS : (node.width ?? DFA_NODE_SIZE) / 2;
}
