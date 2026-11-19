import React from 'react';
import type { ScenePosition } from '../../../../shared/project-home.ts';
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH, type SceneEdge } from '../../../../shared/scene-map-layout.ts';

/** 中心から相手の中心へ向かう線が、ノードの枠と交わる点。 */
function boundaryPoint(from: ScenePosition, to: ScenePosition): ScenePosition {
  const cx = from.x + SCENE_NODE_WIDTH / 2, cy = from.y + SCENE_NODE_HEIGHT / 2;
  const dx = to.x + SCENE_NODE_WIDTH / 2 - cx, dy = to.y + SCENE_NODE_HEIGHT / 2 - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(Math.abs(SCENE_NODE_WIDTH / 2 / (dx || 1e-9)), Math.abs(SCENE_NODE_HEIGHT / 2 / (dy || 1e-9)));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** シーン間の遷移を矢印で描く (PF-MAP-8)。同じ向きの遷移は 1 本にまとめて件数を出す。自分自身への遷移は詳細だけに出す。 */
export function SceneEdges({ edges, positions, width, height }: {
  edges: readonly SceneEdge[]; positions: ReadonlyMap<string, ScenePosition>; width: number; height: number;
}): React.ReactElement {
  const pairs = new Set(edges.map((edge) => `${edge.from}->${edge.to}`));
  return <svg className="scene-edges" width={width} height={height} aria-hidden="true">
    <defs><marker id="scene-edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker></defs>
    {edges.map((edge) => {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      if (!from || !to || edge.from === edge.to) return null;
      // 行き来がある 2 シーンは線が重ならないように少しずらす。
      const offset = pairs.has(`${edge.to}->${edge.from}`) ? 8 : 0;
      const start = boundaryPoint(from, to), end = boundaryPoint(to, from);
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const nx = -(end.y - start.y) / length * offset, ny = (end.x - start.x) / length * offset;
      const label = edge.count > 1 ? `${edge.label} ほか ${edge.count - 1}` : edge.label;
      return <g key={edge.id}>
        <line x1={start.x + nx} y1={start.y + ny} x2={end.x + nx} y2={end.y + ny} markerEnd="url(#scene-edge-arrow)" />
        <text x={(start.x + end.x) / 2 + nx} y={(start.y + end.y) / 2 + ny - 6} textAnchor="middle">{label}</text>
      </g>;
    })}
  </svg>;
}
