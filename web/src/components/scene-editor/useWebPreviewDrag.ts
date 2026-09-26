import React from 'react';
import type { WebNode } from '../../../../shared/web-scene.ts';
import type { WebOffset } from '../../../../shared/web-scene-placement.ts';
import type { WebMoveMode } from '../../../../shared/web-scene-move.ts';
import { dropParent, grabTarget, insertionPoint, type WebInsertion, type WebPoint, type WebRect } from '../../../../shared/web-scene-pointer.ts';
import { nodeElement, nodeIdAt, nodeRect, previewDocument, siblingBoxes } from './preview-geometry.ts';

/** Movement below this is a tap (selection only), so a press never nudges an element by accident. */
const DRAG_THRESHOLD_PX = 4;

export interface WebDropView { parentId: string | null; parentRect: WebRect | null; insertion: WebInsertion }
export interface WebDragView { nodeId: string; ghost: WebRect; drop: WebDropView | null }
export interface WebPreviewDragHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}

interface Options {
  frame: React.RefObject<HTMLIFrameElement | null>;
  nodes: readonly WebNode[];
  selectedId: string;
  /** null keeps the preview in selection mode; no drag starts. */
  mode: WebMoveMode | null;
  baseOffset: (nodeId: string) => WebOffset;
  onSelect: (nodeId: string) => void;
  onGroupMove: (nodeId: string, delta: WebOffset) => void;
  onIndividualMove: (nodeId: string, parentId: string | null, beforeId: string | null) => void;
}

interface Session {
  pointerId: number; nodeId: string; start: WebPoint; rect: WebRect; base: WebOffset;
  element: HTMLElement | null; isDragging: boolean; drop: WebDropView | null;
}

function pointIn(event: React.PointerEvent<HTMLElement>): WebPoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

/**
 * Drag on a parent-page overlay aligned with the preview iframe (PF-WEB-2 keeps scripts out of the
 * iframe). Group mode shows the element moving in place; individual mode shows the drop parent and
 * the insertion edge. Nothing is written until the pointer is released.
 */
export function useWebPreviewDrag({ frame, nodes, selectedId, mode, baseOffset, onSelect, onGroupMove, onIndividualMove }: Options): { view: WebDragView | null; handlers: WebPreviewDragHandlers } {
  const session = React.useRef<Session | null>(null);
  const [view, setView] = React.useState<WebDragView | null>(null);
  const end = React.useCallback((): Session | null => {
    const current = session.current;
    session.current = null;
    // Undo the live preview; the committed scene re-renders the iframe with the saved rule.
    current?.element?.style.removeProperty('translate');
    setView(null);
    return current;
  }, []);
  // Switching modes or unmounting mid-drag cancels without writing.
  React.useEffect(() => { end(); }, [mode, end]);
  React.useEffect(() => () => { end(); }, [end]);

  const dropAt = (document: Document, nodeId: string, point: WebPoint): WebDropView => {
    const parentId = dropParent(nodes, nodeId, nodeIdAt(document, point));
    const siblings = nodes.filter(node => node.parentId === parentId && node.id !== nodeId).map(node => node.id);
    return { parentId, parentRect: parentId === null ? null : nodeRect(document, parentId), insertion: insertionPoint(siblingBoxes(document, siblings), point) };
  };

  const handlers: WebPreviewDragHandlers = {
    onPointerDown: event => {
      if (!mode || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const document = previewDocument(frame.current);
      const point = pointIn(event);
      const hitId = document ? nodeIdAt(document, point) : null;
      if (!document || !hitId) return;
      const nodeId = grabTarget(nodes, selectedId || null, hitId);
      onSelect(nodeId);
      const rect = nodeRect(document, nodeId);
      if (!rect) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      session.current = { pointerId: event.pointerId, nodeId, start: point, rect, base: baseOffset(nodeId), element: nodeElement(document, nodeId), isDragging: false, drop: null };
    },
    onPointerMove: event => {
      const current = session.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const point = pointIn(event);
      const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
      if (!current.isDragging && Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD_PX) return;
      current.isDragging = true;
      const ghost = { ...current.rect, left: current.rect.left + delta.x, top: current.rect.top + delta.y };
      if (mode === 'group') {
        current.element?.style.setProperty('translate', `${Math.round(current.base.x + delta.x)}px ${Math.round(current.base.y + delta.y)}px`);
        setView({ nodeId: current.nodeId, ghost, drop: null });
        return;
      }
      const document = previewDocument(frame.current);
      current.drop = document ? dropAt(document, current.nodeId, point) : null;
      setView({ nodeId: current.nodeId, ghost, drop: current.drop });
    },
    onPointerUp: event => {
      if (session.current?.pointerId !== event.pointerId) return;
      const point = pointIn(event);
      const finished = end();
      if (!finished?.isDragging) return;
      if (mode === 'group') onGroupMove(finished.nodeId, { x: point.x - finished.start.x, y: point.y - finished.start.y });
      else if (finished.drop) onIndividualMove(finished.nodeId, finished.drop.parentId, finished.drop.insertion.beforeId);
    },
    onPointerCancel: event => {
      if (session.current?.pointerId === event.pointerId) end();
    },
  };
  return { view, handlers };
}
