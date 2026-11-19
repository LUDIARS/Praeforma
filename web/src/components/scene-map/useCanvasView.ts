import React from 'react';

export interface CanvasView { x: number; y: number; zoom: number }
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * 遷移図キャンバスの表示位置と倍率 (PF-MAP-9)。背景のドラッグで動かし、ホイールで倍率を変える。
 * ホイールはページのスクロールを止める必要があるので、passive: false で自前に登録する。
 */
export function useCanvasView(viewport: React.RefObject<HTMLDivElement | null>) {
  const [view, setView] = React.useState<CanvasView>({ x: 0, y: 0, zoom: 1 });
  const pan = React.useRef<{ pointerId: number; startX: number; startY: number; origin: CanvasView } | null>(null);
  /** 直前の押下で画面を動かしたか。背景クリックで選択を外す処理と区別する。 */
  const panned = React.useRef(false);

  React.useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      setView((current) => {
        const zoom = clampZoom(current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
        const ratio = zoom / current.zoom;
        return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [viewport]);

  const zoomBy = (factor: number): void => {
    const rect = viewport.current?.getBoundingClientRect();
    const cx = (rect?.width ?? 0) / 2, cy = (rect?.height ?? 0) / 2;
    setView((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const ratio = zoom / current.zoom;
      return { zoom, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio };
    });
  };

  /** 中身の範囲 (キャンバス座標) が画面に収まるように合わせる。 */
  const fit = React.useCallback((bounds: { minX: number; minY: number; maxX: number; maxY: number }): void => {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const margin = 32;
    const width = Math.max(1, bounds.maxX - bounds.minX), height = Math.max(1, bounds.maxY - bounds.minY);
    const zoom = clampZoom(Math.min((rect.width - margin * 2) / width, (rect.height - margin * 2) / height, 1));
    setView({ zoom, x: margin - bounds.minX * zoom + Math.max(0, (rect.width - margin * 2 - width * zoom) / 2), y: margin - bounds.minY * zoom });
  }, [viewport]);

  const panHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0 || (event.target as Element).closest('.scene-node')) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: view };
      panned.current = false;
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>): void => {
      const state = pan.current;
      if (!state || state.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 3) panned.current = true;
      setView({ ...state.origin, x: state.origin.x + event.clientX - state.startX, y: state.origin.y + event.clientY - state.startY });
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>): void => {
      if (pan.current?.pointerId === event.pointerId) pan.current = null;
    },
  };
  const wasPanned = (): boolean => panned.current;
  return { view, zoomBy, fit, panHandlers, wasPanned };
}
