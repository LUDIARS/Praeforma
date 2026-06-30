import React from 'react';

export type WirePartKind =
  | 'panel'
  | 'text'
  | 'button'
  | 'linked-button'
  | 'draft-button'
  | 'input'
  | 'listbox'
  | 'nav'
  | 'toggle'
  | 'card'
  | 'placeholder';

export interface PlacementItem {
  id: string;
  objectId: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  lock: boolean;
  meta?: {
    kind?: WirePartKind;
    status?: 'implemented' | 'linked' | 'draft';
    listRows?: string[];
    limitListHeight?: boolean;
  };
}

export interface PlacementState {
  items: PlacementItem[];
  selectedId: string | null;
}

interface Props {
  state: PlacementState;
  onChange: (next: PlacementState) => void;
  screen: { width: number; height: number };
  colorFor: (item: PlacementItem) => string;
  labelFor: (item: PlacementItem) => string;
  kindFor?: (item: PlacementItem) => WirePartKind;
}

const PLACEHOLDER_BASE = 80;

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

export function PlacementCanvas({
  state,
  onChange,
  screen,
  colorFor,
  labelFor,
  kindFor,
}: Props): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);

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

    const transform = getStageTransform(rect, screen);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(transform.x, transform.y, screen.width * transform.scale, screen.height * transform.scale);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.strokeRect(transform.x, transform.y, screen.width * transform.scale, screen.height * transform.scale);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    ctx.strokeStyle = '#eef0f4';
    ctx.lineWidth = 1;
    for (let x = 0; x < screen.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, screen.height);
      ctx.stroke();
    }
    for (let y = 0; y < screen.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(screen.width, y);
      ctx.stroke();
    }

    for (const it of state.items) {
      const w = PLACEHOLDER_BASE * it.sx;
      const h = PLACEHOLDER_BASE * it.sy;
      const x = it.x - w / 2;
      const y = it.y - h / 2;
      drawWirePart(ctx, {
        x,
        y,
        w,
        h,
        label: labelFor(it),
        kind: it.meta?.kind ?? kindFor?.(it) ?? 'placeholder',
        color: colorFor(it),
        selected: state.selectedId === it.id,
        status: it.meta?.status,
        listRows: it.meta?.listRows,
        limitListHeight: it.meta?.limitListHeight,
      });

      if (state.selectedId === it.id) {
        ctx.fillStyle = '#2a6df4';
        ctx.fillRect(x + w - 6, y + h - 6, 12, 12);
      }
      if (it.lock) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '10px system-ui';
        ctx.fillText('lock', x + w - 28, y + 12);
      }
    }
    ctx.restore();
  }, [state, screen, colorFor, labelFor, kindFor]);

  function getMousePos(e: React.MouseEvent): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    const transform = getStageTransform(r, screen);
    return {
      x: (e.clientX - r.left - transform.x) / transform.scale,
      y: (e.clientY - r.top - transform.y) / transform.scale,
    };
  }

  function hitTest(p: { x: number; y: number }): { id: string; kind: DragKind } | null {
    for (let i = state.items.length - 1; i >= 0; i -= 1) {
      const it = state.items[i];
      if (!it) continue;
      const w = PLACEHOLDER_BASE * it.sx;
      const h = PLACEHOLDER_BASE * it.sy;
      const x0 = it.x - w / 2;
      const y0 = it.y - h / 2;
      if (state.selectedId === it.id) {
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
      startX: p.x,
      startY: p.y,
      origX: it.x,
      origY: it.y,
      origSx: it.sx,
      origSy: it.sy,
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
      if (d.kind === 'move') return clampItem({ ...it, x: d.origX + dx, y: d.origY + dy }, screen);
      if (d.kind === 'resize-br') {
        const sx = Math.max(0.3, d.origSx + dx / PLACEHOLDER_BASE);
        const sy = Math.max(0.3, d.origSy + dy / PLACEHOLDER_BASE);
        return clampItem({ ...it, sx, sy }, screen);
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

function getStageTransform(rect: DOMRect, screen: { width: number; height: number }) {
  const scale = Math.min(rect.width / screen.width, rect.height / screen.height);
  return {
    scale,
    x: (rect.width - screen.width * scale) / 2,
    y: (rect.height - screen.height * scale) / 2,
  };
}

function clampItem(item: PlacementItem, screen: { width: number; height: number }): PlacementItem {
  const w = PLACEHOLDER_BASE * item.sx;
  const h = PLACEHOLDER_BASE * item.sy;
  return {
    ...item,
    x: Math.min(screen.width - w / 2, Math.max(w / 2, item.x)),
    y: Math.min(screen.height - h / 2, Math.max(h / 2, item.y)),
  };
}

function drawWirePart(
  ctx: CanvasRenderingContext2D,
  part: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    kind: WirePartKind;
    color: string;
    selected: boolean;
    status?: 'implemented' | 'linked' | 'draft';
    listRows?: string[];
    limitListHeight?: boolean;
  },
): void {
  const stroke = part.selected ? '#2a6df4' : '#1d2230';
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = part.selected ? 2 : 1;

  if (part.kind === 'button' || part.kind === 'linked-button' || part.kind === 'draft-button') {
    roundRect(ctx, part.x, part.y, part.w, part.h, 6);
    ctx.fillStyle = part.kind === 'draft-button' ? '#fff7ed' : part.kind === 'linked-button' ? '#ecfdf5' : '#f8fafc';
    ctx.fill();
    ctx.stroke();
    smallText(ctx, part.kind === 'draft-button' ? 'draft' : part.kind === 'linked-button' ? 'wired' : 'button', part.x + 8, part.y + 13);
    label(ctx, part.label, part.x + 10, part.y + part.h / 2 + 14, part.w - 20);
  } else if (part.kind === 'listbox') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(part.x, part.y, part.w, part.h);
    ctx.strokeRect(part.x, part.y, part.w, part.h);
    label(ctx, part.label, part.x + 8, part.y + 18, part.w - 16);
    const rows = part.listRows?.length ? part.listRows : ['Item', 'Item', 'Item'];
    const visible = part.limitListHeight ? Math.min(rows.length, Math.max(2, Math.floor((part.h - 32) / 24))) : rows.length;
    for (let i = 0; i < visible; i += 1) {
      const yy = part.y + 30 + i * 24;
      ctx.strokeStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(part.x, yy);
      ctx.lineTo(part.x + part.w, yy);
      ctx.stroke();
      label(ctx, rows[i] ?? `Item ${i + 1}`, part.x + 10, yy + 16, part.w - 28);
    }
    if (part.limitListHeight && rows.length > visible) {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(part.x + part.w - 12, part.y + 34, 4, Math.max(20, part.h - 46));
    }
  } else if (part.kind === 'input') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(part.x, part.y, part.w, part.h);
    ctx.strokeRect(part.x, part.y, part.w, part.h);
    ctx.fillStyle = '#9ca3af';
    label(ctx, part.label, part.x + 10, part.y + part.h / 2 + 4, part.w - 20);
  } else if (part.kind === 'text') {
    ctx.fillStyle = '#111827';
    ctx.font = `${Math.max(12, Math.min(24, part.h * 0.38))}px system-ui, sans-serif`;
    label(ctx, part.label, part.x, part.y + part.h / 2 + 6, part.w);
  } else {
    ctx.fillStyle = part.kind === 'nav' ? '#f8fafc' : mixWithWhite(part.color);
    ctx.fillRect(part.x, part.y, part.w, part.h);
    ctx.strokeRect(part.x, part.y, part.w, part.h);
    label(ctx, part.label, part.x + 8, part.y + 18, part.w - 16);
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): void {
  ctx.fillStyle = '#1d2230';
  ctx.font = '12px system-ui, sans-serif';
  const t = text.length > 36 ? `${text.slice(0, 35)}...` : text;
  ctx.fillText(t, x, y, maxWidth);
}

function smallText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function mixWithWhite(color: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return '#f8fafc';
  return `${color}33`;
}
