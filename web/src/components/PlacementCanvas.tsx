// 2D 配置 canvas — placeholder を四角で描画、 ドラッグで移動、 端ハンドルでリサイズ。
//
// 状態は親が持ち、 PlacementState を props で受け取って onChange で返す。
// snap / 回転 は v0.2 で。

import React from 'react';

export interface PlacementItem {
  id: string;
  objectId: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  lock: boolean;
}

export interface PlacementState {
  items: PlacementItem[];
  selectedId: string | null;
}

interface Props {
  state: PlacementState;
  onChange: (next: PlacementState) => void;
  colorFor: (item: PlacementItem) => string;
  labelFor: (item: PlacementItem) => string;
}

const PLACEHOLDER_BASE = 80; // px = scale 1 のときの一辺

type DragKind = 'move' | 'resize-br' | null;

interface DragState {
  kind: DragKind;
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origSx: number;
  origSy: number;
}

export function PlacementCanvas({ state, onChange, colorFor, labelFor }: Props): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);

  // 再描画
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // grid
    ctx.strokeStyle = '#eef0f4';
    ctx.lineWidth = 1;
    for (let x = 0; x < rect.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
    }

    // items
    for (const it of state.items) {
      const w = PLACEHOLDER_BASE * it.sx;
      const h = PLACEHOLDER_BASE * it.sy;
      const x = it.x - w / 2;
      const y = it.y - h / 2;
      ctx.fillStyle = colorFor(it);
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = state.selectedId === it.id ? '#2a6df4' : '#1d2230';
      ctx.lineWidth = state.selectedId === it.id ? 2 : 1;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#1d2230';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(labelFor(it), x + 4, y + 14);

      if (state.selectedId === it.id) {
        // resize handle (右下)
        ctx.fillStyle = '#2a6df4';
        ctx.fillRect(x + w - 6, y + h - 6, 12, 12);
      }
      if (it.lock) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '10px system-ui';
        ctx.fillText('🔒', x + w - 14, y + 12);
      }
    }
  }, [state, colorFor, labelFor]);

  function getMousePos(e: React.MouseEvent): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitTest(p: { x: number; y: number }): { id: string; kind: DragKind } | null {
    // 上に乗っている item を最後尾から探す
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      if (!it) continue;
      const w = PLACEHOLDER_BASE * it.sx;
      const h = PLACEHOLDER_BASE * it.sy;
      const x0 = it.x - w / 2;
      const y0 = it.y - h / 2;
      if (state.selectedId === it.id) {
        // resize handle 優先
        if (p.x >= x0 + w - 6 && p.x <= x0 + w + 6 && p.y >= y0 + h - 6 && p.y <= y0 + h + 6) {
          return { id: it.id, kind: 'resize-br' };
        }
      }
      if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) {
        return { id: it.id, kind: 'move' };
      }
    }
    return null;
  }

  function onMouseDown(e: React.MouseEvent): void {
    const p = getMousePos(e);
    const hit = hitTest(p);
    if (!hit) {
      onChange({ ...state, selectedId: null });
      return;
    }
    const it = state.items.find((i) => i.id === hit.id);
    if (!it) return;
    if (it.lock) {
      onChange({ ...state, selectedId: hit.id });
      return;
    }
    onChange({ ...state, selectedId: hit.id });
    dragRef.current = {
      kind: hit.kind,
      id: hit.id,
      startX: p.x, startY: p.y,
      origX: it.x, origY: it.y, origSx: it.sx, origSy: it.sy,
    };
  }

  function onMouseMove(e: React.MouseEvent): void {
    const d = dragRef.current;
    if (!d) return;
    const p = getMousePos(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    const items = state.items.map((it) => {
      if (it.id !== d.id) return it;
      if (d.kind === 'move') return { ...it, x: d.origX + dx, y: d.origY + dy };
      if (d.kind === 'resize-br') {
        const sx = Math.max(0.1, d.origSx + dx / PLACEHOLDER_BASE);
        const sy = Math.max(0.1, d.origSy + dy / PLACEHOLDER_BASE);
        return { ...it, sx, sy };
      }
      return it;
    });
    onChange({ ...state, items });
  }

  function onMouseUp(): void {
    dragRef.current = null;
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}
