import React from 'react';
import type { WebInsertion, WebRect } from '../../../../shared/web-scene-pointer.ts';
import type { WebDragView, WebPreviewDragHandlers } from './useWebPreviewDrag.ts';

const MARKER_PX = 4;

function box(rect: WebRect): React.CSSProperties {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function markerBox({ rect, side }: NonNullable<WebInsertion['marker']>): React.CSSProperties {
  const half = MARKER_PX / 2;
  if (side === 'top' || side === 'bottom') return { left: rect.left, top: (side === 'top' ? rect.top : rect.top + rect.height) - half, width: rect.width, height: MARKER_PX };
  return { left: (side === 'left' ? rect.left : rect.left + rect.width) - half, top: rect.top, width: MARKER_PX, height: rect.height };
}

/**
 * Parent-page layer over the preview iframe: selection outline, drag ghost, drop parent and insertion edge.
 * It only takes pointer input while a move mode is active, so selection mode keeps native iframe scrolling.
 */
export function WebDomDragOverlay({ isMoving, selectedRect, view, handlers }: { isMoving: boolean; selectedRect: WebRect | null; view: WebDragView | null; handlers: WebPreviewDragHandlers }): React.ReactElement {
  const marker = view?.drop?.insertion.marker;
  return <div className={`web-dom-overlay${isMoving ? ' is-moving' : ''}${view ? ' is-dragging' : ''}`} aria-hidden="true" {...(isMoving ? handlers : {})}>
    {selectedRect && !view ? <div className="web-dom-selection" style={box(selectedRect)} /> : null}
    {view?.drop ? <div className={`web-dom-drop-target${view.drop.parentRect ? '' : ' is-root'}`} style={view.drop.parentRect ? box(view.drop.parentRect) : undefined} /> : null}
    {marker ? <div className="web-dom-insertion" style={markerBox(marker)} /> : null}
    {view ? <div className="web-dom-ghost" style={box(view.ghost)} /> : null}
  </div>;
}
