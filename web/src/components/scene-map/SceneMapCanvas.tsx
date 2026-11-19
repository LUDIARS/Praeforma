import React from 'react';
import type { SceneMapScene, ScenePosition } from '../../../../shared/project-home.ts';
import { SCENE_NODE_HEIGHT, SCENE_NODE_WIDTH, sceneEdges } from '../../../../shared/scene-map-layout.ts';
import { SceneEdges } from './SceneEdges.tsx';
import { SceneNode } from './SceneNode.tsx';
import { MAX_ZOOM, MIN_ZOOM, useCanvasView } from './useCanvasView.ts';

const CLICK_SLOP = 4;

/**
 * シーンのキャプチャを並べた遷移図キャンバス (PF-MAP-7〜10)。
 * 閲覧時はノードを押すと選ぶだけ。editing のときだけノードをドラッグで動かせる。
 */
export function SceneMapCanvas({ pid, scenes, positions, editing, selectedId, onSelect, onMove }: {
  pid: string; scenes: readonly SceneMapScene[]; positions: ReadonlyMap<string, ScenePosition>; editing: boolean;
  selectedId: string | null; onSelect: (id: string | null) => void; onMove: (id: string, position: ScenePosition) => void;
}): React.ReactElement {
  const viewport = React.useRef<HTMLDivElement>(null);
  const { view, zoomBy, fit, panHandlers, wasPanned } = useCanvasView(viewport);
  const drag = React.useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: ScenePosition; moved: boolean } | null>(null);
  const edges = React.useMemo(() => sceneEdges(scenes), [scenes]);
  const bounds = React.useMemo(() => {
    const values = [...positions.values()];
    if (!values.length) return { minX: 0, minY: 0, maxX: SCENE_NODE_WIDTH, maxY: SCENE_NODE_HEIGHT };
    return {
      minX: Math.min(...values.map((p) => p.x)), minY: Math.min(...values.map((p) => p.y)),
      maxX: Math.max(...values.map((p) => p.x)) + SCENE_NODE_WIDTH, maxY: Math.max(...values.map((p) => p.y)) + SCENE_NODE_HEIGHT,
    };
  }, [positions]);
  // 最初の表示だけ全体を収める。以後の位置変更では見ている場所を動かさない。
  const fitted = React.useRef(false);
  React.useEffect(() => {
    if (fitted.current || !scenes.length) return;
    fitted.current = true; fit(bounds);
  }, [bounds, fit, scenes.length]);

  const startNode = (id: string) => (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: positions.get(id)!, moved: false };
  };
  const moveNode = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX, dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    state.moved = true;
    if (editing) onMove(state.id, { x: Math.round(state.origin.x + dx / view.zoom), y: Math.round(state.origin.y + dy / view.zoom) });
  };
  const endNode = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!state.moved) onSelect(state.id === selectedId ? null : state.id);
  };

  const width = Math.max(bounds.maxX, 0) + 200, height = Math.max(bounds.maxY, 0) + 200;
  return <div className="scene-canvas-wrap">
    <div className="scene-canvas-tools" role="toolbar" aria-label="表示の倍率">
      <button type="button" className="ghost" onClick={() => zoomBy(1 / 1.2)} disabled={view.zoom <= MIN_ZOOM} aria-label="縮小">−</button>
      <span aria-live="polite">{Math.round(view.zoom * 100)}%</span>
      <button type="button" className="ghost" onClick={() => zoomBy(1.2)} disabled={view.zoom >= MAX_ZOOM} aria-label="拡大">＋</button>
      <button type="button" className="ghost" onClick={() => fit(bounds)}>全体を表示</button>
    </div>
    <div ref={viewport} className="scene-canvas" data-editing={editing || undefined} {...panHandlers}
      onClick={(event) => { if (!(event.target as Element).closest('.scene-node') && !wasPanned()) onSelect(null); }}>
      <div className="scene-canvas-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, width, height }}
        onPointerMove={moveNode} onPointerUp={endNode} onPointerCancel={endNode}>
        <SceneEdges edges={edges} positions={positions} width={width} height={height} />
        {scenes.map((scene) => <SceneNode key={scene.id} pid={pid} scene={scene} position={positions.get(scene.id)!}
          selected={scene.id === selectedId} editing={editing} onPointerDown={startNode(scene.id)}
          onSelect={() => onSelect(scene.id === selectedId ? null : scene.id)} />)}
      </div>
    </div>
  </div>;
}
